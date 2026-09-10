# Architectural Decisions

This document records the key architectural choices made during the design and implementation of the Busy Infotech Support Ticketing platform.

---

## Decision 1: Architecture Pattern (Modular Monolith vs. Microservices)

- **Chose:** Pragmatic Modular Monolith using Next.js App Router (TypeScript), Prisma ORM, and PostgreSQL. Domain logic is cleanly isolated in `/lib/services/` and `/lib/policies/`.
- **Rejected:** Distributed microservices (e.g. separate Auth Service, Ticket Service, SLA Worker, Notification Bus via Kafka/RabbitMQ).
- **Why:** The system is a cohesive, relational domain with strong transactional consistency requirements (e.g. atomic ticket status updates + audit log entries). Microservices would introduce network serialization overhead, distributed transaction failures (two-phase commits), deployment fragility, and significant complexity without providing any performance or organizational benefit for a system scoped for a ~12-hour build.

---

## Decision 2: SLA Engine (Deadline-Based Mathematical State vs. Continuous DB Writes)

- **Chose:** Deadline-based SLA modeling storing `slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`, and `slaCycle`.
- **Rejected:** Background daemon polling every 60 seconds to decrement an integer countdown column (`remainingSeconds`) in the database for all open tickets.
- **Why:** Continuous database writes create unnecessary I/O write amplification, database lock contention, and drift. By storing an effective `slaDueAt` timestamp, active tickets require **zero periodic database writes**. When a ticket enters `PENDING`, remaining active seconds are computed once and stored in `slaPausedRemainingSeconds`. When resumed via a customer reply, `slaDueAt = now() + slaPausedRemainingSeconds`. The browser computes live second-by-second countdowns locally from `slaDueAt - Date.now()`.

---

## Decision 3: Collaboration Model (Normalized Join Table vs. Denormalized JSON Array)

- **Chose:** Normalized relational join table `ticket_collaborators` with composite uniqueness `UNIQUE(ticketId, userId)` and foreign key cascade rules.
- **Rejected:** Storing collaborator user IDs as a JSON array (`collaboratorIds: string[]`) or comma-separated string column on the `Ticket` table.
- **Why:** A normalized table guarantees referential integrity, prevents duplicate collaborator entries at the database level, enables efficient bidirectional indexing (`(userId, ticketId)`), and allows direct SQL joins for agent queue queries (`where: { collaborators: { some: { userId: user.id } } }`) without relying on database-specific JSON operators.

---

## Decision 4: Bulk Operations Execution (Per-Ticket Isolated Transactions vs. Single Batch Transaction)

- **Chose:** Per-ticket isolated transactions allowing partial batch success, where each ticket mutation + audit log entry is committed atomically in its own database transaction.
- **Rejected:** Wrapping the entire bulk selection in a single giant database transaction.
- **Why:** The assignment brief explicitly requires reporting per-ticket what succeeded and what was refused and why. If a batch of 10 tickets contains 1 ineligible ticket (e.g. already closed), wrapping the entire batch in one transaction would roll back the 9 valid tickets. Per-ticket isolation guarantees that valid operations are committed with immutable audit logs while returning granular refusal reasons in a structured response modal.

---

## Decision 5: Authentication Strategy & Persona Evaluation

- **Chose:** Real server-side email/password authentication using `bcryptjs` password hashing and signed HTTP-only session cookies (`jose`), paired with quick "Fill Demo Credentials" helper buttons on the login form for reviewer convenience.
- **Rejected:** A client-side "Role Switcher" dropdown in the header that switches between Supervisor and Agent personas without authenticating against the backend.
- **Why:** Goal 1 explicitly requires that role permissions must be enforced on the server, not merely hidden in the interface. A client-side role toggle encourages insecure patterns (such as trusting `req.body.role` or `localStorage.role`). Real server-side authentication with distinct seeded accounts (`supervisor@busy.com`, `sarah@busy.com`, etc.) ensures the backend is the sole authority for identity and permissions on every request.
- **Later reversed:** Early in the planning phase, we considered adding a fast client-side persona dropdown in the top navbar for convenience during manual testing. We reversed this decision to ensure the implementation strictly adheres to production security standards where identity is always resolved from a verified, server-side session cookie.
