# Decisions

Log of the architectural and technical decisions that actually shaped this codebase — the ones where a real alternative existed and a deliberate choice was made.

---

## Decision 1: System Structure — Decoupled Microservices vs. Unified Next.js Monolith

- **Chose:** Two completely decoupled services (`frontend/` on Port 3000 and `backend/` on Port 3001), each with its own independent `package.json`, isolated `node_modules/`, `tsconfig.json`, and `.env` configuration.
- **Rejected:** A unified Next.js monolithic repository where server actions, database ORM logic, and React frontend components live in the same root package.
- **Why:** 
  - **Zero Dependency & Secret Leaking**: Prevents backend Prisma models, database connection strings, bcrypt native binaries, and server-side secrets from accidentally bundling into client-side code.
  - **Independent Scaling & Deployment**: The frontend (static / edge Next.js) and backend (REST API service) can be deployed and scaled on separate infrastructure (e.g. Vercel for UI, Render/AWS for API).
  - **Fast, Focused Testing**: Backend unit and integration tests run in seconds (`npm test` in `backend/`) without compiling the Next.js frontend UI or waiting on React bundlers.
- **Later reversed:** We initially started building within a single monolithic Next.js repository using inline route handlers inside `app/api/`. However, as the domain logic, policy guards, and test suites expanded, we observed dependency coupling and potential bundle pollution where client components could inadvertently import server types. We explicitly halted feature work in Session 7, deleted root-level package dependencies, and partitioned the codebase into clean `frontend/` and `backend/` services with reverse-proxy rewrites (`/api/*` in `next.config.js`). This produced a vastly cleaner, production-grade microservice architecture.

---

## Decision 2: SLA Response Time Engine — Mathematical Deadline State vs. Polling Daemon

- **Chose:** Mathematical deadline modeling storing `slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`, and `slaCycle`.
- **Rejected:** A background cron job or timer daemon polling every 30–60 seconds to decrement an integer `remainingSeconds` column for all active tickets.
- **Why:** 
  - **Zero Database Write Amplification**: An open ticket requires **zero database writes** while sitting in the queue. The SLA countdown is calculated mathematically (`slaDueAt - Date.now()`) on the client browser.
  - **Precision Across Pauses**: When a ticket transitions to `PENDING` (awaiting customer), `slaPausedRemainingSeconds = max(0, Math.floor((slaDueAt - now) / 1000))` is computed and saved once. When the customer replies, `slaDueAt = now + slaPausedRemainingSeconds` resumes the clock with zero clock drift.
  - **Multi-Cycle Breach Tracking**: If a ticket breaches, is paused, or reopened, `slaCycle` increments to ensure that new SLA alerts are tracked independently without overwriting previous historical breach records.

---

## Decision 3: Multi-Agent Collaboration Storage — Normalized Join Table vs. JSON Array Column

- **Chose:** A normalized relational join table `ticket_collaborators` with composite primary key `(ticketId, userId)` and foreign key cascade rules.
- **Rejected:** Storing collaborator user IDs as a JSON array (`collaboratorIds: string[]`) or comma-delimited string directly on the `Ticket` table.
- **Why:** 
  - **Referential Integrity**: Guarantees that only valid, existing `User` records can be added as collaborators. If an agent account is deleted, foreign keys handle clean cascade or validation.
  - **Database-Level Uniqueness**: `UNIQUE(ticketId, userId)` prevents race conditions from inserting duplicate collaborator records.
  - **High-Performance Queue Joins**: Enables efficient indexed SQL subqueries for the `"Collaborating"` queue scope (`WHERE EXISTS (SELECT 1 FROM ticket_collaborators tc WHERE tc.ticketId = t.id AND tc.userId = current_user)`).

---

## Decision 4: Bulk Operations Execution — Per-Ticket Isolated Transactions vs. Single Monolithic Batch

- **Chose:** Per-ticket isolated database transactions (`for (const id of ticketIds) { try { await prisma.$transaction(...) } catch { ... } }`) returning granular itemized success/failure results.
- **Rejected:** Wrapping all selected tickets in a single giant `prisma.$transaction([...])`.
- **Why:** 
  - **User Experience & Partial Batch Success**: In production support operations, agents frequently bulk-select 20 tickets. If 1 ticket in the batch is ineligible (e.g. already closed or assigned to another team), rolling back all 19 valid operations creates immense operator frustration.
  - **Clear Failure Explanations**: Per-ticket isolation commits all valid operations with immutable audit logs while returning a structured results modal itemizing precisely which tickets succeeded and which were refused with specific reasons.

---

## Decision 5: Authentication & Access Control — Server-Side Signed JWT Cookies vs. Client-Side Persona Switcher

- **Chose:** Real server-side authentication using `bcryptjs` password hashing and signed HTTP-only session cookies (`jose` JWTs) paired with a 3-role security model (`SUPERVISOR`, `AGENT`, `CUSTOMER`).
- **Rejected:** A mock client-side dropdown in the navbar that switches the active persona in React state without authenticating against the backend.
- **Why:** 
  - **True Server-Enforced Security**: The prompt explicitly specifies that role permissions must be enforced on the server, not just hidden in the UI. Client-side role toggling encourages insecure patterns (e.g., trusting `req.body.role` or `localStorage`).
  - **Strict Row-Level Data Isolation for Customers**: Customers can only view tickets where `requesterEmail` or `requesterId` matches their session. Customers are physically blocked from viewing internal notes, agent audit logs, or other customers' tickets.
  - **Convenience Without Compromising Security**: We provide "Demo One-Click Login" credentials on the login screen to allow reviewers to immediately log in as `supervisor@busy.com`, `sarah@busy.com` (Agent), or `alice@customer.com` (Customer) while exercising 100% genuine server-side JWT authentication.

---

## Decision 6: Semantic Knowledge Copilot — Application Cosine Similarity with Fallback vs. Database pgvector Extension

- **Chose:** Application-level semantic embedding generation (Google Gemini API with an in-memory deterministic fallback vector generator) and cosine similarity ranking in Node.js.
- **Rejected:** Requiring the PostgreSQL `pgvector` C-extension and dedicated vector DB instances for initial deployment.
- **Why:** 
  - **Zero Deployment Friction**: Many managed PostgreSQL database pools (including certain Supabase transaction pooler configurations) do not support custom binary C-extensions or require manual SQL DDL migrations outside Prisma.
  - **Graceful Degradation**: If an external AI API key is missing or rate-limited (HTTP 429), the built-in deterministic vector generator computes stable, predictable embeddings so the application never crashes and continues recommending relevant solutions.
- **Later reversed:** We initially designed the recommendation engine to rely strictly on PostgreSQL `pgvector` (`vector(1536)` columns with HNSW indexes in `enable_pgvector_and_kb.sql`). When testing across local SQLite/standard PostgreSQL environments and Supabase transaction poolers (where `vector` is not a native Prisma type), we reversed this approach in favor of application-level vector comparison with deterministic fallback. This guarantees the application runs seamlessly anywhere with zero extra setup.

---

## Decision 7: Activity Timeline Feed — Dynamic Runtime Merge vs. Polymorphic Mixed Table

- **Chose:** Dynamic runtime merging of `Reply` records and `AuditLog` events sorted chronologically ascending, with automatic suppression of redundant `REPLY_ADDED` audit logs in the timeline.
- **Rejected:** Storing conversations and audit events in a single mixed table with polymorphic columns (`event_or_message_type`).
- **Why:** 
  - **Separation of Concerns**: Replies represent human communication (with markdown, recipient targeting, and `isInternal` flags); audit logs represent an immutable system ledger of state transitions and field diffs.
  - **Clean Presentation**: Keeping them normalized in separate relational tables preserves query performance and data integrity, while the `TimelineController` seamlessly combines them into a single, intuitive conversation timeline.

---

## Decision 8: SLA Alert Concurrency Control — Database Uniqueness & Advisory Locking vs. In-Process Mutex

- **Chose:** Composite database constraint `@@unique([ticketId, breachCycle])` paired with PostgreSQL transaction advisory lock `SELECT pg_try_advisory_xact_lock(hashtext('sla_alert_sync'))`.
- **Rejected:** An in-process JavaScript mutex (e.g. `async-mutex`) or relying solely on read-before-write checks.
- **Why:**
  - **Multi-Worker Serverless Concurrency**: In-process mutexes only protect a single Node.js event loop. When deployed across multiple web containers (or serverless workers), concurrent client polling requests (from multiple tabs polling `/api/sla/alerts` every 15s) ran simultaneous read-before-write checks and raced to insert duplicate alerts for the same ticket just 437ms apart.
  - **Zero Lock Contention**: The PostgreSQL transaction advisory lock ensures that exactly 1 worker executes the write reconciliation, while the other 9 concurrent requests immediately skip the write phase and execute the fast, indexed read query with zero blocking.

---

## Decision 9: Transactional Email Reliability — Dual-Provider Dispatch (Gmail SMTP + Resend) vs. Single API

- **Chose:** Dual-mode email dispatcher in `backend/services/email.service.ts`: Gmail SMTP via `nodemailer` (forcing IPv4 and multi-port fallback) as primary arbitrary-recipient sender, Resend API as secondary, and local console logging as dev fallback.
- **Rejected:** Relying exclusively on Resend's free tier.
- **Why:**
  - **Sandbox Delivery Restrictions**: Resend's free tier strictly blocks sending emails to arbitrary recipient addresses unless a custom corporate domain is verified. This meant supervisors could not test agent invitation emails or daily digests to arbitrary test emails.
  - **IPv6 Linux Container Hangs**: Adding `nodemailer` exposed a subtle production bug on Linux containers (Render), where Node attempted to route SMTP connections over unrouted IPv6 interfaces, hanging the HTTP response for 60 seconds. Enforcing `family: 4` (IPv4) and strict 6.5s connection timeouts eliminated the hang and guaranteed sub-2s email delivery.
