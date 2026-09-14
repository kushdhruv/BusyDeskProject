# AI Prompts & Engineering Dialogue

The prompts actually used during development, in chronological working order, grouped by technical milestone. For each significant interaction: what was asked, what the AI initially proposed, and the critical engineering corrections made to ensure production quality, scalability, and security.

---

## 1. Foundational Architecture & Rejection of Naive Monolithic Scaffolding

### Prompt
> *"Act as a senior software engineer and pragmatic system architect. Build this project production-minded but appropriately scoped for a ~12-hour assignment. Before coding, reason about requirements, data model, API contracts, permissions, edge cases, performance, security, and failure modes. Prefer a simple modular monolith over unnecessary microservices or infrastructure. Keep database operations efficient through proper indexing, server-side filtering/pagination, aggregation, transactions, and avoiding unnecessary writes. Enforce all business rules server-side, especially authorization, ticket lifecycle, collaboration, SLA, bulk operations, and immutable audit history.*
> 
> *Do not blindly implement requirements—identify ambiguities, make sensible assumptions, document important trade-offs, and keep the architecture easy to explain in an interview. Build incrementally, write clean maintainable code, validate each feature, and avoid overengineering."*

### What the AI Proposed
- The AI initially suggested placing all controller logic, query parameter parsing, and Prisma queries directly inside Next.js `app/api/.../route.ts` handlers.
- It also proposed an unauthenticated persona dropdown in the client navigation bar that manipulated React state (`user.role = "SUPERVISOR"`).

### What Was Corrected
- **Decoupled Route & Policy Architecture**: Rejected putting business logic inside Next.js route files. Coupling controllers to Next.js `NextRequest`/`NextResponse` objects makes them difficult to unit test without heavy mocking and creates framework lock-in.
- Implemented an explicit `backend/routes/` layer with a central `API_ROUTE_REGISTRY` catalog, pure predicate authorization functions in `backend/models/policies/` (`TicketPolicy`, `ReplyPolicy`, `TagPolicy`), and domain controllers in `backend/controllers/`.
- The Next.js API route files (`backend/app/api/.../route.ts`) were reduced to clean one-line delegates pointing to `@/routes`. This made all 44 endpoints discoverable in a single file and 100% testable in Vitest.
- **Genuine Server-Side Authentication**: Firmly rejected client-side role toggling as security theater. Enforced server-side JWT session cookies (`jose` HS256) signed with HTTP-only cookies, verified against PostgreSQL on every protected mutation.

---

## 2. SLA Clock Modeling: Eliminating Background Polling Write Amplification

### Prompt
> *"Model the SLA response time tracking for our ticket lifecycle (New -> Open -> Pending -> Resolved -> Closed). In particular, when a ticket enters Pending, it is waiting on customer reply and the clock must pause. When the customer replies, it returns to Open and resumes. How should the database schema and calculation service handle this without causing performance issues?"*

### What the AI Proposed
- The AI proposed adding an integer column `remainingSeconds` to the `tickets` table and scheduling a background cron job or `setInterval` worker running every 60 seconds to execute:
  ```sql
  UPDATE tickets SET remainingSeconds = remainingSeconds - 60 WHERE status = 'OPEN';
  ```

### What Was Corrected
- **Mathematical Deadline Modeling**: Strongly rejected the polling worker pattern. In a system with 5,000 open tickets, a background polling worker executes 300,000 write queries every hour on tickets that are sitting completely idle, generating catastrophic database write amplification, row-level lock contention, and cumulative clock drift across restarts.
- Instructed the AI to pivot to **pure mathematical deadline modeling**:
  > *"Do not decrement integer counters in the database. Instead, store `slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`, and `slaCycle`. Compute remaining active seconds once when transitioning to Pending. When the customer replies, compute `slaDueAt = now() + slaPausedRemainingSeconds` to resume with zero drift. Sit in the queue with ZERO database writes, and calculate live 1-second countdowns on the client browser."*
- This became the zero-write SLA engine implemented in `backend/controllers/sla.controller.ts`.

---

## 3. Scalability & Concurrency: Rejecting Cheap Shortcuts for Real Database Concurrency

### Prompts
> *"Analyze the codebase and produce a concise Scalability & Performance Report. Cover current architecture, estimated scalability limits, expected latency/p95, and what breaks first at 10x/100x scale."*
>
> *(After reviewing the AI's initial optimization plan)*:
> *"The plan looks suspicious and quick cheap shortcut , instead think like true senior system design engineer and plan the solution for it like indexing btree etc if needed ..... no quick shortcuts but genuine good way."*
>
> *"Before implementation, make these final adjustments:
> Change 1 — SLA: Good direction, but the plan still says 'compute in memory and execute batched createMany/updateMany.' That's not fully set-based. Make sure the agent doesn't reintroduce an O(N) DB-operation pattern. Also explicitly test concurrent SLA syncs and duplicate-alert prevention.
> Change 2 — Dashboard: Good to go. SQL aggregation with date_trunc('week', resolvedAt)..."*

### What the AI Proposed
- The AI initially suggested in-memory JavaScript loops with `createMany`/`updateMany` in Node.js, and an in-process Node mutex (`async-mutex`) to handle concurrent polling of `/api/sla/alerts`.

### What Was Corrected
- **Database Engine Concurrency**: An in-process mutex is useless in clustered or serverless deployments (Render/Vercel) because each container runs in an independent Node.js process.
- **Physical Uniqueness Constraint**: Added `@@unique([ticketId, breachCycle])` to `schema.prisma`, making it physically impossible for PostgreSQL to store duplicate alerts for the same breach cycle (fixing a bug where multi-tab polling created duplicate alerts 437ms apart).
- **PostgreSQL Advisory Locking**: In `SlaController.syncAllAlertsSetBased`, added:
  ```sql
  SELECT pg_try_advisory_xact_lock(hashtext('sla_alert_sync')) AS acquired;
  ```
  When 10 concurrent requests arrive from multiple open browser tabs, exactly 1 acquires the lock and reconciles alerts; the other 9 immediately skip the write phase and execute the indexed read with zero lock waiting.
- **Set-Based SQL Operations**: Replaced the Node.js loop with 4 atomic set-based SQL queries (`INSERT ... SELECT ... ON CONFLICT`). Reduced SLA polling latency from **67,976 ms (68s) to 4,045 ms (16.8x faster)**.
- **Dashboard Aggregations & UTC Alignment**: Replaced in-memory row iteration with `date_trunc('week', "resolvedAt")` and `LEFT JOIN ... GROUP BY`, fixing a subtle timezone offset bug where `weekStart.setHours(0,0,0,0)` in local time caused Sunday/Monday date mismatches.

---

## 4. Customer Role, RLS Security & Server-Side Data Isolation

### Prompts
> *"# Customer Role — Implementation Plan
> - Add a third role: `CUSTOMER`, alongside existing `AGENT` and `SUPERVISOR`.
> - Reuse the existing `User` model; update the role enum to `SUPERVISOR`, `AGENT`, `CUSTOMER`."*
>
> *(After reviewing the implementation draft)*:
> *"Overall yes, it is good and implementable. Only these major points need editing: requesterId should preferably be required (String, not String?) if every ticket must have a requester. Keep data isolation strict so customers can only see their own tickets."*
>
> *"check the codebase of backend , and see if its safe to enable these RLS from supabase console or not"*

### What the AI Proposed
- The AI initially drafted customer filtering inside the controller by filtering an in-memory array (`tickets.filter(t => t.requesterId === user.id)`), which leaked un-scoped records over the wire before filtering.
- It also left `requesterId` optional (`String?`), meaning tickets could exist without clear customer ownership.

### What Was Corrected
- **Mandatory Ownership**: Made `requesterId` a required relation (`User.id`), ensuring every ticket is strictly tied to an authenticated account.
- **Query-Level Data Isolation**: Enforced query-level `where: { requesterId: sessionUser.id }` inside `backend/routes/ticket.routes.ts` and `TicketController.getTickets`. Customers physically cannot query tickets belonging to other organizations.
- **Strict Note Privacy**: Modified `TimelineController` so that internal notes (`isInternal: true`) are unconditionally stripped from database query results when the requesting session belongs to a `CUSTOMER`.

---

## 5. Semantic Knowledge Copilot: API Resilience & Dynamic Seed Data

### Prompts
> *"Act as a senior support-platform architect specializing in AI/RAG and workflow automation. Analyze our existing ticketing system and identify the single highest-value next feature to build."*
>
> *"dont we need an ai key?"*
> *"which model key should i give you which is free , then do something if key limit reached or absent or not working then fallback to current method"*
>
> *"where this gone?? 'The Semantic Knowledge Reuse & Resolution Recommendation System (Knowledge Copilot / Smart Assist)' i am unable to see it in current main or master branch running the..."*
>
> *"i am still unable to see suggestion from ai from ticket knowledge base..... become a db analysis and curate the seed file in very dynamice form ... a little more agents ,very dyanamic resolutions..."*

### What the AI Proposed
- The AI required compiling the PostgreSQL `pgvector` C-extension and creating raw SQL HNSW migrations. On Supabase's transaction pooler (port 6543) and local environments, `vector` types cannot be managed natively by Prisma CLI schema pushes.
- The AI set a hardcoded cosine similarity threshold of `0.72`. Because realistic ticket-to-article similarity frequently scores between 0.50 and 0.65, the UI panel received zero matches and silently collapsed (`return null`).

### What Was Corrected
- **Dual-Mode Vector Engine**: Built an application-level hybrid service in `backend/services/embedding.service.ts`:
  - Uses the Google Gemini API (`text-embedding-004`) for 1536-dimensional semantic embeddings when configured.
  - Built-in **deterministic vector generator fallback**: if the API key is absent, invalid, or hits rate limits (HTTP 429), it automatically switches to a deterministic n-gram hashing algorithm distributed across 1536 dimensions with in-memory caching.
- **Calibrated Thresholds**: Lowered the threshold to `0.52` for high-confidence suggestions and `0.22` for related articles, with a `+0.12` category-affinity boost.
- **Rich Dynamic Seed Curation**: Completely overhauled `prisma/seed.ts` to generate realistic, domain-specific tickets and KB articles (e.g. database connection pool exhaustion, webhook replay attacks, invoice discrepancies) so the copilot surfaces high-signal suggestions immediately upon seeding.

---

## 6. Secure Agent Provisioning & Resolving Authentication Redirection

### Prompts
> *"and also adding agent or sending email digest to mail is not working ..... when adding the agent ,i entered my mail id and not mail was sent to me and when i copied the link from there ... it redirected to login page"*
>
> *"and now is it safe secure to add agent , if copied the url and sent to other peeple , will they be able to create agent too becuase no auth requred their?"*

### What the AI Proposed
- The AI diagnosed that newly created agents were being sent a plaintext auto-generated password in email, and the setup link redirected to `/login` because `/setup-account` was not whitelisted in `AppShell.tsx`.

### What Was Corrected
- **Zero-Knowledge Token Architecture**: Strongly rejected sending passwords over email (OWASP A07). Implemented a **Cryptographic Single-Use Time-Bounded Token Invitation System**:
  - Supervisor inputs only the agent's name and email.
  - Generates 32 bytes of cryptographic entropy (`crypto.randomBytes(32)`).
  - Only stores `sha256(rawToken)` in PostgreSQL with a 24-hour expiration (`expiresAt < now()`).
  - Sets user status to `PENDING_SETUP` with an unmatchable sentinel hash (`!PENDING_SETUP_...`).
  - Token is consumed atomically inside a PostgreSQL ACID transaction on password creation.
- **Route Whitelisting Fix**: Fixed `frontend/components/AppShell.tsx` line 23 by adding `/setup-account` to `isAuthPage`, preventing unauthenticated invitees from being prematurely redirected to `/login`.

---

## 7. Production Transactional Email: Diagnosing Linux Container IPv6 SMTP Hangs

### Prompts
> *"i want to send mail to anyone ..... this is the must ... so that when if interviewer adds new agent ,he will add any random email id ... msg should be sent to that id ....research how to achieve this ,should we change resend to something else"*
>
> *(After configuring Gmail SMTP credentials)*:
> *"what the hell , when send an invite to an agent ...it load for 3 4 minutes and then gave this ....test it back and forth it is going in production ..make no mistake"*

### What the AI Proposed
- The AI provided a standard `nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, ... })` configuration, noting that Resend's free tier sandbox restricts outgoing emails strictly to the verified account owner's email address.

### What Was Corrected
- **Linux Container IPv6 Timeout Diagnosis**: When deployed on Render (Linux container environment), calling `sendMail` hung for 3 to 4 minutes before timing out. Node.js inside the container was attempting to resolve `smtp.gmail.com` to an unrouted IPv6 address.
- **Hardened Multi-Tier Dispatcher**: Rewrote `backend/services/email.service.ts`:
  1. **Forced IPv4 DNS Resolution**: Passed `family: 4` into `nodemailer` transport options to bypass broken container IPv6 routing.
  2. **Dual-Port Failover**: Attempted port 587 (STARTTLS) first, falling back to port 465 (SSL/TLS).
  3. **Strict Timeout Guard**: Wrapped connection verification and dispatch inside a `Promise.race` with a 6.5-second timeout, ensuring the API response never stalls if an upstream mail server is unreachable.

---

## 8. Frontend B2B SaaS Polish & Eliminating AI Slop

### Prompts
> *"and in frontend , remove sharp edges to smooth clean lil round ..... shouldnt feel like ai slop"*
>
> *"All Systems Operational remove this from homepage any other ai slop things , make clean and colour combo too"*
>
> *"Strictly authenticated · Immutable audit trail · Verified CSAT remove this too from bottom of homepage"*
>
> *"this is still leading to dashboard page , i want it to lead to homepage , and also when this left nav bar is closed ..... there should a button appear somewhere cleanly dynamically to make it toggle out"*

### What the AI Proposed
- The AI had generated boilerplate marketing widgets with decorative, non-functional badges ("All Systems Operational", "v1.0", "Strictly authenticated"), sharp boxy borders, and a sidebar navigation that lacked a restore toggle when collapsed.

### What Was Corrected
- **Anti-AI-Slop Curation**: Stripped all decorative marketing text, fake status badges, and generic boilerplate from `frontend/app/page.tsx`.
- Replaced harsh, jarring borders with modern rounded radii (`rounded-xl`), tailored neutral HSL palettes, and refined typography.
- Fixed the sidebar toggle mechanism in `frontend/components/AppShell.tsx`: added a persistent, floating toggle button that smoothly expands the sidebar when collapsed, and fixed badge positioning so notification indicators remain aligned.
- Ensured the brand logo in the top-left corner navigates directly to the home landing page (`/`) rather than forcing a redirect to the dashboard.
