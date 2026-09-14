# AI Prompts & Technical Evolution Log

This document records the actual technical prompts, architecture challenges, and engineering corrections across the development lifecycle. Rather than raw conversational debug logs, each section captures the architectural intent, the initial proposal or naive implementation, the senior engineering critique, and the verified technical resolution.

---

## 1. Foundational Architecture & Modular Layering

### Architecture Prompt
> *"Act as a senior software engineer and pragmatic system architect. Build this project production-minded but appropriately scoped for a take-home assignment. Before coding, reason about requirements, data model, API contracts, permissions, edge cases, performance, security, and failure modes. Prefer a simple modular architecture over unnecessary microservices or distributed infrastructure.*
> 
> *Structure backend business logic into dedicated domain layers instead of putting logic directly inside API routes. Enforce all business rules strictly server-side, especially authorization, ticket lifecycle FSM, collaboration integrity, zero-write SLA calculation, atomic bulk operations, and immutable audit logging. Keep database operations efficient through proper indexing, server-side filtering/pagination, transactions, and avoiding unnecessary writes.*
> 
> *Do not blindly implement requirements—identify ambiguities, make sensible assumptions, document important trade-offs, and keep the architecture easy to explain in an interview. When choosing between two approaches, explain the trade-off briefly and choose the simplest solution that will remain robust at reasonable scale."*

### What Was Proposed
- The AI initially suggested co-locating business logic, query parameter parsing, validation, and Prisma queries directly inside Next.js `app/api/.../route.ts` handlers.
- It also proposed a client-side persona dropdown in the navigation bar that manipulated React state (`user.role = "SUPERVISOR"`) to switch roles without backend validation.

### Engineering Correction & Decision
- **Decoupled Route & Policy Architecture**: Rejected putting business logic inside Next.js route files. Coupling controllers to Next.js `NextRequest`/`NextResponse` objects makes them difficult to unit test without heavy mocking and creates framework lock-in.
- Implemented an explicit `backend/routes/` layer with a central `API_ROUTE_REGISTRY` catalog, pure predicate authorization functions in `backend/models/policies/` (`TicketPolicy`, `ReplyPolicy`, `TagPolicy`), and domain controllers in `backend/controllers/`.
- The Next.js API route files (`backend/app/api/.../route.ts`) were reduced to clean one-line delegates pointing to `@/routes`. This made all 44 endpoints discoverable in a single file and 100% testable in Vitest.
- **Genuine Server-Side Authentication**: Firmly rejected client-side role toggling as security theater. Enforced server-side JWT session cookies (`jose` HS256) signed with HTTP-only cookies, verified against PostgreSQL on every protected mutation.

---

## 2. Mathematical Zero-Write SLA Clock Modeling & Lifecycle State Machine

### Architecture Prompt
> *"Model the SLA response time tracking for our ticket lifecycle (`NEW` -> `OPEN` -> `PENDING` -> `RESOLVED` -> `CLOSED`). In particular, when a ticket enters `PENDING`, it is waiting on customer reply and the clock must pause. When the customer replies, it returns to `OPEN` and resumes.*
> 
> *Design the database schema and calculation service to handle this without background polling write amplification or cumulative clock drift across process restarts. Ensure that reopening closed tickets is strictly bounded by a 7-day window guard."*

### What Was Proposed
- The AI proposed adding an integer column `remainingSeconds` to the `tickets` table and scheduling a background cron job or `setInterval` worker running every 60 seconds to execute:
  ```sql
  UPDATE tickets SET remainingSeconds = remainingSeconds - 60 WHERE status = 'OPEN';
  ```

### Engineering Correction & Decision
- **Eliminating Polling Write Amplification**: In a ticketing system with 5,000 open tickets, a background polling worker executes 300,000 write queries every hour on tickets that are sitting completely idle, generating catastrophic database write amplification, row-level lock contention, and cumulative clock drift across server restarts.
- **Mathematical Deadline Timestamps**: Stored `slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`, and `slaCycle`.
  - When entering `PENDING`: computed `slaPausedRemainingSeconds = max(0, Math.floor((slaDueAt - now) / 1000))` and saved once.
  - When customer replies: computed `slaDueAt = now + slaPausedRemainingSeconds` to resume with zero clock drift.
  - **Zero Database Writes**: While sitting in the queue, tickets require zero database writes; the client browser computes live 1-second countdowns locally.
- **7-Day Reopen Guard**: Reopening tickets in `CLOSED` status verifies `now - ticket.closedAt <= 7 days`; requests beyond 7 days return HTTP `400 Bad Request` directing the user to open a new ticket.

---

## 3. Scalability, Set-Based Operations & PostgreSQL Advisory Locking

### Architecture & System Design Prompt
> *"Act as a **senior DBMS + system design engineer**. Thoroughly inspect the entire codebase and understand the actual architecture, database schema, queries, indexes, API flows, concurrency, and data access patterns.
> 
> Then:
> - Identify the **real performance/scalability bottlenecks**; do not assume one exists.
> - Analyze whether the current system is naturally **read-heavy** and replicate realistic read-heavy traffic/workloads for benchmarking.
> - Design and run appropriate **load/stress tests** and measure p50/p95/p99 latency, RPS, errors, DB CPU/connections, and resource usage at increasing data/concurrency levels.
> - Use `EXPLAIN ANALYZE` and query analysis to identify DB bottlenecks.
> - Determine what should be optimized **now vs later**, with evidence.
> - Evaluate indexes, query optimization, pagination, caching/Redis, connection pooling, read replicas, background workers, queues/Kafka, etc. **Only recommend technology when the measured workload justifies it.**
> - Preserve all existing business logic, authorization, API contracts, and correctness.
> - Produce a concise **Before → Bottleneck → Evidence → Optimization → After** report, including what should deliberately **not** be changed and why.
> 
> **Prioritize measured evidence and sound engineering trade-offs over premature optimization or unnecessary architecture complexity.***"

### What Was Proposed
- The AI initially suggested in-memory JavaScript loops with `createMany`/`updateMany` in Node.js, and an in-process Node mutex (`async-mutex`) to handle concurrent polling of `/api/sla/alerts`.

### Engineering Correction & Decision
- **Multi-Worker Serverless Concurrency**: An in-process mutex is useless in clustered or serverless deployments (Render/Vercel) because each container or serverless function runs in an independent Node.js process and cannot coordinate with other processes.
- **Physical Uniqueness Constraint**: Added `@@unique([ticketId, breachCycle])` to `schema.prisma`, making it physically impossible for PostgreSQL to store duplicate alerts for the same breach cycle (fixing a bug where multi-tab polling created duplicate alerts 437ms apart).
- **PostgreSQL Advisory Locking**: In `SlaController.syncAllAlertsSetBased`, added:
  ```sql
  SELECT pg_try_advisory_xact_lock(hashtext('sla_alert_sync')) AS acquired;
  ```
  When 10 concurrent requests arrive from multiple open browser tabs, exactly 1 acquires the lock and reconciles alerts; the other 9 immediately skip the write phase and execute the indexed read query with zero lock waiting.
- **Set-Based SQL Operations**: Replaced the Node.js loop with 4 atomic set-based SQL queries (`INSERT ... SELECT ... ON CONFLICT`). Reduced SLA polling latency from **67,976 ms (68s) to 4,045 ms (16.8x faster)**.
- **Dashboard Aggregations & UTC Alignment**: Replaced in-memory row iteration with `date_trunc('week', "resolvedAt")` and `LEFT JOIN ... GROUP BY`, fixing a subtle timezone offset bug where `weekStart.setHours(0,0,0,0)` in local time caused Sunday/Monday date mismatches.

---

## 4. Multi-Role Authorization, Tenant Security & Customer Data Isolation

### Architecture Prompt
> *"Implement a unified 3-role access control model (`SUPERVISOR`, `AGENT`, `CUSTOMER`). Define clear authorization boundaries:*
> *- Supervisors have global visibility, reassignments, closures, and team administration.*
> *- Agents can view and reply to assigned or collaborated tickets, but cannot close tickets or reassign them away from themselves.*
> *- Customers can only access tickets they submitted (`requesterId`).*
> 
> *Ensure customer data isolation is strictly enforced at the database query level rather than filtered in-memory, and guarantee that internal staff notes are completely inaccessible to customers over the wire."*

### What Was Proposed
- The AI initially drafted customer filtering inside the controller by filtering an in-memory array (`tickets.filter(t => t.requesterId === user.id)`), which leaked un-scoped records over the network before filtering.
- It also left `requesterId` optional (`String?`), meaning tickets could exist without clear customer ownership.

### Engineering Correction & Decision
- **Mandatory Ownership Relation**: Made `requesterId` a required relation (`User.id`), ensuring every ticket is strictly tied to an authenticated account.
- **Query-Level Data Isolation**: Enforced query-level `where: { requesterId: sessionUser.id }` inside `backend/routes/ticket.routes.ts` and `TicketController.getTickets`. Customers physically cannot query tickets belonging to other organizations.
- **Strict Note Privacy**: Modified `TimelineController` so that internal notes (`isInternal: true`) are unconditionally stripped from database query results when the requesting session belongs to a `CUSTOMER`.
- **Atomic CSAT Ratings**: Implemented customer satisfaction ratings (1–5 stars + comment) submitted exclusively by the ticket requester once resolved, recorded atomically alongside a `CSAT_SUBMITTED` audit event with immutability guards against duplicate submissions.

---

## 5. Semantic Knowledge Copilot: Hybrid Vector Retrieval & Calibrated Scoring

### AI/RAG Architecture Prompt
> *"Act as a **senior support-platform architect specializing in AI/RAG and workflow automation**. Analyze our existing ticketing system and identify the single highest-value next feature to build around knowledge reuse: detecting similar resolved tickets/knowledge-base articles and recommending existing solutions when semantic similarity exceeds a safe threshold.
> 
> Study how production systems (Zendesk, Freshdesk, Jira Service Management, Intercom, etc.) approach this. Evaluate architecture, embeddings/vector search, thresholds, false positives, indexing, data flow, permissions, latency, and human approval. Compare implementation options (Supabase pgvector, dedicated vector DB, etc.) and recommend the simplest production-ready approach that fits our current modular + Supabase/PostgreSQL + Prisma architecture.
> 
> Do not overengineer. Give a concrete implementation plan and explain why it is the best next area to work on.*"

### What Was Proposed
- The AI required compiling the PostgreSQL `pgvector` C-extension and creating raw SQL HNSW migrations. On Supabase's transaction pooler (port 6543) and local environments, `vector` types cannot be managed natively by Prisma CLI schema pushes.
- The AI set a hardcoded cosine similarity threshold of `0.72`. Because realistic ticket-to-article similarity frequently scores between 0.50 and 0.65, the UI panel received zero matches and silently collapsed (`return null`).

### Engineering Correction & Decision
- **Dual-Mode Vector Engine**: Built an application-level hybrid service in `backend/services/embedding.service.ts`:
  - Uses the Google Gemini API (`text-embedding-004`) for 1536-dimensional semantic embeddings when configured.
  - Built-in **deterministic vector generator fallback**: if the API key is absent, invalid, or hits rate limits (HTTP 429), it automatically switches to a deterministic n-gram hashing algorithm distributed across 1536 dimensions with in-memory caching.
- **Calibrated Thresholds**: Lowered the threshold to `0.52` for high-confidence suggestions and `0.22` for related articles, with a `+0.12` category-affinity boost.
- **Rich Dynamic Seed Curation**: Completely overhauled `prisma/seed.ts` to generate realistic, domain-specific tickets and KB articles (e.g. database connection pool exhaustion, webhook replay attacks, invoice discrepancies) so the copilot surfaces high-signal suggestions immediately upon seeding.

---

## 6. Cryptographic Single-Use Agent Provisioning

### Architecture Prompt
> *"Design a secure agent onboarding workflow for supervisors at `/team`. Standard implementations that generate cleartext passwords and email them violate OWASP A07 (Identification and Authentication Failures) and compromise non-repudiation.*
> 
> *Implement a zero-knowledge invitation token system with cryptographic entropy, short time-to-live, and atomic single-use activation. Ensure the frontend routing shell permits unauthenticated token validation at `/setup-account`."*

### What Was Proposed
- The AI proposed sending an auto-generated temporary password in cleartext over email, and the setup link redirected to `/login` because `/setup-account` was not whitelisted in the frontend authentication wrapper.

### Engineering Correction & Decision
- **Zero-Knowledge Token Architecture**: Strongly rejected sending passwords over email. Implemented a **Cryptographic Single-Use Time-Bounded Token Invitation System**:
  - Supervisor inputs only the agent's name and email; supervisor never sees or sets credentials.
  - Generates 32 bytes of cryptographically secure random entropy (`crypto.randomBytes(32)`).
  - Stores only `sha256(rawToken)` in PostgreSQL with a 24-hour expiration (`expiresAt < now()`).
  - Pre-creates the user record in `PENDING_SETUP` state with an unmatchable sentinel hash (`!PENDING_SETUP_...`).
  - Token is consumed atomically inside a PostgreSQL ACID transaction on password creation, setting user status to `ACTIVE`.
- **Route Whitelisting Fix**: Fixed `frontend/components/AppShell.tsx` by adding `/setup-account` to public auth routes, preventing unauthenticated invitees from being prematurely bounced to `/login`.

---

## 7. Resilient Transactional Email & Linux Container IPv4 Networking

### Architecture Prompt
> *"Build a dual-provider transactional email service in `backend/services/email.service.ts` for agent invitation links and queue digest briefings. It must support arbitrary recipient domains via Gmail SMTP (`nodemailer`) with Resend as secondary and terminal console fallback for local development.*
> 
> *Harden the SMTP connection against containerized cloud environments (e.g. Render/Linux) where unrouted IPv6 networking can cause socket timeouts, and ensure API requests never stall if downstream SMTP relays are unreachable."*

### What Was Proposed
- The AI provided a standard `nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, ... })` configuration, which hung for 3–4 minutes when deployed on Render Linux containers.

### Engineering Correction & Decision
- **Container IPv6 Timeout Diagnosis**: Node.js inside the Linux container was attempting to resolve `smtp.gmail.com` to an unrouted IPv6 address, stalling socket establishment until the OS connection timed out.
- **Hardened Multi-Tier Dispatcher**:
  1. **Forced IPv4 DNS Resolution**: Passed `family: 4` into `nodemailer` transport options to bypass broken container IPv6 routing.
  2. **Dual-Port Failover**: Attempted port 587 (STARTTLS) first, falling back to port 465 (SSL/TLS).
  3. **Strict Timeout Race**: Wrapped connection verification and dispatch inside a `Promise.race` with a 6.5-second timeout, ensuring the API response returns gracefully rather than blocking user workflows.

---

## 8. Bulk Operations: Per-Ticket Isolation & Partial Success Reporting

### Architecture Prompt
> *"Implement the bulk reassign and bulk close endpoints for supervisors. In real-world support operations, an agent may select 20 tickets from the queue where some tickets are already closed or ineligible.*
> 
> *Design the execution model so that valid tickets succeed and commit with audit logs, while ineligible tickets report specific refusal reasons without failing the entire batch."*

### What Was Proposed
- The AI wrapped the entire batch in a single monolithic transaction:
  ```ts
  await prisma.$transaction(ticketIds.map(id => prisma.ticket.update(...)))
  ```
  If any single ticket in the selection failed validation, the entire transaction rolled back and rejected all 20 tickets.

### Engineering Correction & Decision
- **Per-Ticket Isolated Transactions**: Restructured `backend/controllers/bulk.controller.ts` to execute per-ticket isolated transactions within a loop.
  - Valid tickets commit their state change and append an immutable `AuditLog` event.
  - Ineligible tickets catch exceptions, record the specific refusal reason, and continue processing remaining tickets.
  - Returns a structured payload `{ totalRequested, successCount, failureCount, results: [...] }` displayed in an itemized summary modal, strictly satisfying the assignment's partial failure requirement.

---

## 9. B2B SaaS Frontend Polish & Anti-AI-Slop Curation

### 1. Frontend Architecture & Design System Redesign Prompt
> *"Act as a **senior frontend engineer + product designer**. Audit and redesign the existing support ticketing frontend to make it feel **professional, minimal, modern, and production-ready**.*
> 
> *The current UI feels too AI-generated/childish: too colourful, too many rounded cards, excessive gradients, decorative elements, inconsistent spacing, and weak typography.*
> 
> *### Goal*
> *Make it feel like a serious B2B SaaS product used daily by support teams — think **Linear, Intercom, Jira, GitHub, Zendesk** in terms of quality and restraint, but do not copy them.*
> 
> *### Design Principles*
> *- Minimal, restrained, information-dense*
> *- Strong typography, practical hierarchy, consistent spacing, and subtle borders/surfaces*
> *- Neutral surfaces with one restrained accent colour; semantic colours only for status/SLA states*
> *- **Explicitly avoid AI-slop**: no gradients, glassmorphism, neon colours, excessive pills, giant headings, oversized cards, decorative blobs, or flashy animations.*
> *- Prioritize: App shell/sidebar, Ticket queue table and bulk actions, Ticket detail with live SLA countdowns, Dashboard KPIs, Alerts, and Forms.*
> 
> *Standardize reusable design tokens without changing backend logic, API contracts, database behaviour, or state machine rules. The result must look like it was designed by an experienced product team, **not generated by AI**.*"

### 2. Customer Support Portal & Homepage Prompt
> *"Now build the **homepage/landing page** for the support ticketing product.*
> 
> *First, research how **real production SaaS/support platforms** handle their customer-facing complaint/support entry pages (Zendesk, Intercom, Linear).*
> 
> *The homepage should immediately communicate:*
> *“Having an issue or need help? Submit a support request and our team will take care of it.”*
> 
> *Keep it **clean, minimal, professional, and trustworthy** — not like an AI-generated startup landing page.*
> 
> *### Requirements & Restraint*
> *- Clear headline focused on getting help / reporting an issue*
> *- One prominent “Submit a Request” CTA with a simple secondary “Sign In / View Requests” option*
> *- Reassuring explanation of what happens after submitting a request*
> *- Avoid: gradients, excessive cards, decorative illustrations, huge hero sections, or marketing fluff.*
> *- Reuse established components, typography, spacing, and visual tokens from the existing design system.*"

### What Was Proposed
- The AI initially generated boilerplate marketing widgets with decorative, non-functional badges ("All Systems Operational", "1-Click Autofill", "v1.0", "Strictly authenticated"), sharp square borders, and a sidebar navigation that lacked a restore toggle when collapsed.

### Engineering Correction & Decision
- **Anti-AI-Slop Curation**: Stripped all decorative marketing text, fake status badges, and generic boilerplate from `frontend/app/page.tsx`.
- Replaced harsh borders with modern rounded radii (`rounded-xl`), tailored neutral HSL palettes, and refined typography.
- Fixed the sidebar toggle mechanism in `frontend/components/AppShell.tsx`: added a persistent, floating toggle button that smoothly expands the sidebar when collapsed, and fixed badge positioning so notification indicators remain aligned.
- Ensured the brand logo in the top-left corner navigates directly to the home landing page (`/`) rather than forcing a redirect to the dashboard.

---

## 10. Comprehensive Security Audit, Invariant Verification & Adversarial Fuzzing

### Adversarial Audit Prompt
> *"Act as a **senior QA + security engineer** and aggressively test the application against the 10 requirements in the assignment.*
> 
> *Your goal is to deliberately find:*
> *- Broken or incorrectly implemented functionality*
> *- Business-logic/edge-case bugs*
> *- Server-side authorization bypasses*
> *- IDOR/BOLA and privilege escalation*
> *- API manipulation/mass assignment issues*
> *- Incorrect lifecycle, SLA, alerts, dashboard or history behavior*
> *- Data integrity/security problems*
> 
> ***Do not trust the UI.** Test the backend/API directly wherever relevant, especially agent vs supervisor permissions.*
> 
> *Try malicious inputs, invalid IDs, unauthorized resources, illegal status transitions, boundary timestamps, repeated/concurrent actions, and manipulated request fields.*
> 
> *### Important filtering*
> *Do **not** report trivial issues just to increase the count. Ignore: intentional dummy demo accounts, seed data, cosmetic UI-only issues, optional stretch features, and purely theoretical vulnerabilities.*
> *Only report issues that are **genuinely significant, reproducible, and worth fixing or mentioning to the evaluator**.*
> 
> *### Report Structure*
> *For each genuine finding give: `[Severity] Title`, `Location`, `Problem`, `Reproduction`, `Expected vs Actual`, `Impact`, and `Requirement Violated`.*
> *Then provide: Critical/High issues first, a short Goal 1–10 PASS/PARTIAL/FAIL table, and a Final verdict.*
> *Be conservative: **5 real findings are better than 20 questionable ones.***"

### Defects Uncovered by the Audit
The adversarial audit identified 7 subtle edge-case defects across the system:
1. **Passive SLA Breach Syncing**: When querying the queue, tickets that passed their SLA deadline while in `OPEN` status were not dynamically updating the `sla_alerts` table on read-only queries.
2. **Priority Edit SLA Invariance**: Changing a ticket's priority (e.g. `MEDIUM` -> `URGENT`) did not adjust active deadlines or frozen paused durations by the difference in target minutes (`targetDeltaMinutes`).
3. **Agent Assignment on Creation**: Agents creating new tickets were able to supply an arbitrary `primaryAssigneeId` in the request body rather than being restricted to self-assignment or unassigned queue status.
4. **Alert Acknowledgment Contract Mismatch**: Inconsistent API contracts between frontend client parameters and backend route extraction for alert acknowledgment.
5. **Timeline Duplicate Events**: The unified activity timeline displayed duplicate entries for replies because both the `Reply` record and the synthetic `REPLY_ADDED` audit log were rendered together.
6. **Reopen Boundary Timestamp Validation**: Reopening tickets lacked strict boundary checks against `ticket.closedAt`, allowing tickets closed more than 7 days ago to transition back to `OPEN`.
7. **Concurrent SLA Alert Duplication**: Multiple active browser tabs polling `/api/sla/alerts` simultaneously raced to insert duplicate alerts for the same ticket just 437ms apart.

### Engineering Resolution & Verification Suite
- **Delta-Based SLA Adjustments**: Implemented `targetDeltaMinutes = newTargetMinutes - oldTargetMinutes`, adjusting `slaDueAt` on active tickets and `slaPausedRemainingSeconds` on paused tickets.
- **Server-Enforced Actor Assignment**: Hardcoded server-side checks in `TicketController.createTicket` ensuring agents cannot assign tickets to other agents upon creation.
- **Timeline Deduplication**: Filtered out redundant `REPLY_ADDED` audit logs in `TimelineController.getUnifiedTimeline`, preserving raw audit logs in PostgreSQL while providing a clean conversation feed.
- **Strict 7-Day Window Guard**: Added explicit timestamp validation in `LifecycleController.updateStatus` rejecting reopens after 7 days.
- **Concurrency Locking**: Added `@@unique([ticketId, breachCycle])` in `schema.prisma` and PostgreSQL advisory locking (`pg_try_advisory_xact_lock`).
- **Automated Vitest Regression Suite**: Built 25 modular test suites in `backend/tests/` comprising **195 passing unit, integration, security, and fuzz tests** verifying all 10 core goals and security invariants under concurrent execution.
