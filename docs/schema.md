# Schema

Answer each of these, in your own words.

- Table by table: what columns and types does each one have?
- Which relationships are one-to-many, and which are many-to-many?
- Which constraints are enforced by the database, and which by application code — and why did you draw the line there?
- What did you deliberately denormalise?
- What would break first if this had 100x the data?

---

## 1. Table by Table: Columns & Types

The relational database is defined in `backend/prisma/schema.prisma` across 13 models:

### 1. `users`
Stores all platform identities across the three system access tiers.
- `id` (`String` / `cuid`, PK) — Unique user identifier.
- `email` (`String`, Unique) — Login email address.
- `passwordHash` (`String`) — Salted bcrypt hash.
- `name` (`String`) — Display name.
- `role` (`Enum: SUPERVISOR | AGENT | CUSTOMER`, Default: `AGENT`) — Access tier.
- `status` (`Enum: PENDING_SETUP | ACTIVE | SUSPENDED`, Default: `ACTIVE`) — Account state.
- `digestEnabled` (`Boolean`, Default: `true`) — Email queue digest opt-in.
- `digestFrequency` (`Enum: DAILY | WEEKLY | NEVER`, Default: `DAILY`) — Digest schedule.
- `digestLastSentAt` (`DateTime?`, Nullable) — Last digest dispatch timestamp.
- `createdAt` (`DateTime`, Default: `now()`) — Creation timestamp.
- `updatedAt` (`DateTime`, Auto-update) — Last update timestamp.

### 2. `agent_invitations`
Stores single-use 24-hour invitation tokens for agent account provisioning.
- `id` (`String` / `cuid`, PK) — Unique invitation record ID.
- `userId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Cascade) — Pre-created user account.
- `tokenHash` (`String`, Unique) — SHA-256 hash of the 256-bit random invitation token.
- `expiresAt` (`DateTime`) — 24-hour expiration deadline.
- `usedAt` (`DateTime?`, Nullable) — Timestamp when consumed (null if unused).
- `createdAt` (`DateTime`, Default: `now()`) — Generation timestamp.

### 3. `tickets`
The core support entity containing issue details, state lifecycle, SLA math, and soft-archive state.
- `id` (`String` / `cuid`, PK) — Unique ticket UUID.
- `ticketNumber` (`Int`, Unique, Auto-increment) — Human-readable reference number (e.g., `#101`).
- `subject` (`String`) — Issue title/summary.
- `description` (`Text`) — Detailed issue description.
- `requesterId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Restrict) — Customer user who owns the ticket.
- `requesterName` (`String`) — Denormalized snapshot of requester name.
- `requesterEmail` (`String`) — Denormalized snapshot of requester email.
- `priority` (`Enum: LOW | MEDIUM | HIGH | URGENT`, Default: `MEDIUM`) — SLA urgency classification.
- `category` (`Enum: BUG | BILLING | FEATURE | QUESTION | ACCOUNT | INTEGRATION | PERFORMANCE | SECURITY | ONBOARDING | OTHER`, Default: `QUESTION`) — Issue category.
- `status` (`Enum: NEW | OPEN | PENDING | RESOLVED | CLOSED`, Default: `NEW`) — Finite state machine status.
- `createdById` (`String`, FK $\rightarrow$ `users.id`) — User who submitted the ticket.
- `primaryAssigneeId` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Assigned support agent.
- `attachmentUrl` (`String?`, Nullable) — Attachment storage path.
- `attachmentName` (`String?`, Nullable) — Original uploaded file name.
- `attachmentSize` (`Int?`, Nullable) — File size in bytes.
- `attachmentType` (`String?`, Nullable) — MIME type.
- `slaTargetMinutes` (`Int`) — Target response duration snapshot (120m, 480m, 1440m, 4320m).
- `slaDueAt` (`DateTime?`, Nullable, Indexed) — Current response deadline (null while paused).
- `slaPausedAt` (`DateTime?`, Nullable) — Timestamp when paused in `PENDING`.
- `slaPausedRemainingSeconds` (`Int?`, Nullable) — Frozen remaining seconds while paused.
- `slaCycle` (`Int`, Default: 1) — Increments on reopen cycles for multi-cycle alert tracking.
- `resolvedAt` (`DateTime?`, Nullable) — Marked resolved timestamp.
- `closedAt` (`DateTime?`, Nullable) — Marked closed timestamp (used for the 7-day reopen guard).
- `archivedAt` (`DateTime?`, Nullable, Indexed) — Soft-archive timestamp (`null` for active tickets).
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Submission timestamp.
- `updatedAt` (`DateTime`, Auto-update) — Last modification timestamp.

### 4. `ticket_collaborators`
Normalized join table linking secondary agents collaborating on a ticket.
- `id` (`String` / `cuid`, PK) — Unique join record ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Ticket reference.
- `userId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Cascade) — Collaborator agent reference.
- `addedById` (`String`, FK $\rightarrow$ `users.id`) — Agent who assigned collaborator.
- `createdAt` (`DateTime`, Default: `now()`) — Assignment timestamp.
- **Constraints**: `UNIQUE(ticketId, userId)`.

### 5. `replies`
Messages, customer replies, and internal team notes.
- `id` (`String` / `cuid`, PK) — Unique reply ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Parent ticket.
- `authorId` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Author user ID.
- `authorType` (`Enum: AGENT | CUSTOMER | SYSTEM`, Default: `AGENT`) — Sender classification.
- `authorName` (`String`) — Denormalized snapshot of author display name.
- `authorEmail` (`String`) — Denormalized snapshot of author email.
- `body` (`Text`) — Markdown message body.
- `isInternal` (`Boolean`, Default: `false`) — `true` for internal notes; `false` for public replies.
- `attachmentUrl`, `attachmentName`, `attachmentSize`, `attachmentType` — Optional reply attachments.
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Timestamp.

### 6. `audit_logs`
Immutable audit ledger capturing all ticket mutations.
- `id` (`String` / `cuid`, PK) — Unique audit log ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `actorId` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Acting user ID.
- `actorName` (`String`) — Denormalized snapshot of actor name.
- `eventType` (`Enum: TICKET_CREATED | STATUS_CHANGED | REASSIGNED | COLLABORATOR_ADDED | COLLABORATOR_REMOVED | REPLY_ADDED | TICKET_EDITED | TICKET_ARCHIVED | TICKET_RESTORED | SLA_ALERT_ACKNOWLEDGED | CSAT_SUBMITTED | TAG_ADDED | TAG_REMOVED`) — Event type.
- `oldValue` (`Json?`, Nullable) — Pre-mutation field state.
- `newValue` (`Json?`, Nullable) — Post-mutation field state.
- `metadata` (`Json?`, Nullable) — Structured context (e.g. `{ reason: "Customer replied" }`).
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Timestamp.

### 7. `sla_alerts`
Tracks active, acknowledged, and resolved SLA warnings and breaches.
- `id` (`String` / `cuid`, PK) — Unique alert ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `type` (`Enum: DUE_SOON | BREACHED`) — Urgency level.
- `status` (`Enum: ACTIVE | ACKNOWLEDGED | RESOLVED`, Default: `ACTIVE`) — Alert status.
- `breachCycle` (`Int`, Default: 1) — Ticket's `slaCycle` at the time of breach.
- `acknowledgedById` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Agent who acknowledged.
- `acknowledgedAt` (`DateTime?`, Nullable) — Timestamp when acknowledged.
- `createdAt` (`DateTime`, Default: `now()`, Indexed) — Trigger timestamp.
- **Constraints**: `UNIQUE(ticketId, breachCycle)`.

### 8. `customer_satisfactions`
Stores 1–5 star CSAT feedback submitted by customers after resolution.
- `id` (`String` / `cuid`, PK) — Unique CSAT ID.
- `ticketId` (`String`, Unique, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket (1 rating per ticket).
- `userId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Restrict) — Customer user ID.
- `rating` (`Int`) — Score from 1 to 5.
- `comment` (`Text?`, Nullable) — Optional qualitative feedback.
- `createdAt` (`DateTime`, Default: `now()`) — Submission timestamp.

### 9. `kb_articles`
Knowledge Base articles used for customer deflection and agent Smart Assist recommendations.
- `id` (`String` / `cuid`, PK) — Article ID.
- `title` (`String`) — Article title.
- `slug` (`String`, Unique) — URL slug.
- `content` (`Text`) — Markdown troubleshooting guide.
- `category` (`Enum: Category`, Default: `QUESTION`) — Domain classification.
- `isPublished` (`Boolean`, Default: `true`) — Publication status.
- `createdAt` (`DateTime`, Default: `now()`) — Creation timestamp.
- `updatedAt` (`DateTime`, Auto-update) — Last edit timestamp.

### 10. `recommendation_feedback`
Tracks agent telemetry on AI Smart Assist recommendations (thumbs up/down, inserted, dismissed).
- `id` (`String` / `cuid`, PK) — Feedback record ID.
- `targetTicketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Ticket being worked on.
- `sourceType` (`String`) — `"TICKET"` or `"KB"`.
- `sourceId` (`String`) — ID of the recommended ticket or article.
- `similarityScore` (`Float`) — Cosine similarity score (e.g., 0.89).
- `actionTaken` (`Enum: INSERTED | VIEWED | DISMISSED`) — Agent action.
- `agentId` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Acting agent.
- `createdAt` (`DateTime`, Default: `now()`) — Timestamp.

### 11. `tag_groups`
Configurable tag groups with exclusivity enforcement.
- `id` (`String` / `cuid`, PK) — Group ID.
- `name` (`String`, Unique) — Group name (e.g. `"Environment"`).
- `description` (`String?`, Nullable) — Purpose of group.
- `color` (`String`, Default: `#6B7280`) — Hex badge color.
- `isExclusive` (`Boolean`, Default: `false`) — When true, only one tag from this group can be attached to a ticket.
- `displayOrder` (`Int`, Default: 0) — Ordering in UI filter dropdowns.
- `createdAt`, `updatedAt` — Timestamps.

### 12. `tags`
Individual tags within or outside groups.
- `id` (`String` / `cuid`, PK) — Tag ID.
- `name` (`String`) — Tag name (e.g. `"Production"`).
- `slug` (`String`, Unique) — URL-safe slug (`"production"`).
- `color` (`String`, Default: `#6B7280`) — Hex color.
- `groupId` (`String?`, Nullable, FK $\rightarrow$ `tag_groups.id`, OnDelete: SetNull) — Parent group.
- `usageCount` (`Int`, Default: 0) — Denormalized counter of tickets currently using this tag.
- `createdAt`, `updatedAt` — Timestamps.
- **Constraints**: `UNIQUE(groupId, name)`.

### 13. `ticket_tags`
Join table linking tickets to tags.
- `id` (`String` / `cuid`, PK) — Join record ID.
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade) — Target ticket.
- `tagId` (`String`, FK $\rightarrow$ `tags.id`, OnDelete: Cascade) — Tag reference.
- `addedById` (`String?`, Nullable, FK $\rightarrow$ `users.id`, OnDelete: SetNull) — Agent who added tag.
- `createdAt` (`DateTime`, Default: `now()`) — Timestamp.
- **Constraints**: `UNIQUE(ticketId, tagId)`.

---

## 2. Which relationships are one-to-many, and which are many-to-many?

### One-to-Many Relationships (1:N)
- `User` $\rightarrow$ `Ticket` (`createdTickets`): 1 user creates many tickets.
- `User` $\rightarrow$ `Ticket` (`requestedTickets`): 1 customer requests many tickets.
- `User` $\rightarrow$ `Ticket` (`assignedTickets`): 1 agent is assigned many tickets as primary assignee.
- `User` $\rightarrow$ `AgentInvitation` (`invitations`): 1 user can have multiple historical invitations (prior unused tokens invalidated on resend).
- `Ticket` $\rightarrow$ `Reply` (`replies`): 1 ticket has many replies (ordered chronologically).
- `User` $\rightarrow$ `Reply` (`replies`): 1 user authors many replies.
- `Ticket` $\rightarrow$ `AuditLog` (`auditLogs`): 1 ticket has many immutable audit events.
- `User` $\rightarrow$ `AuditLog` (`auditLogs`): 1 user generates many audit events.
- `Ticket` $\rightarrow$ `SlaAlert` (`slaAlerts`): 1 ticket can have multiple alerts across different breach cycles.
- `TagGroup` $\rightarrow$ `Tag` (`tags`): 1 tag group contains many tags.
- `Ticket` $\rightarrow$ `CustomerSatisfaction` (1:1 enforced via `UNIQUE(ticketId)`): Exactly 1 CSAT rating per resolved ticket.

### Many-to-Many Relationships (M:N)
1. **Tickets $\leftrightarrow$ Collaborator Agents**:
   - Model: `TicketCollaborator` join table (`ticket_collaborators`).
   - A ticket can have multiple secondary collaborator agents; an agent can collaborate on multiple tickets.
   - Enforced by `UNIQUE(ticketId, userId)` composite key.
2. **Tickets $\leftrightarrow$ Tags**:
   - Model: `TicketTag` join table (`ticket_tags`).
   - A ticket can have multiple tags; a tag can be attached to multiple tickets.
   - Enforced by `UNIQUE(ticketId, tagId)` composite key.

---

## 3. Which constraints are enforced by the database, and which by application code — and why did you draw the line there?

### Database-Enforced Constraints
- **Primary & Foreign Key Referential Integrity**: Ensures child records (`replies`, `audit_logs`, `ticket_collaborators`, `ticket_tags`) cannot exist without a valid parent ticket (`ON DELETE CASCADE`).
- **Audit Preservation**: `ON DELETE SET NULL` on user references (`authorId`, `actorId`, `primaryAssigneeId`) ensures that deleting a staff account does not wipe or corrupt historical conversation history or audit logs.
- **Uniqueness Invariants**:
  - `UNIQUE(ticketId, userId)` on `ticket_collaborators`: Physically blocks duplicate collaborator assignments.
  - `UNIQUE(ticketId, breachCycle)` on `sla_alerts`: Prevents race conditions from inserting duplicate alert records for the same SLA cycle.
  - `UNIQUE(ticketId)` on `customer_satisfactions`: Guarantees a customer can never submit multiple CSAT ratings for one ticket.
  - `UNIQUE(tokenHash)` on `agent_invitations`: Enforces unique single-use token identity.

### Application-Enforced Constraints
- **Finite State Machine Lifecycle (`LifecycleController`)**:
  - Valid transitions: `NEW -> OPEN`, `OPEN -> PENDING`, `PENDING -> OPEN`, `OPEN -> RESOLVED`, `RESOLVED -> CLOSED`, `CLOSED -> REOPENED`. Disallowed jumps (e.g. `NEW -> CLOSED`) are rejected with descriptive messages.
- **7-Day Closed Ticket Reopening Guard**:
  - Checked in application logic (`Date.now() - ticket.closedAt <= 7 * 24 * 60 * 60 * 1000`). Database triggers could enforce this, but would produce cryptic SQL exceptions instead of clear HTTP 400 validation messages.
- **Query-Level Customer Data Isolation (Row-Level Security)**:
  - Enforced in `TicketController` queries: `where: { requesterId: sessionUser.id }` for customers. Completely prevents customers from accessing internal notes, agent audit logs, or tickets belonging to other companies.
- **Tag Group Exclusivity**:
  - Enforced in `TagController`: When attaching a tag belonging to an exclusive group (e.g. `Environment: Production`), the controller automatically finds and removes any existing tag from that group (`Environment: Staging`) in an atomic transaction.
- **Single-Use Invitation Consumption**:
  - Token verification and atomic `usedAt: now()` updates are managed in an atomic Prisma transaction (`prisma.$transaction`) to prevent replay attacks.

### Why We Drew the Line There
- **Database handles structural invariants**: Identity, referential integrity, uniqueness, and cascade hygiene are enforced at the database engine level so that data corruption is impossible regardless of which service writes to PostgreSQL.
- **Application handles business logic and security policies**: State transitions, SLA math, time windows, and multi-tenant authorization rules require rich domain context, custom error messaging for users, and audit trail logging.

---

## 4. What did you deliberately denormalise?

We deliberately denormalized four specific data items:

1. **`requesterName` and `requesterEmail` on `Ticket`**:
   - *Why*: A support ticket represents a historical legal and customer record. If a customer later updates their company profile, changes their email, or their user record is deactivated, past tickets must preserve the exact requester identity as it existed when the ticket was filed. It also eliminates an unnecessary SQL `JOIN` on every queue query.
2. **`authorName` and `authorEmail` on `Reply`**:
   - *Why*: Similar to requester data, message authorship must remain permanent. If an agent marries, changes their surname, or leaves the company, historical conversation threads must accurately reflect who typed each message.
3. **`actorName` on `AuditLog`**:
   - *Why*: Audit trails are immutable compliance ledgers. Storing `actorName` directly on the audit log guarantees that the log remains readable and accurate even if the user record is purged.
4. **`usageCount` on `Tag`**:
   - *Why*: Tag management and autocomplete queries display tags sorted by popularity (`usageCount(sort: Desc)`). Computing `COUNT(*)` across millions of rows in `ticket_tags` on every typeahead keystroke would degrade performance; maintaining a denormalized counter column indexed on `(groupId, usageCount)` delivers instant responses.

---

## 5. What would break first if this had 100x the data?

If the dataset scaled 100x (e.g., **5 million tickets, 35 million replies, 50 million audit logs, 100,000 active agents**), the following bottlenecks would arise first:

1. **In-Memory Semantic Vector Ranking**:
   - *Current*: `RecommendationService` scans up to 50 resolved tickets and 20 KB articles, computing cosine similarity in Node.js memory.
   - *At 100x*: Computing similarity over 500,000 candidate tickets in memory would exhaust Node.js CPU and memory.
   - *Fix*: Push vector storage and similarity search into PostgreSQL using `pgvector` with HNSW indexing (`vector_cosine_ops`), querying `ORDER BY embedding <=> query_vector LIMIT 5`.
2. **Full-Table Count Pagination Queries**:
   - *Current*: Pagination runs `Promise.all([prisma.ticket.findMany(...), prisma.ticket.count(...)])`.
   - *At 100x*: `COUNT(*)` over a table of 5 million rows requires scanning millions of index entries in PostgreSQL and can take several seconds.
   - *Fix*: Switch from offset pagination (`page`, `pageSize`) to cursor-based keyset pagination (`WHERE (createdAt, id) < (cursorCreatedAt, cursorId) ORDER BY createdAt DESC LIMIT 25`) with approximate count estimations (`pg_class.reltuples`).
3. **Audit Log Table Growth**:
   - *Current*: Single monolithic `audit_logs` table.
   - *At 100x*: Audit logs will reach 50+ million rows, ballooning table and B-tree index sizes beyond server RAM.
   - *Fix*: Apply PostgreSQL declarative table partitioning by range on `createdAt` (e.g., monthly partitions: `audit_logs_2026_09`, `audit_logs_2026_10`).
4. **Queue Free-Text Search**:
   - *Current*: Search queries use SQL `contains: query, mode: "insensitive"`, which translates to `ILIKE '%query%'`.
   - *At 100x*: Leading wildcard `ILIKE` queries cannot utilize standard B-tree indexes and cause full sequential table scans.
   - *Fix*: Implement PostgreSQL `tsvector` full-text search with GIN indexes (`to_tsvector('english', subject || ' ' || description)`).
