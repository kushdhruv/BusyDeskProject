# AI prompts

The prompts actually used during development, in chronological working order, grouped by what was being achieved. For each significant prompt: what was asked, what came back, and the critical engineering corrections made.

---

## 1. System Architecture & Boundaries

### Prompt
> *"Act as a senior support platform architect. Analyze our support ticketing system requirements and identify the cleanest architectural pattern for a production-minded Next.js + Prisma + PostgreSQL stack. Help me design boundaries between routing, security authorization policies, domain controllers, and database access."*

### What you got
- A proposed 4-tier layered architecture separating HTTP routing, authorization policies, domain controllers, and the Prisma data tier.
- However, the initial response suggested placing all controller logic, query parameter parsing, and Prisma queries directly inside Next.js `app/api/.../route.ts` handlers.

### What you corrected
- I rejected putting business logic inside Next.js route files. Coupling controllers to Next.js `NextRequest`/`NextResponse` objects makes them difficult to unit test without heavy mocking and creates vendor lock-in.
- I enforced a dedicated `backend/routes/` layer with an explicit `API_ROUTE_REGISTRY` catalog, pure predicate authorization functions in `backend/models/policies/` (`TicketPolicy`, `ReplyPolicy`), and domain controllers in `backend/controllers/`.
- The Next.js API route files (`backend/app/api/.../route.ts`) were reduced to clean one-line delegates pointing to `@/routes`. This made all 44 endpoints discoverable in a single file and 100% testable in Vitest.

---

## 2. SLA Clock Modeling & Lifecycle State Machine

### Prompt
> *"Model the SLA response time tracking for our ticket lifecycle (New -> Open -> Pending -> Resolved -> Closed). In particular, when a ticket enters Pending, it is waiting on customer reply and the clock must pause. When the customer replies, it returns to Open and resumes. How should the database schema and calculation service handle this without causing performance issues?"*

### What you got (Problematic Output)
- The initial AI response proposed adding an integer column `remainingSeconds` to the `tickets` table and scheduling a background cron job or `setInterval` worker running every 60 seconds to execute:
  ```sql
  UPDATE tickets SET remainingSeconds = remainingSeconds - 60 WHERE status = 'OPEN';
  ```

### What you corrected
- I strongly rejected this pattern. In a ticketing system with 5,000 open tickets, a background polling worker executes 300,000 write queries every hour on tickets that are sitting completely idle. This creates severe database write amplification, row-level lock contention, and cumulative clock drift across process restarts.
- I instructed the AI to pivot to **pure mathematical deadline modeling**:
  > *"Do not decrement integer counters in the database. Instead, store `slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`, and `slaCycle`. Compute remaining active seconds once when transitioning to Pending. When the customer replies, compute `slaDueAt = now() + slaPausedRemainingSeconds` to resume with zero drift. Sit in the queue with ZERO database writes, and calculate live 1-second countdowns on the client browser."*
- This became the zero-write SLA engine implemented in `backend/controllers/sla.controller.ts`.

---

## 3. Bulk Operations & Partial Success Reporting

### Prompt
> *"Implement the bulk reassign and bulk close endpoints for supervisors. When a supervisor selects 20 tickets from the queue, some tickets may be invalid or already closed. How should database transactions and API responses be structured?"*

### What you got (Problematic Output)
- The initial response wrapped the entire batch in a single monolithic transaction:
  ```ts
  await prisma.$transaction(ticketIds.map(id => prisma.ticket.update(...)))
  ```
  If any single ticket in the selection failed validation (e.g. attempting to close an already-closed ticket), the entire transaction rolled back and rejected all 20 tickets.

### What you corrected
- I rejected the all-or-nothing batch model because it violates the assignment's explicit rule: *"Because some tickets in the selection may not be eligible for the move, the result must report per ticket what succeeded and what was refused and why, not just fail the whole batch."*
- I restructured `backend/controllers/bulk.controller.ts` to execute **per-ticket isolated transactions** within a `for...of` loop:
  - Valid tickets commit their state change and append an immutable `AuditLog` event.
  - Ineligible tickets catch exceptions, record the specific refusal reason, and continue processing remaining tickets.
  - The API returns a structured `{ totalRequested, successCount, failureCount, results: [...] }` payload displayed in an itemized summary modal.

---

## 4. Decoupled Microservices Architecture Refactoring

### Prompt
> *"Convert this codebase into a production-ready decoupled architecture with independent frontend and backend modules. Ensure dependencies, package files, tsconfig, and env files are strictly isolated between `frontend/` (Port 3000) and `backend/` (Port 3001) with clean reverse-proxy rewrites."*

### What you got
- Separated directory structure with `frontend/package.json` and `backend/package.json`.
- Next.js proxy rewrites in `frontend/next.config.js` forwarding `/api/:path*` to `http://localhost:3001/api/:path*`.
- CORS middleware in `backend/middlewares/cors.middleware.ts`.

### What you corrected
- The initial Next.js rewrites configuration dropped HTTP cookie forwarding headers during cross-port communication in local development, causing all authenticated API requests from the frontend to fail with `401 Unauthorized`.
- I configured proper credentials transmission (`credentials: "include"`, `SameSite=Lax`) and explicit cookie header passthroughs in `frontend/lib/api-client.ts` to ensure the signed HTTP-only JWT session cookie was seamlessly exchanged between port 3000 and port 3001.

---

## 5. SLA Alert Concurrency & Duplicate Prevention

### Prompt
> *"During multi-tab testing, we noticed that polling `/api/sla/alerts` every 15 seconds creates duplicate active alert rows in the database for the same ticket (created just 437ms apart). How do we eliminate this race condition and optimize polling latency?"*

### What you got
- The AI initially suggested wrapping the alert reconciliation logic in an in-process Node.js mutex (e.g. `async-mutex`).

### What you corrected
- An in-process mutex is useless in clustered or serverless deployments (Render/Vercel) because each container or serverless function runs in an independent Node.js process and cannot see another process's mutex.
- I directed the implementation of a **two-layer database concurrency lock**:
  1. **Storage-Level Uniqueness**: Added `@@unique([ticketId, breachCycle])` to `schema.prisma`, making it physically impossible for the database engine to store duplicate alerts for the same breach cycle.
  2. **PostgreSQL Transaction Advisory Locking**: In `SlaController.syncAllAlertsSetBased`, added:
     ```sql
     SELECT pg_try_advisory_xact_lock(hashtext('sla_alert_sync')) AS acquired;
     ```
     When 10 concurrent requests arrive from multiple open browser tabs, exactly 1 acquires the lock and executes the write reconciliation, while the other 9 immediately skip the write phase and execute the fast, indexed read query with zero lock waiting.

---

## 6. Semantic Knowledge Copilot & Vector Search

### Prompt
> *"We want to build a Semantic Knowledge Copilot that recommends similar resolved tickets and KB articles directly above the reply composer. How should we implement the vector search and embedding generation while ensuring the system runs reliably across both local development and cloud production without requiring expensive vector databases?"*

### What you got (Problematic Output)
- The initial proposal required enabling the PostgreSQL `pgvector` C-extension and creating raw SQL migrations with HNSW indexes. In standard Supabase transaction pooler configurations (port 6543) and lightweight local environments, `vector` types cannot be managed natively by Prisma CLI schema pushes.
- Additionally, the AI set a hardcoded cosine similarity threshold of `0.72`. Because realistic ticket-to-article similarity often scores around 0.50–0.65, the UI panel received zero matches and silently collapsed (`return null`).

### What you corrected
- I redesigned the recommendation engine as an **application-level hybrid service** in `backend/services/embedding.service.ts`:
  - Uses the Google Gemini API (`text-embedding-004`) for high-dimensional semantic embeddings when configured.
  - Built-in **deterministic vector generator fallback**: if the API key is absent, invalid, or hits rate limits (HTTP 429), it automatically switches to a deterministic n-gram hashing algorithm distributed across 1536 dimensions.
  - Calibrated similarity thresholds to `0.52` for high confidence and `0.22` for related matches, with a `+0.12` category affinity boost.
  - Replaced silent component collapsing in `SmartAssistPanel.tsx` with an active copilot status badge.

---

## 7. Secure Agent Invitation & Route Whitelisting Bug

### Prompt
> *"We built the agent invitation system where supervisors invite new agents at `/team`, generating a 24-hour single-use token sent via email. But when opening the setup link (`/setup-account?token=...`), the user is immediately blocked and kicked to `/login`. Debug why."*

### What you got
- Analysis pinpointing that the token was valid, but the client routing shell was redirecting unauthenticated visitors before the page component could read the query parameters.

### What you corrected
- In `frontend/components/AppShell.tsx`, line 23 only whitelisted `/login` and `/register` as public pages:
  ```tsx
  const isAuthPage = pathname === "/login" || pathname === "/register";
  useEffect(() => {
    if (!loading && !user && !isAuthPage) router.push("/login");
  }, [loading, user, isAuthPage]);
  ```
  Since `/setup-account` was not included in `isAuthPage`, anyone opening an invite link without an active session was instantly kicked to `/login`.
- I corrected this by adding `/setup-account` to `isAuthPage`, allowing newly invited agents to validate their token, enter their password, and activate their account cleanly.

---

## 8. Transactional Email & Linux Container IPv6 SMTP Hangs

### Prompt
> *"Resend's free tier sandbox restricts email deliveries strictly to the account owner's email address. We need to add Gmail SMTP via nodemailer as a universal fallback so supervisors can test invitations and queue digests with any email address. How do we configure this reliably?"*

### What you got
- The AI provided a standard `nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, ... })` implementation.
- In production on Render (Linux container environment), calling `sendMail` hung for 60 seconds before failing with a connection timeout.

### What you corrected
- I diagnosed that Node.js inside the Linux container was attempting to resolve `smtp.gmail.com` to an IPv6 address that had no outbound route in the container network, causing the socket connection to stall indefinitely.
- I hardened `backend/services/email.service.ts`:
  1. Forced IPv4 DNS resolution by passing `family: 4` into nodemailer transport options.
  2. Implemented dual-port fallback (attempting port 587 first, then port 465).
  3. Added an explicit `Promise.race` with a strict 6.5-second timeout per attempt to guarantee that API requests never hang indefinitely.

---

## 9. Automated Test Suite Generation & Assertion Flakiness

### Prompt
> *"Generate comprehensive automated unit and integration tests using Vitest covering business rule invariants: 3-role authorization, state machine transitions, 7-day reopen window guard, SLA pause/resume math, multi-cycle breach alert resets, bulk partial success, customer row-level security isolation, and race-condition fuzzing under concurrent transactions."*

### What you got
- 25 modular test suites in `backend/tests/` covering unit tests, route handlers, security invariants, customer data isolation, and fuzz testing.

### What you corrected
- Initial tests used hardcoded timestamp arithmetic (`expect(ticket.slaDueAt.getTime()).toBe(targetTime)`), which occasionally failed by 10–50ms due to execution latency between transaction execution and test evaluation.
- I refactored all time-sensitive assertions to use relative timestamp deltas (`expect(diff).toBeCloseTo(...)`) or dynamic `Date.now()` bounds, ensuring 100% deterministic test execution across any machine.
