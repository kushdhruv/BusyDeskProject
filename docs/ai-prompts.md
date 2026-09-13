# AI prompts

The prompts you actually used, in the order you used them, grouped by what you were trying to achieve. For each significant one: what you asked, what you got back, and what you had to correct.

Include at least one prompt that produced something wrong, and what you did about it.

If you did not use AI at all, say so here, and describe your process instead.

---

## 1. System Architecture & Requirements Clarification

### Prompt
> *"Act as a senior support platform architect. Analyze our existing support ticketing system requirements and identify the single highest-value architectural patterns that fit a production-ready Next.js + Prisma + Supabase stack. Help me design clean boundaries between routing, policies, controllers, and database access while avoiding unnecessary complexity."*

### What you got
- A proposed 4-tier layered architecture separating HTTP routing (`backend/routes/`), security authorization policies (`backend/models/policies/`), domain controllers (`backend/controllers/`), and the data tier (`backend/prisma/`).
- Initial guidance on mathematical deadline tracking for SLAs and normalized join table modeling for agent collaborations.

### What you corrected
- The initial response suggested putting all API logic directly inside Next.js `app/api/.../route.ts` files. We corrected this to enforce a dedicated `backend/routes/` layer with an explicit `API_ROUTE_REGISTRY` catalog, keeping the Next.js API routes as clean, 1-line delegate re-exports. This made all endpoints discoverable in one place and 100% testable without mocking Next.js HTTP contexts.

---

## 2. SLA Clock Modeling & State Machine Edge Cases

### Prompt
> *"Model the SLA response time tracking for our ticket lifecycle (New -> Open -> Pending -> Resolved -> Closed). In particular, when a ticket enters Pending, it is waiting on customer reply and the clock must pause. When the customer replies, it returns to Open and resumes. How should the database schema and calculation service handle this without causing performance issues?"*

### What you got (Problematic Output)
- The initial AI response proposed adding an integer column `remainingSeconds` to the `tickets` table and scheduling a background cron job or `setInterval` worker running every 60 seconds to execute `UPDATE tickets SET remainingSeconds = remainingSeconds - 60 WHERE status = 'OPEN'`.

### What you corrected
- We rejected this pattern immediately: running periodic mass database writes causes massive write amplification, lock contention, and clock drift across thousands of open tickets.
- We instructed the model to switch to **pure mathematical deadline modeling**:
  > *"Do not decrement integer counters in the database. Instead, store `slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`, and `slaCycle`. Compute remaining active seconds once when transitioning to Pending. When the customer replies, compute `slaDueAt = now() + slaPausedRemainingSeconds` to resume with zero drift. Sit in the queue with ZERO database writes, and calculate live 1-second countdowns on the client browser."*
- This became the core zero-write SLA engine implemented in `backend/controllers/sla.controller.ts`.

---

## 3. Bulk Operations & Partial Success Reporting

### Prompt
> *"Implement the bulk reassign and bulk close endpoints for supervisors. When a supervisor selects 20 tickets from the queue, some tickets may be invalid or already closed. How should database transactions and API responses be structured?"*

### What you got (Problematic Output)
- The initial response wrapped the entire batch in a single monolithic transaction:
  ```ts
  await prisma.$transaction(ticketIds.map(id => prisma.ticket.update(...)))
  ```
  If any single ticket in the selection failed validation (e.g. attempting to close an already-closed ticket), the entire batch was rejected.

### What you corrected
- We rejected the all-or-nothing batch model because it violates the assignment's explicit rule: *"Because some tickets in the selection may not be eligible for the move, the result must report per ticket what succeeded and what was refused and why, not just fail the whole batch."*
- We restructured the implementation in `backend/controllers/bulk.controller.ts` to execute **per-ticket isolated transactions** within a `for...of` loop:
  - Valid tickets commit their state change and append an immutable `AuditLog` event.
  - Invalid tickets catch exceptions, record the specific refusal reason, and continue processing remaining tickets.
  - The API returns a structured `{ succeeded: [...], failed: [...] }` payload displayed in an itemized summary modal.

---

## 4. Decoupled Microservices Architecture Refactoring

### Prompt
> *"Convert this codebase into a production-ready decoupled architecture with independent frontend and backend modules. Ensure dependencies, package files, tsconfig, and env files are strictly isolated between `frontend/` (Port 3000) and `backend/` (Port 3001) with clean reverse-proxy rewrites."*

### What you got
- Separated directory structure with `frontend/package.json` and `backend/package.json`.
- Next.js proxy rewrites in `frontend/next.config.js` forwarding `/api/:path*` to `http://localhost:3001/api/:path*`.
- CORS middleware in `backend/middlewares/cors.middleware.ts` supporting credentials and cross-origin preflight requests.

### What you corrected
- The initial Next.js rewrites configuration omitted HTTP cookie forwarding headers for cross-port communication. We configured proper credentials transmission (`credentials: "include"`, `SameSite=Lax`) to ensure the signed HTTP-only JWT session cookie is seamlessly exchanged between port 3000 and port 3001 in local development.

---

## 5. Semantic Knowledge Copilot & Vector Search

### Prompt
> *"We want to build a Semantic Knowledge Copilot that recommends similar resolved tickets and KB articles directly above the reply composer. How should we implement the vector search and embedding generation while ensuring the system runs reliably across both local development and cloud production without requiring expensive vector databases?"*

### What you got (Problematic Output)
- The initial proposal required enabling the PostgreSQL `pgvector` C-extension and creating raw SQL migrations with HNSW indexes. In standard Supabase transaction pooler configurations (port 6543) and lightweight local environments, `vector` types cannot be managed natively by Prisma CLI schema pushes.

### What you corrected
- We pivoted to a resilient **application-level hybrid architecture** in `backend/services/embedding.service.ts`:
  - Uses the Google Gemini API (`text-embedding-004`) for high-dimensional semantic embeddings.
  - Built-in **deterministic vector generator fallback**: if the API key is absent, invalid, or hits rate limits (HTTP 429), the engine automatically switches to a deterministic vector generator that hashes keywords into 1536-dimensional space.
  - Computes cosine similarity in memory across candidate resolutions above a safe 0.72 threshold.
  - Zero crashes, zero database C-extension prerequisites, and 100% portable across any PostgreSQL or SQLite environment.

---

## 6. Secure Agent Invitation & Setup Account Route Whitelisting

### Prompt
> *"We built the agent invitation system where supervisors invite new agents at `/team`, generating a 24-hour single-use token sent via Resend email. But when opening the setup link (`/setup-account?token=...`), the user is immediately blocked and kicked to `/login`. Debug why."*

### What you got
- Analysis pinpointing that the token was valid, but the client routing shell was redirecting unauthenticated visitors.

### What you corrected
- In `frontend/components/AppShell.tsx`, line 23 only whitelisted `/login` and `/register` as public pages:
  ```tsx
  const isAuthPage = pathname === "/login" || pathname === "/register";
  useEffect(() => {
    if (!loading && !user && !isAuthPage) router.push("/login");
  }, [loading, user, isAuthPage]);
  ```
  Since `/setup-account` was not included in `isAuthPage`, anyone opening an invite link without an active session was instantly redirected to `/login`.
- We corrected this by adding `/setup-account` to `isAuthPage`, allowing newly invited agents to validate their token, enter their password, and activate their account cleanly.

---

## 7. Automated Test Suite Generation

### Prompt
> *"Generate comprehensive automated unit and integration tests using Vitest that cover business rule invariants: 3-role authorization, state machine transitions, 7-day reopen window guard, SLA pause/resume math, multi-cycle breach alert resets, bulk partial success, customer row-level security isolation, and race-condition fuzzing under concurrent transactions."*

### What you got
- 25 modular test suites in `backend/tests/` covering unit tests, route handlers, security invariants, customer data isolation, and fuzz testing.

### What you corrected
- Initial tests used hardcoded dates which failed when asserting elapsed SLA seconds due to execution latency. Refactored all time-sensitive assertions to use relative timestamp deltas (`expect(diff).toBeCloseTo(...)`) or dynamic `Date.now()` calculations, ensuring 100% deterministic test execution across any machine.
