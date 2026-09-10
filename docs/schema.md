# Schema Documentation

## Table by Table: Columns, Types & Descriptions

### 1. `users`
Represents agents and supervisors in the system.
- `id` (`String` / `cuid`, Primary Key) — Unique identifier.
- `email` (`String`, Unique) — User's work email address.
- `passwordHash` (`String`) — Salted bcrypt hash of user password.
- `name` (`String`) — Full name.
- `role` (`Enum: SUPERVISOR | AGENT`, Default: `AGENT`) — System access tier.
- `createdAt` (`DateTime`, Default: `now()`) — Registration timestamp.
- `updatedAt` (`DateTime`, Auto-update) — Last update timestamp.

### 2. `tickets`
Core support entity containing metadata, ownership, SLA state, and lifecycle timestamps.
- `id` (`String` / `cuid`, Primary Key) — Unique ticket UUID.
- `ticketNumber` (`Int`, Unique, Auto-increment) — Human-readable reference number (e.g. `#101`).
- `subject` (`String`) — Short summary of the support request.
- `description` (`Text`) — Detailed customer problem statement.
- `requesterName` (`String`) — Customer's name.
- `requesterEmail` (`String`) — Customer's email.
- `priority` (`Enum: LOW | MEDIUM | HIGH | URGENT`, Default: `MEDIUM`) — SLA urgency tier.
- `category` (`Enum: BUG | BILLING | FEATURE | QUESTION`, Default: `QUESTION`) — Functional category.
- `status` (`Enum: NEW | OPEN | PENDING | RESOLVED | CLOSED`, Default: `NEW`) — Lifecycle state.
- `createdById` (`String`, Foreign Key $\rightarrow$ `users.id`) — Actor who logged the ticket.
- `primaryAssigneeId` (`String?`, Nullable, Foreign Key $\rightarrow$ `users.id`) — Assigned agent.
- `slaTargetMinutes` (`Int`) — Target response duration (120m, 480m, 1440m, 4320m).
- `slaDueAt` (`DateTime?`, Nullable, Indexed) — Effective deadline timestamp (null while paused in `PENDING`).
- `slaPausedAt` (`DateTime?`, Nullable) — Timestamp when ticket entered `PENDING`.
- `slaPausedRemainingSeconds` (`Int?`, Nullable) — Preserved remaining seconds while in `PENDING`.
- `slaCycle` (`Int`, Default: 1) — Increments on reopen to manage SLA re-breach cycles.
- `resolvedAt` (`DateTime?`, Nullable) — Timestamp when marked `RESOLVED`.
- `closedAt` (`DateTime?`, Nullable) — Timestamp when marked `CLOSED` (used for 7-day reopen guard).
- `archivedAt` (`DateTime?`, Nullable, Indexed) — Soft archive timestamp (null for active tickets).
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Creation timestamp.
- `updatedAt` (`DateTime`, Auto-update, Indexed) — Last modified timestamp.

### 3. `ticket_collaborators`
Normalized join table managing secondary agents assigned to a ticket.
- `id` (`String` / `cuid`, Primary Key) — Unique join identifier.
- `ticketId` (`String`, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Ticket reference.
- `userId` (`String`, Foreign Key $\rightarrow$ `users.id`, OnDelete: Cascade) — Collaborator agent reference.
- `addedById` (`String`, Foreign Key $\rightarrow$ `users.id`) — User who granted collaborator access.
- `createdAt` (`DateTime`, Default: `now()`) — Collaboration grant timestamp.
- **Constraints**: `UNIQUE(ticketId, userId)` composite unique constraint.

### 4. `replies`
Append-only conversation messages inside tickets.
- `id` (`String` / `cuid`, Primary Key) — Unique reply ID.
- `ticketId` (`String`, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Parent ticket.
- `authorId` (`String?`, Nullable, Foreign Key $\rightarrow$ `users.id`, OnDelete: SetNull) — Relational source of truth.
- `authorType` (`Enum: AGENT | CUSTOMER | SYSTEM`, Default: `AGENT`) — Message origin.
- `authorName` (`String`) — Deliberate historical denormalization.
- `authorEmail` (`String`) — Author's email address.
- `body` (`Text`) — Markdown / text content of the message.
- `isInternal` (`Boolean`, Default: `false`) — `true` for private team notes; `false` for public messages.
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Timestamp of reply.

### 5. `audit_logs`
Immutable audit history for all ticket mutations.
- `id` (`String` / `cuid`, Primary Key) — Unique audit log ID.
- `ticketId` (`String`, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `actorId` (`String?`, Nullable, Foreign Key $\rightarrow$ `users.id`, OnDelete: SetNull) — Actor foreign key.
- `actorName` (`String`) — Deliberate historical denormalization.
- `eventType` (`Enum: TICKET_CREATED | STATUS_CHANGED | REASSIGNED | COLLABORATOR_ADDED | COLLABORATOR_REMOVED | REPLY_ADDED | TICKET_EDITED | TICKET_ARCHIVED | TICKET_RESTORED | SLA_ALERT_ACKNOWLEDGED`) — Action classification.
- `oldValue` (`Json?`, Nullable) — Previous field values (e.g. `{ status: "OPEN" }`).
- `newValue` (`Json?`, Nullable) — New field values (e.g. `{ status: "PENDING" }`).
- `metadata` (`Json?`, Nullable) — Extra contextual parameters (e.g. `{ reason: "..." }`).
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Timestamp of event.

### 6. `sla_alerts`
Tracks active and acknowledged SLA breach/risk notifications.
- `id` (`String` / `cuid`, Primary Key) — Unique alert ID.
- `ticketId` (`String`, Foreign Key $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Ticket reference.
- `type` (`Enum: DUE_SOON | BREACHED`) — Risk level.
- `status` (`Enum: ACTIVE | ACKNOWLEDGED | RESOLVED`, Default: `ACTIVE`) — Alert lifecycle state.
- `breachCycle` (`Int`, Default: 1) — Ticket's `slaCycle` at the time of breach.
- `acknowledgedById` (`String?`, Nullable, Foreign Key $\rightarrow$ `users.id`) — Agent who acknowledged the alert.
- `acknowledgedAt` (`DateTime?`, Nullable) — Acknowledgement timestamp.
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Alert creation timestamp.

---

## Relationship Overview

### One-to-Many Relationships
- `users` $\rightarrow$ `tickets` (1 user can be the creator or primary assignee of many tickets).
- `tickets` $\rightarrow$ `replies` (1 ticket contains many chronological replies).
- `tickets` $\rightarrow$ `audit_logs` (1 ticket has many immutable audit events).
- `tickets` $\rightarrow$ `sla_alerts` (1 ticket can trigger alerts across different breach cycles).

### Many-to-Many Relationships
- `users` $\leftrightarrow$ `tickets` via `ticket_collaborators` (An agent can collaborate on many tickets, and a ticket can have multiple secondary collaborator agents).

---

## Constraints: Database vs. Application Enforced

### Database-Enforced Constraints
- **Primary & Unique Keys**: `users.email`, `tickets.ticketNumber`, `ticket_collaborators (ticketId, userId)` composite uniqueness to prevent duplicate collaborator grants.
- **Foreign Key Integrity**: Relational links with `CASCADE` on ticket deletion (for cleaning up child entities in tests) and `SET NULL` on user deletion to preserve ticket history.
- **Column Types & Enums**: Native PostgreSQL enums (`Role`, `Priority`, `Category`, `Status`, `AuthorType`, `AuditEventType`, `SlaAlertType`, `SlaAlertStatus`).
- **Composite Indexes**: Query-tailored multi-column indexing for queue retrieval, status filtering, and SLA deadline evaluations.

### Application-Enforced Constraints
- **Lifecycle Finite State Machine**: State transitions (e.g. `NEW -> OPEN -> PENDING -> RESOLVED -> CLOSED`) and illegal jump rejections are managed in `LifecycleService`. *Why*: Allows returning rich, human-readable explanations to users rather than generic database constraint violation codes.
- **7-Day Reopen Guard**: Reopening a `CLOSED` ticket requires checking `Date.now() - closedAt <= 7 days`. *Why*: Time-window business logic involves temporal calculations against `closedAt` that are clearest and most testable in the domain policy layer.
- **Role-Based Permissions**: Agent reassignments, supervisor-only closures, collaborator access, and alert acknowledgements are enforced in `/lib/policies/`. *Why*: Access rules depend on session actor context, primary assignee matching, and collaborator inclusion.
- **Audit Immutability**: No `UPDATE` or `DELETE` API routes or service methods exist for `audit_logs` or `replies`.

---

## What did you deliberately denormalise?

1. **`authorName` on `Reply` and `actorName` on `AuditLog`**:
   - *Rationale*: Storing the actor/author's display name directly as a denormalized string ensures that immutable historical records preserve the exact person's name at the moment the event occurred, even if the user's name is subsequently edited or their user record is deactivated. The relational foreign key (`authorId`, `actorId`) remains the normalized source of truth for user joins.

2. **`slaTargetMinutes` on `Ticket`**:
   - *Rationale*: Storing the initial target duration snapshot on the ticket ensures that if global SLA policy defaults change in the future (e.g. Medium priority changes from 24h to 18h), existing in-flight tickets retain their contracted SLA targets.

---

## What would break first if this had 100x the data?

At 100x the data (~50,000 to 100,000 tickets with ~500,000 replies and audit events):

1. **Dashboard Weekly Historical Resolution Aggregations**:
   - *Bottleneck*: Calculating 8-week weekly cohorts on demand by scanning historical resolved tickets will begin taking tens of milliseconds.
   - *Fix*: Create a PostgreSQL Materialized View or scheduled aggregation summary table for historical weekly totals, refreshing once an hour.

2. **Full-Text Search on Large Ticket Descriptions**:
   - *Bottleneck*: Standard `ILIKE` pattern matching across hundreds of thousands of long description text rows will become I/O intensive.
   - *Fix*: Introduce a dedicated PostgreSQL Full-Text Search column with a `GIN` index on `to_tsvector('english', subject || ' ' || description)`.

3. **CSV Queue Exports**:
   - *Bottleneck*: In-memory CSV generation for queries matching 20,000+ tickets could spike Node.js server RAM.
   - *Fix*: Use Node.js streaming HTTP responses (`TransformStream` / database cursor streaming) to pipe CSV chunks directly from PostgreSQL to the client socket without buffering the full array in memory.
