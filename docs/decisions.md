# Architectural Decisions & Trade-off Rationales

This document records the definitive architectural decisions, trade-offs, and design rationale formulated during the development of the BusyDesk Support Ticketing platform.

---

## Decision 1: Layered Backend Architecture (`routes/` vs `controllers/` vs `models/policies/`)

- **Chose:** A clean four-tier backend architecture:
  1. **Route Layer (`backend/routes/`)**: Encapsulates HTTP protocol concerns, query/body parameter parsing, and status code mapping. Includes a centralized `API_ROUTE_REGISTRY` catalog.
  2. **Policy Layer (`backend/models/policies/`)**: Pure authorization predicates evaluated against database user session objects (`TicketPolicy`, `ReplyPolicy`, `CollaboratorPolicy`, `AlertPolicy`).
  3. **Controller Layer (`backend/controllers/`)**: Pure domain logic, state machine transitions, SLA calculations, and database transactions decoupled from HTTP objects.
  4. **Data Access Layer (`backend/db/` & `backend/prisma/`)**: Prisma ORM models and PostgreSQL schema.
- **Rejected:** Inlining database queries directly inside Next.js `app/api/.../route.ts` handlers or using fat controller classes that mix HTTP handling with SQL logic.
- **Why:** 
  - **Single Point of Visibility for Routing**: Having a dedicated `backend/routes/` folder makes it trivial for any engineer or reviewer to see all API endpoints at once without digging through 20 levels of nested directory trees in `app/api/`.
  - **100% Testability Without Mocking HTTP**: Controllers can be tested directly with TypeScript objects without mocking Next.js `Request`/`Response` streams or cookie headers.
  - **Separation of Policy from Execution**: Security rules are defined in isolated policy classes that are evaluated both during mutations and when computing client UI permission flags.

---

## Decision 2: SLA Engine (Mathematical Deadline State vs Continuous Polling Daemon)

- **Chose:** Mathematical deadline modeling storing `slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`, and `slaCycle`.
- **Rejected:** A background cron job or interval daemon polling every 30–60 seconds to decrement an integer `remainingSeconds` column for all active tickets.
- **Why:** 
  - **Zero Database Write Amplification**: An open ticket requires **zero database writes** while sitting in the queue. The SLA countdown is calculated mathematically (`slaDueAt - Date.now()`) on the client browser.
  - **Precision Across Pauses**: When a ticket transitions to `PENDING` (awaiting customer), `slaPausedRemainingSeconds = max(0, Math.floor((slaDueAt - now) / 1000))` is computed and saved once. When the customer replies, `slaDueAt = now + slaPausedRemainingSeconds` resumes the clock with zero drift.
  - **Multi-Cycle Breach Tracking**: If a ticket breaches, is paused, or reopened, `slaCycle` increments to ensure that new SLA alerts are tracked independently without overwriting previous historical breach records.

---

## Decision 3: Collaboration Model (Normalized Join Table vs JSON Array)

- **Chose:** Normalized relational join table `ticket_collaborators` with composite primary key `(ticketId, userId)` and foreign key cascade rules.
- **Rejected:** Storing collaborator user IDs as a JSON array (`collaboratorIds: string[]`) or comma-delimited string on the `Ticket` table.
- **Why:** 
  - **Referential Integrity**: Guarantees that only valid, existing `User` records can be added as collaborators. If an agent account is deleted, foreign keys handle clean cascade or validation.
  - **Database-Level Uniqueness**: `UNIQUE(ticketId, userId)` prevents race conditions from inserting duplicate collaborator records.
  - **High-Performance Queue Joins**: Enables efficient indexed SQL subqueries for the `"Collaborating"` queue scope (`WHERE EXISTS (SELECT 1 FROM ticket_collaborators tc WHERE tc.ticketId = t.id AND tc.userId = current_user)`).

---

## Decision 4: Bulk Operations Execution (Per-Ticket Isolated Transactions vs Single Monolithic Batch)

- **Chose:** Per-ticket isolated database transactions (`for (const id of ticketIds) { try { await prisma.$transaction(...) } catch { ... } }`) returning granular itemized success/failure results.
- **Rejected:** Wrapping all selected tickets in a single giant `prisma.$transaction([...])`.
- **Why:** 
  - **User Experience & Partial Batch Success**: In production support operations, agents frequently bulk-select 20 tickets. If 1 ticket in the batch is ineligible (e.g. already closed or assigned to another team), rolling back all 19 valid operations creates immense operator frustration.
  - **Clear Failure Explanations**: Per-ticket isolation commits all valid operations with immutable audit logs while returning a structured results modal itemizing precisely which tickets succeeded and which were refused with specific reasons.

---

## Decision 5: Authentication & Security (Server-Side Cryptographic JWTs vs Client-Side Persona Switcher)

- **Chose:** Real server-side authentication using `bcryptjs` password hashing and signed HTTP-only session cookies (`jose` JWTs) paired with a 3-role security model (`SUPERVISOR`, `AGENT`, `CUSTOMER`).
- **Rejected:** A mock client-side dropdown in the navbar that switches the active persona in React state without authenticating against the backend.
- **Why:** 
  - **True Server-Enforced Security**: The prompt explicitly specifies that role permissions must be enforced on the server, not just hidden in the UI. Client-side role toggling encourages insecure patterns (e.g., trusting `req.body.role` or `localStorage`).
  - **Strict Row-Level Data Isolation for Customers**: Customers can only view tickets where `requesterEmail` matches their session. Customers are physically blocked from viewing internal notes, agent audit logs, or other customers' tickets.
  - **Convenience Without Compromising Security**: We provide "Demo One-Click Login" credentials on the login screen to allow reviewers to immediately log in as `supervisor@busy.com`, `sarah@busy.com` (Agent), or `john@acme.com` (Customer) while exercising 100% genuine server-side JWT authentication.

---

## Decision 6: Decoupled Independent Frontend & Backend Services

- **Chose:** Two separate top-level modules (`frontend/` on Port 3000 and `backend/` on Port 3001), each with its own `package.json`, isolated `node_modules/`, `tsconfig.json`, and `.env`.
- **Rejected:** A monolithic single-folder Next.js application where server routes, database ORM code, and client UI components share dependencies.
- **Why:** 
  - **Zero Bundle Pollution & Security**: Client UI bundles can never accidentally import server-only database code, Prisma ORM binaries, or backend database connection secrets.
  - **Independent Deployability**: The frontend (static or edge-rendered UI) and backend (REST API server / microservice) can be deployed and scaled on independent infrastructure.
  - **Clean CI/CD**: Backend unit and integration tests run in seconds (`npm test` in `backend/`) without compiling the Next.js frontend application.

---

## Decision 7: Unified Activity Feed Merging Strategy

- **Chose:** Dynamic runtime merging of `Reply` records and `AuditLog` events sorted chronologically ascending, with automatic suppression of redundant `REPLY_ADDED` audit logs in the timeline.
- **Rejected:** Storing conversations and audit events in a single mixed table with polymorphic columns.
- **Why:** 
  - **Separation of Concerns**: Replies represent human communication (with markdown, recipient targeting, and `isInternal` flags); audit logs represent an immutable system ledger of state transitions and field diffs.
  - **Clean Presentation**: Keeping them normalized in separate relational tables preserves query performance and data integrity, while the `TimelineController` seamlessly combines them into a single, intuitive conversation timeline.

---

## Decision 8: Query-Level Data Isolation (Row-Level Security)

- **Chose:** Enforcing role-based data isolation at the Prisma query construction level across all repository endpoints.
- **Rejected:** Fetching all tickets and filtering out forbidden records in memory after database retrieval.
- **Why:** 
  - **Security & Data Privacy**: Filtering in memory wastes database I/O, leaks pagination metadata (e.g. incorrect `totalCount`), and risks catastrophic data leaks if an in-memory filter has a bug.
  - **High Performance**: Query-level constraints (`where: { requesterEmail: user.email }` for customers; `where: { archivedAt: null }` for active queues) are pushed directly to PostgreSQL, utilizing composite B-tree indexes for single-digit millisecond query execution.
