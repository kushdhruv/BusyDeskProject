# Schema

## 1. Table by Table: Columns, Types & Constraints

The relational schema is implemented in `backend/prisma/schema.prisma` across 13 models, hosted on managed PostgreSQL:

### 1. `users`
Stores user identities across all three system access tiers (`SUPERVISOR`, `AGENT`, `CUSTOMER`).
- `id` (`String` / `cuid`, PK) — Unique user ID.
- `email` (`String`, Unique) — Login email address.
- `passwordHash` (`String`) — Salted bcrypt password hash.
- `name` (`String`) — Full display name.
- `role` (`Enum: SUPERVISOR | AGENT | CUSTOMER`, Default: `AGENT`) — System access tier.
- `status` (`Enum: PENDING_SETUP | ACTIVE | SUSPENDED`, Default: `ACTIVE`) — Account state. Suspended users are denied session validation.
- `digestEnabled` (`Boolean`, Default: `true`) — Daily/weekly email digest opt-in.
- `digestFrequency` (`Enum: DAILY | WEEKLY | NEVER`, Default: `DAILY`) — Delivery frequency.
- `digestTime` (`String`, Default: `"09:00"`) — Preferred delivery time in HH:mm format.
- `digestDayOfWeek` (`Int`, Default: `1`) — Preferred delivery day of week (1 = Monday ... 7 = Sunday) for weekly summaries.
- `digestTimezone` (`String`, Default: `"UTC"`) — User's configured timezone.
- `digestLastSentAt` (`DateTime?`, Nullable) — Last successful digest dispatch timestamp.
- `createdAt` (`DateTime`, Default: `now()`) — Registration timestamp.
- `updatedAt` (`DateTime`, Auto-update) — Last update timestamp.

### 2. `agent_invitations`
Stores single-use 24-hour cryptographic invitation tokens for agent provisioning.
- `id` (`String` / `cuid`, PK) — Unique invitation record ID.
- `userId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Cascade) — Pre-created user account in `PENDING_SETUP` status.
- `tokenHash` (`String`, Unique) — SHA-256 hash of the 256-bit random invitation token. Raw tokens are never stored.
- `expiresAt` (`DateTime`) — 24-hour expiration deadline.
- `usedAt` (`DateTime?`, Nullable) — Timestamp when consumed (null while unused).
- `createdAt` (`DateTime`, Default: `now()`) — Generation timestamp.
- **Indexes**: `@@index([tokenHash])`, `@@index([userId])`.

### 3. `tickets`
The core support entity holding issue content, lifecycle state, SLA calculations, and soft-archive state.
- `id` (`String` / `cuid`, PK) — Unique ticket UUID.
- `ticketNumber` (`Int`, Unique, Auto-increment) — Human-readable reference number (e.g. `#101`).
- `subject` (`String`) — Issue title/summary.
- `description` (`Text`) — Detailed issue description.
- `requesterId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Restrict) — Customer user who owns the ticket.
- `requesterName` (`String`) — Denormalized snapshot of customer name.
- `requesterEmail` (`String`) — Denormalized snapshot of customer email.
- `priority` (`Enum: LOW | MEDIUM | HIGH | URGENT`, Default: `MEDIUM`) — SLA classification.
- `category` (`Enum: BUG | BILLING | FEATURE | QUESTION | ACCOUNT | INTEGRATION | PERFORMANCE | SECURITY | ONBOARDING | OTHER`, Default: `QUESTION`) — Domain category.
- `status` (`Enum: NEW | OPEN | PENDING | RESOLVED | CLOSED`, Default: `NEW`) — Finite state machine lifecycle status.
- `createdById` (`String`, FK $\rightarrow$ `users.id`) — User who submitted the ticket.
- `primaryAssigneeId` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Assigned support agent.
- `attachmentUrl` (`String?`, Nullable) — Storage path for file attachment.
- `attachmentName` (`String?`, Nullable) — Original uploaded file name.
- `attachmentSize` (`Int?`, Nullable) — File size in bytes (max 15MB).
- `attachmentType` (`String?`, Nullable) — MIME type (`image/png`, `application/pdf`, etc.).
- `slaTargetMinutes` (`Int`) — Target response duration snapshot (Urgent: 120m, High: 480m, Medium: 1440m, Low: 4320m).
- `slaDueAt` (`DateTime?`, Nullable, Indexed) — Current response deadline (null while paused in `PENDING`).
- `slaPausedAt` (`DateTime?`, Nullable) — Timestamp when paused upon entering `PENDING`.
- `slaPausedRemainingSeconds` (`Int?`, Nullable) — Frozen active duration preserved while in `PENDING`.
- `slaCycle` (`Int`, Default: 1) — Increments upon reopen to track multi-cycle SLA breaches independently.
- `resolvedAt` (`DateTime?`, Nullable) — Marked resolved timestamp.
- `closedAt` (`DateTime?`, Nullable) — Marked closed timestamp (used for the 7-day reopen window guard).
- `archivedAt` (`DateTime?`, Nullable, Indexed) — Soft-archive timestamp (`null` for active queue tickets).
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Submission timestamp.
- `updatedAt` (`DateTime`, Auto-update) — Last modification timestamp.
- **Indexes**:
  - `@@index([requesterId, archivedAt, updatedAt(sort: Desc)])` — Customer portal queue queries.
  - `@@index([primaryAssigneeId, status, archivedAt])` — Agent assigned queue queries.
  - `@@index([status, archivedAt, slaDueAt])` — SLA alert scans and supervisor queue queries.
  - `@@index([archivedAt, createdAt(sort: Desc)])` — Default chronological queue sorting.
  - `@@index([archivedAt, resolvedAt])` — 8-week historical resolution metrics.
  - `@@index([ticketNumber])` — Direct numeric ticket search (`#104`).

### 4. `ticket_collaborators`
Normalized join table linking secondary agents collaborating on a ticket.
- `id` (`String` / `cuid`, PK) — Unique join record ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Ticket reference.
- `userId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Cascade) — Collaborator agent reference.
- `addedById` (`String`, FK $\rightarrow$ `users.id`) — Agent who assigned the collaborator.
- `createdAt` (`DateTime`, Default: `now()`) — Assignment timestamp.
- **Constraints**: `UNIQUE(ticketId, userId)` composite key prevents duplicate collaborator assignments.
- **Indexes**: `@@index([userId, ticketId])`.

### 5. `replies`
Messages, public customer replies, and internal team notes.
- `id` (`String` / `cuid`, PK) — Unique reply ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Parent ticket.
- `authorId` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Author user ID.
- `authorType` (`Enum: AGENT | CUSTOMER | SYSTEM`, Default: `AGENT`) — Sender classification.
- `authorName` (`String`) — Denormalized snapshot of author display name.
- `authorEmail` (`String`) — Denormalized snapshot of author email.
- `body` (`Text`) — Markdown message body.
- `isInternal` (`Boolean`, Default: `false`) — `true` for staff-only internal notes; `false` for public customer-visible replies.
- `attachmentUrl`, `attachmentName`, `attachmentSize`, `attachmentType` — Optional reply attachments.
- `createdAt` (`DateTime`, Default: `now()`) — Timestamp.
- **Indexes**: `@@index([ticketId, createdAt(sort: Asc)])` — Chronological timeline rendering.

### 6. `audit_logs`
Append-only, immutable audit ledger capturing all ticket mutations.
- `id` (`String` / `cuid`, PK) — Unique audit log ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `actorId` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Acting user ID.
- `actorName` (`String`) — Denormalized snapshot of actor name.
- `eventType` (`Enum: TICKET_CREATED | STATUS_CHANGED | REASSIGNED | COLLABORATOR_ADDED | COLLABORATOR_REMOVED | REPLY_ADDED | TICKET_EDITED | TICKET_ARCHIVED | TICKET_RESTORED | SLA_ALERT_ACKNOWLEDGED | CSAT_SUBMITTED | TAG_ADDED | TAG_REMOVED`) — Event type.
- `oldValue` (`Json?`, Nullable) — Pre-mutation field state.
- `newValue` (`Json?`, Nullable) — Post-mutation field state.
- `metadata` (`Json?`, Nullable) — Structured context (e.g. `{ reason: "Customer replied; SLA clock resumed" }`).
- `createdAt` (`DateTime`, Default: `now()`) — Timestamp.
- **Indexes**: `@@index([ticketId, createdAt(sort: Asc)])` — Chronological audit feed.

### 7. `sla_alerts`
Tracks active, acknowledged, and resolved SLA warnings and breaches.
- `id` (`String` / `cuid`, PK) — Unique alert ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `type` (`Enum: DUE_SOON | BREACHED`) — Urgency level.
- `status` (`Enum: ACTIVE | ACKNOWLEDGED | RESOLVED`, Default: `ACTIVE`) — Alert state.
- `breachCycle` (`Int`, Default: 1) — Ticket's `slaCycle` at the time of breach.
- `acknowledgedById` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Agent who acknowledged.
- `acknowledgedAt` (`DateTime?`, Nullable) — Timestamp when acknowledged.
- `createdAt` (`DateTime`, Default: `now()`) — Trigger timestamp.
- **Constraints**: `UNIQUE(ticketId, breachCycle)` composite key. **Physically prevents race-condition duplicate alerts in the database engine.**
- **Indexes**: `@@index([ticketId, status])`.

### 8. `customer_satisfactions`
Stores 1–5 star CSAT feedback submitted by customers after ticket resolution.
- `id` (`String` / `cuid`, PK) — Unique CSAT ID.
- `ticketId` (`String`, Unique, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket. **Enforces exactly 1 rating per ticket.**
- `userId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Restrict) — Customer user ID.
- `rating` (`Int`) — Score from 1 to 5.
- `comment` (`Text?`, Nullable) — Optional qualitative feedback.
- `createdAt` (`DateTime`, Default: `now()`) — Submission timestamp.
- **Indexes**: `@@index([rating])`.

### 9. `kb_articles`
Curated knowledge base articles used for self-service deflection and Smart Assist recommendations.
- `id` (`String` / `cuid`, PK) — Article ID.
- `title` (`String`) — Article title.
- `slug` (`String`, Unique) — URL-safe slug.
- `content` (`Text`) — Markdown troubleshooting guide.
- `category` (`Enum: Category`, Default: `QUESTION`) — Domain classification.
- `isPublished` (`Boolean`, Default: `true`) — Publication status.
- `createdAt`, `updatedAt` — Timestamps.
- **Indexes**: `@@index([category, isPublished])`.

### 10. `recommendation_feedback`
Tracks agent telemetry on AI Smart Assist recommendations (`INSERTED`, `VIEWED`, `DISMISSED`).
- `id` (`String` / `cuid`, PK) — Feedback ID.
- `targetTicketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Active ticket.
- `sourceType` (`String`) — `"TICKET"` or `"KB"`.
- `sourceId` (`String`) — ID of the suggested ticket or article.
- `similarityScore` (`Float`) — Cosine similarity score (e.g. 0.74).
- `actionTaken` (`String`) — Telemetry action.
- `agentId` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Acting agent.
- `createdAt` (`DateTime`, Default: `now()`) — Timestamp.
- **Indexes**: `@@index([targetTicketId])`, `@@index([agentId])`.

### 11. `tag_groups`
Configurable tag categories with mutual exclusivity rules.
- `id` (`String` / `cuid`, PK) — Group ID.
- `name` (`String`, Unique) — Group name (`Platform`, `Environment`, `Component`, `Impact`, `Workflow`).
- `description` (`String?`, Nullable) — Description.
- `color` (`String`, Default: `#6B7280`) — Group badge color.
- `isExclusive` (`Boolean`, Default: `false`) — When true, only one tag from this group can be attached to a ticket.
- `displayOrder` (`Int`, Default: 0) — Ordering in UI dropdowns.
- `createdAt`, `updatedAt` — Timestamps.
- **Indexes**: `@@index([displayOrder])`.

### 12. `tags`
Individual tags within or outside groups.
- `id` (`String` / `cuid`, PK) — Tag ID.
- `name` (`String`) — Tag display name (`Production`, `Staging`, `Checkout`, `Mobile App`).
- `slug` (`String`, Unique) — URL-safe slug (`production`).
- `color` (`String`, Default: `#6B7280`) — Hex color code.
- `groupId` (`String?`, Nullable, FK $\rightarrow$ `tag_groups.id`, OnDelete: SetNull) — Parent group.
- `usageCount` (`Int`, Default: 0) — Denormalized ticket association counter for fast popularity sorting.
- `createdAt`, `updatedAt` — Timestamps.
- **Constraints**: `UNIQUE(groupId, name)`.
- **Indexes**: `@@index([slug])`, `@@index([groupId, usageCount(sort: Desc)])`.

### 13. `ticket_tags`
Normalized join table linking tickets to tags.
- `id` (`String` / `cuid`, PK) — Join record ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `tagId` (`String`, FK $\rightarrow$ `tags.id`, OnDelete: Cascade) — Target tag.
- `addedById` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Agent who added tag.
- `createdAt` (`DateTime`, Default: `now()`) — Association timestamp.
- **Constraints**: `UNIQUE(ticketId, tagId)`.
- **Indexes**: `@@index([ticketId])`, `@@index([tagId])`.

---

## 2. Which relationships are one-to-many, and which are many-to-many?

### One-to-Many Relationships (1:N)
- `User` $\rightarrow$ `Ticket` (`createdTickets`): 1 user creates many tickets.
- `User` $\rightarrow$ `Ticket` (`requestedTickets`): 1 customer owns many tickets (`requesterId`).
- `User` $\rightarrow$ `Ticket` (`assignedTickets`): 1 agent is primary assignee on many tickets.
- `User` $\rightarrow$ `AgentInvitation` (`invitations`): 1 user can have multiple historical invitations (prior tokens are invalidated on resend).
- `Ticket` $\rightarrow$ `Reply` (`replies`): 1 ticket contains many chronological replies.
- `User` $\rightarrow$ `Reply` (`replies`): 1 user authors many replies.
- `Ticket` $\rightarrow$ `AuditLog` (`auditLogs`): 1 ticket contains many immutable audit events.
- `User` $\rightarrow$ `AuditLog` (`auditLogs`): 1 user triggers many audit actions.
- `Ticket` $\rightarrow$ `SlaAlert` (`slaAlerts`): 1 ticket can trigger multiple alerts across successive reopen breach cycles.
- `TagGroup` $\rightarrow$ `Tag` (`tags`): 1 tag group contains many tags.
- `Ticket` $\rightarrow$ `CustomerSatisfaction` (1:1 enforced via `UNIQUE(ticketId)`): Exactly one CSAT rating per resolved ticket.

### Many-to-Many Relationships (M:N)
1. **Tickets $\leftrightarrow$ Collaborator Agents**:
   - Model: `TicketCollaborator` join table (`ticket_collaborators`).
   - A ticket can have multiple secondary collaborator agents; an agent can collaborate on any number of tickets.
   - Enforced by composite key `UNIQUE(ticketId, userId)`.
2. **Tickets $\leftrightarrow$ Tags**:
   - Model: `TicketTag` join table (`ticket_tags`).
   - A ticket can carry multiple tags; a tag can be attached to multiple tickets.
   - Enforced by composite key `UNIQUE(ticketId, tagId)`.

---

## 3. Which constraints are enforced by the database, and which by application code — and why did you draw the line there?

### Database-Enforced Constraints
1. **Referential Integrity & Cascades**:
   - `ON DELETE CASCADE`: When a ticket is deleted, its child `replies`, `audit_logs`, `ticket_collaborators`, `ticket_tags`, and `sla_alerts` are cleanly purged by the database engine.
   - `ON DELETE SET NULL`: Applied to user foreign keys (`authorId`, `actorId`, `primaryAssigneeId`, `acknowledgedById`). If a staff account is deleted or purged, historical conversation threads, audit trails, and ticket references are **never corrupted or erased**.
   - `ON DELETE RESTRICT`: Applied to `requesterId` on tickets. Prevents deleting a customer user account while open tickets remain associated with them.
2. **Uniqueness Invariants**:
   - `UNIQUE(ticketId, userId)` on `ticket_collaborators`: Physically blocks race conditions from inserting duplicate collaborator records.
   - `UNIQUE(ticketId, breachCycle)` on `sla_alerts`: Prevents concurrent client polling requests from creating duplicate alert records for the same ticket and breach cycle.
   - `UNIQUE(ticketId)` on `customer_satisfactions`: Guarantees a customer can submit at most one rating per ticket.
   - `UNIQUE(tokenHash)` on `agent_invitations`: Guarantees single-use token uniqueness.
   - `UNIQUE(groupId, name)` on `tags`: Prevents duplicate tag names within a group.

### Application-Enforced Constraints
1. **Finite State Machine Lifecycle (`LifecycleController`)**:
   - Enforces legal transitions: `NEW -> OPEN`, `OPEN -> PENDING`, `PENDING -> OPEN`, `OPEN -> RESOLVED`, `RESOLVED -> CLOSED`, `CLOSED -> OPEN`.
   - Illegal jumps (e.g. attempting `NEW -> CLOSED` or moving directly from `PENDING` to `CLOSED` without resolving) are rejected with clear, human-readable error messages explaining the required lifecycle flow.
2. **7-Day Closed Ticket Reopening Guard**:
   - Enforced in `LifecycleController`: `Date.now() - ticket.closedAt <= 7 * 24 * 60 * 60 * 1000`. If more than 7 days have elapsed since closure, the server rejects the transition with: `"Ticket closed for more than 7 days cannot be reopened. Please open a new ticket."`
3. **Query-Level Customer Data Isolation (Row-Level Security)**:
   - Enforced in `TicketController`: When `sessionUser.role === "CUSTOMER"`, queries unconditionally enforce `where: { requesterId: sessionUser.id, archivedAt: null }`. Customers are physically blocked from viewing internal staff notes, agent audit trails, SLA mechanics, or other customers' tickets.
4. **Tag Group Mutual Exclusivity**:
   - Enforced in `TagController`: When attaching a tag belonging to an exclusive group (`isExclusive: true`, e.g. `Environment: Production`), application logic automatically identifies and removes any existing tag from that group (`Environment: Staging`) inside an atomic database transaction.
5. **Single-Use Cryptographic Invitation Consumption**:
   - In `backend/routes/auth.routes.ts`: Validates `expiresAt > now()` and `usedAt === null`. Upon valid account setup, updates `usedAt: now()`, hashes the password with bcrypt, and activates the user inside an atomic `$transaction`.

### Why I Drew the Line There
- **Database handles structural integrity**: Entity identity, foreign key relationships, cascade safety, and uniqueness invariants belong in the database engine. If a background worker, migration script, or separate service writes to PostgreSQL, data corruption is physically impossible.
- **Application handles business domain logic**: State machine rules, temporal validation windows (7-day reopen guard), multi-step group exclusivity swaps, and tenant authorization require rich domain context, custom user-facing error messages, and audit trail logging that cannot be cleanly modeled in static SQL constraints without brittle, unmaintainable triggers.

---

## 4. What did you deliberately denormalise?

I deliberately denormalized four specific data items to balance performance and historical audit integrity:

1. **`requesterName` and `requesterEmail` on `Ticket`**:
   - *Why*: A support ticket is a historical and compliance record. If a customer later updates their company name or changes their email address in their profile, historical tickets must preserve the exact requester identity as it existed at the time of submission. Additionally, denormalizing these two fields eliminates an expensive SQL `JOIN users` on every queue query and CSV export.
2. **`authorName` and `authorEmail` on `Reply`**:
   - *Why*: Message authorship must be immutable. If an agent changes their name, gets married, or leaves the company, historical conversation threads must accurately reflect who authored each message. It also avoids joining the `users` table when rendering timeline conversations.
3. **`actorName` on `AuditLog`**:
   - *Why*: Audit trails are immutable compliance ledgers. Storing `actorName` directly on the audit log ensures that if an employee's user account is purged or sanitized (`ON DELETE SET NULL`), the audit trail remains 100% human-readable.
4. **`usageCount` on `Tag`**:
   - *Why*: The tag autocomplete dropdown and tag management portal display tags sorted by popularity (`usageCount DESC`). Computing `COUNT(*)` across millions of rows in `ticket_tags` on every keystroke in the UI would cause severe query latency; maintaining a denormalized counter indexed on `(groupId, usageCount DESC)` makes typeahead queries execute in sub-millisecond time.

---

## 5. What would break first if this had 100x the data?

If the system scaled from thousands of tickets to **500,000 tickets, 5 million replies, and 10 million audit logs**, the following bottlenecks would fail first based on empirical query planner audits:

1. **Text Search Full-Table Scans (`ILIKE '%...%'`)**:
   - *Failure Mechanism*: `TicketController.getQueue` builds `ILIKE '%query%'` across `subject`, `description`, `requesterName`, and `requesterEmail`. At 500k rows, PostgreSQL cannot use standard B-tree indexes for leading wildcards and falls back to a sequential table scan (`Seq Scan`), reading hundreds of megabytes from disk and blowing p95 query latency past 2.5 seconds.
   - *Production Remedy*: Add PostgreSQL Trigram extensions (`pg_trgm`) with GIN indexes:
     ```sql
     CREATE EXTENSION IF NOT EXISTS pg_trgm;
     CREATE INDEX idx_tickets_search_trgm ON tickets USING gin (
       (subject || ' ' || description || ' ' || requester_name || ' ' || requester_email) gin_trgm_ops
     );
     ```
     Or migrate search to PostgreSQL `tsvector` full-text search with English stemming.

2. **High-Offset Pagination Degradation (`OFFSET / LIMIT`)**:
   - *Failure Mechanism*: Queue navigation uses `skip: (page - 1) * limit`. At page 100 (`OFFSET 2500`), PostgreSQL must scan, sort, and discard 2,500 index tuples while re-evaluating the full filter predicate.
   - *Production Remedy*: Replace offset pagination with keyset cursor-based pagination:
     ```sql
     WHERE (created_at, id) < ($cursorCreatedAt, $cursorId)
     ORDER BY created_at DESC, id DESC LIMIT 25;
     ```

3. **Dual `findMany` + `count` Query Overhead**:
   - *Failure Mechanism*: Every queue fetch executes `Promise.all([prisma.ticket.findMany(...), prisma.ticket.count(...)])`. Running `count(*)` across 500k rows with complex filters requires scanning millions of index entries.
   - *Production Remedy*: Clamp browsable queue pages to 100 or use PostgreSQL approximate tuple counts from `pg_class.reltuples` for large filter sets.

4. **In-Memory Semantic Vector Ranking**:
   - *Failure Mechanism*: `RecommendationService` scans recent resolved tickets and KB articles, computing cosine similarity across 1536-dimensional vectors in Node.js memory. At 100x data, computing similarity across tens of thousands of candidate vectors in Node.js would spike CPU and exhaust the event loop.
   - *Production Remedy*: Push vector storage and similarity search into PostgreSQL using `pgvector` with HNSW indexing (`vector_cosine_ops`), executing `ORDER BY embedding <=> query_vector LIMIT 5` directly in the database engine.

5. **Unbounded Timeline Payload Growth**:
   - *Failure Mechanism*: `TimelineController.getUnifiedTimeline` fetches 100% of replies and audit logs for a ticket unpaginated. For long-running tickets with 200+ replies and status updates, serializing megabytes of JSON over the network degrades mobile page loads.
   - *Production Remedy*: Implement cursor-based pagination on the ticket conversation feed (`limit: 30, before: $cursorTimestamp`).
