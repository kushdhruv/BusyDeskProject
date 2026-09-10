# AI Prompt Log & Iteration History

This document records the prompts used throughout the architecture planning, schema modeling, service implementation, and testing phases of the project, including corrections where initial outputs required refinement.

---

## 1. Architectural Alignment & Requirements Clarification

### Prompt 1.1: System Requirements & Scope Alignment
> *"Act as a senior software engineer and pragmatic system architect. Read all 10 requirements from the take-home assignment brief. Review my initial notes in talk1.md and help me design a production-minded modular monolith architecture that avoids unnecessary microservices or infrastructure."*

**Outcome:**
- Established modular monolith architecture using Next.js App Router, Prisma ORM, and PostgreSQL.
- Defined domain service boundaries in `/lib/services/` and confirmed zero-polling SLA calculation approach.

---

## 2. Policy Layer & Authorization Design

### Prompt 2.1: Centralized Role Policies vs. Route Logic
> *"How should we structure role-based authorization for Supervisors and Agents? In particular, Supervisors can reassign and close tickets, while Agents can only act on tickets where they are primary assignee or collaborator and cannot reassign away from themselves. Should this be inline in routes or separate?"*

**Outcome:**
- Created dedicated `/lib/policies/` directory containing `TicketPolicy`, `ReplyPolicy`, `CollaboratorPolicy`, and `AlertPolicy`.
- Enabled the consolidated `GET /api/tickets/:id` endpoint to return caller `permissions` dynamically so UI buttons automatically reflect server authorization.

---

## 3. SLA Modeling & Edge Cases (Correction & Learning)

### Prompt 3.1: Handling SLA Clock Pause and Resume Math
> *"Model the SLA pause/resume math for Pending status. What fields should the Ticket table store to avoid continuous background writes?"*

**Initial AI Output (Problematic):**
- Suggested storing `slaRemainingSeconds` as an active countdown column and running a cron job every 60 seconds to decrement it across all open tickets.

**Correction & Refinement:**
> *"Continuous DB updates cause write amplification and database locking. Instead, store `slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`, and `slaCycle`. Compute remaining active seconds once when entering Pending, and recalculate `slaDueAt = now() + slaPausedRemainingSeconds` when the customer replies. Live countdowns should be computed client-side."*

**Final Outcome:**
- Implemented state-driven SLA math in `SlaService.ts` with zero periodic database writes and accurate client-side live countdowns.

---

## 4. Bulk Operations & Partial Success Reporting

### Prompt 4.1: Atomic Batch Transactions
> *"Implement the bulk reassign and bulk close endpoint. How should database transactions be structured when some tickets in the selection may be invalid or unauthorized?"*

**Initial AI Output (Problematic):**
- Wrapped the entire array of ticket updates in a single `prisma.$transaction([ ... ])`.

**Correction & Refinement:**
> *"The brief requires per-ticket reporting of what succeeded and what was refused and why. Wrapping the whole batch in one transaction means one invalid ticket fails all valid tickets. Refactor to per-ticket isolated transactions so valid tickets commit with audit logs and invalid tickets return granular refusal reasons."*

**Final Outcome:**
- Built `BulkService.ts` with per-ticket try/catch transactions, returning a structured summary modal.

---

## 5. Automated Invariant Testing

### Prompt 5.1: Vitest Test Suite Generation
> *"Write an automated integration test suite in Vitest testing all core business invariants: role authorization, state machine transitions, 7-day reopen guard, SLA pause/resume, SLA alert cycles upon reopening, bulk partial success, archive queue isolation, and transaction atomicity rollback."*

**Outcome:**
- Generated `tests/business-rules.test.ts` with 11 automated test cases. All tests passed with 100% success on the initial run.

---

## 6. Decoupled Microservice Refactoring & Dependency Isolation

### Prompt 6.1: Microservices Architecture & Directory Re-structure
> *"Convert this codebase into a microservices-ready decoupled architecture with independent frontend and backend modules. Delete root package.json and node_modules. Move all client UI code into `frontend/` and REST API / domain services into `backend/`, keeping dependencies, package files, tsconfig, and env files strictly separated with independent run commands."*

**Outcome:**
- Separated project into top-level `frontend/` (Port 3000) and `backend/` (Port 3001) modules.
- Created independent `frontend/package.json` and `backend/package.json` with zero root-level dependency coupling.
- Implemented CORS middleware in `backend/cors.ts` and Next.js proxy rewrites in `frontend/next.config.js`.
- Verified 100% test passing (104/104 tests inside `backend/`) and independent production compilation builds for both services.
