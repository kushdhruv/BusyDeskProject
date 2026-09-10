# Database Schema Documentation

## 1. Relational Table Definitions

### 1. `users`
Represents all system actors across the three distinct access tiers (Supervisors, Support Agents, and Customers).
- `id` (`String` / `cuid`, Primary Key) — Unique user identifier.
- `email` (`String`, Unique) — User's unique login and contact email address.
- `passwordHash` (`String`) — Salted bcrypt hash of the user's password.
- `name` (`String`) — Full name.
- `role` (`Enum: SUPERVISOR | AGENT | CUSTOMER`, Default: `AGENT`) — System access tier.
- `createdAt` (`DateTime`, Default: `now()`) — User registration timestamp.
- `updatedAt` (`DateTime`, Auto-update) — Last modification timestamp.

---

### 2. `tickets`
Core support entity containing metadata, ownership, state-machine lifecycle, SLA timestamps, and soft-archive state.
- `id` (`String` / `cuid`, Primary Key) — Unique ticket UUID.
- `ticketNumber` (`Int`, Unique, Auto-increment) — Human-readable reference number (e.g. `#101`).
- `subject` (`String`) — Brief summary of the issue.
- `description` (`Text`) — Detailed problem statement.
- `requesterId` (`String`, Foreign Key $\rightarrow$ `users.id`) — Registered customer user account.
- `requesterName` (`String`) — Requester display name.
- `requesterEmail` (`String`) — Requester contact email.
- `priority` (`Enum: LOW | MEDIUM | HIGH | URGENT`, Default: `MEDIUM`) — SLA urgency classification.
- `category` (`Enum: BUG | BILLING | FEATURE | QUESTION`, Default: `QUESTION`) — Functional domain classification.
- `status` (`Enum: NEW | OPEN | PENDING | RESOLVED | CLOSED`, Default: `NEW`) — Finite state machine lifecycle status.
- `createdById` (`String`, Foreign Key $\rightarrow$ `users.id`) — Actor who initially created the record.
- `primaryAssigneeId` (`String?`, Nullable, Foreign Key $\rightarrow$ `users.id`, OnDelete: SetNull) — Assigned support agent.
- `slaTargetMinutes` (`Int`) — Target response duration snapshot (120m for Urgent, 480m for High, 1440m for Medium, 4320m for Low).
- `slaDueAt` (`DateTime?`, Nullable, Indexed) — Effective deadline timestamp (dynamically adjusted upon resume; null while paused in `PENDING`).
- `slaPausedAt` (`DateTime?`, Nullable) — Timestamp when ticket was placed into `PENDING`.
- `slaPausedRemainingSeconds` (`Int?`, Nullable) — Preserved active remaining seconds while paused in `PENDING`.
- `slaCycle` (`Int`, Default: 1) — Increments on reopen cycles to track multi-cycle SLA alerts.
- `resolvedAt` (`DateTime?`, Nullable) — Timestamp when marked `RESOLVED`.
- `closedAt` (`DateTime?`, Nullable) — Timestamp when marked `CLOSED` (used for the 7-day post-resolution reopen guard).
- `archivedAt` (`DateTime?`, Nullable, Indexed) — Soft-archive timestamp (`null` for active tickets).
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Record creation timestamp.
- `updatedAt` (`DateTime`, Auto-update, Indexed) — Last modification timestamp.

---

### 3. `ticket_collaborators`
Normalized join table managing secondary agents assigned to collaborate on a ticket.
- `id` (`String` / `cuid`, Primary Key) — Unique join record ID.
- `ticketId` (`String`, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Ticket reference.
- `userId` (`String`, Foreign Key $\rightarrow$ `users.id`, OnDelete: Cascade) — Collaborator agent reference.
- `addedById` (`String`, Foreign Key $\rightarrow$ `users.id`) — Agent/Supervisor who assigned collaborator.
- `createdAt` (`DateTime`, Default: `now()`) — Collaboration grant timestamp.
- **Constraints**: `UNIQUE(ticketId, userId)` composite unique constraint.

---

### 4. `replies`
Append-only conversation messages, agent responses, customer replies, and internal team notes.
- `id` (`String` / `cuid`, Primary Key) — Unique reply ID.
- `ticketId` (`String`, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Parent ticket.
- `authorId` (`String?`, Nullable, Foreign Key $\rightarrow$ `users.id`, OnDelete: SetNull) — Author account reference.
- `authorType` (`Enum: AGENT | CUSTOMER | SYSTEM`, Default: `AGENT`) — Sender classification.
- `authorName` (`String`) — Historical author display name snapshot.
- `authorEmail` (`String`) — Historical author email snapshot.
- `body` (`Text`) — Markdown content of the message.
- `isInternal` (`Boolean`, Default: `false`) — `true` for private internal team notes (hidden from customers); `false` for public messages.
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Reply creation timestamp.

---

### 5. `audit_logs`
Immutable audit ledger recording all ticket mutations, reassignments, status transitions, and collaborator modifications.
- `id` (`String` / `cuid`, Primary Key) — Unique audit log ID.
- `ticketId` (`String`, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `actorId` (`String?`, Nullable, Foreign Key $\rightarrow$ `users.id`, OnDelete: SetNull) — Acting user account.
- `actorName` (`String`) — Historical actor display name snapshot.
- `eventType` (`Enum: TICKET_CREATED | STATUS_CHANGED | REASSIGNED | COLLABORATOR_ADDED | COLLABORATOR_REMOVED | REPLY_ADDED | TICKET_EDITED | TICKET_ARCHIVED | TICKET_RESTORED | SLA_ALERT_ACKNOWLEDGED | CSAT_SUBMITTED`) — Classified event type.
- `oldValue` (`Json?`, Nullable) — Pre-mutation field values (e.g. `{ status: "OPEN" }`).
- `newValue` (`Json?`, Nullable) — Post-mutation field values (e.g. `{ status: "PENDING" }`).
- `metadata` (`Json?`, Nullable) — Additional structured event context (e.g. `{ reason: "Customer replied" }`).
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Event occurrence timestamp.

---

### 6. `sla_alerts`
Tracks active, acknowledged, and resolved SLA warning and breach notifications.
- `id` (`String` / `cuid`, Primary Key) — Unique alert ID.
- `ticketId` (`String`, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `type` (`Enum: DUE_SOON | BREACHED`) — Alert urgency level.
- `status` (`Enum: ACTIVE | ACKNOWLEDGED | RESOLVED`, Default: `ACTIVE`) — Alert lifecycle state.
- `breachCycle` (`Int`, Default: 1) — Ticket's `slaCycle` at the time the alert was triggered.
- `acknowledgedById` (`String?`, Nullable, Foreign Key $\rightarrow$ `users.id`, OnDelete: SetNull) — Agent who acknowledged the warning.
- `acknowledgedAt` (`DateTime?`, Nullable) — Acknowledgement timestamp.
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Alert creation timestamp.

---

### 7. `customer_satisfactions`
Stores 1-to-5 star CSAT feedback submitted by customers after ticket resolution.
- `id` (`String` / `cuid`, Primary Key) — Unique CSAT entry ID.
- `ticketId` (`String`, Unique, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Resolved ticket reference (1 CSAT per ticket).
- `userId` (`String`, Foreign Key $\rightarrow$ `users.id`, OnDelete: Restrict) — Customer user who submitted the rating.
- `rating` (`Int`) — Numeric score between 1 and 5.
- `comment` (`Text?`, Nullable) — Optional qualitative customer feedback.
- `createdAt` (`DateTime`, Default: `now()`) — Submission timestamp.

---

## 2. Integrity Guarantees & Constraints

### Database-Enforced
- **Composite Unique Keys**: `UNIQUE(ticketId, userId)` on `ticket_collaborators` prevents duplicate collaborator grants. `UNIQUE(ticketId)` on `customer_satisfactions` prevents multi-voting.
- **Foreign Key Cascades**: `ON DELETE CASCADE` cleanly purges child replies, audit logs, collaborator links, and SLA alerts if a ticket is purged. `ON DELETE SET NULL` on `primaryAssigneeId` and `authorId` ensures historical audit trails remain intact if a user is deactivated.
- **Composite Indexes for Scale**:
  - `@@index([requesterId, archivedAt, updatedAt(sort: Desc)])` (Customer portal queue)
  - `@@index([primaryAssigneeId, status, archivedAt])` (Agent queue queries)
  - `@@index([status, archivedAt, slaDueAt])` (SLA warning/breach scans)
  - `@@index([archivedAt, createdAt(sort: Desc)])` (Global queue sorting)

### Application-Enforced
- **Finite State Machine Validity**: Direct state transitions (e.g. `NEW -> OPEN -> PENDING -> RESOLVED -> CLOSED`) and disallowed jumps are enforced inside `LifecycleController`.
- **7-Day Reopen Window**: Prevent reopening closed tickets after 7 calendar days (`Date.now() - closedAt <= 7 * 24 * 60 * 60 * 1000`).
- **Query-Level Data Isolation**: Customers are physically constrained at the database query level (`where: { requesterEmail: user.email }`), completely preventing data leakage between accounts.
- **Audit Immutability**: No API route or controller method allows modifying or deleting existing `AuditLog` rows.
