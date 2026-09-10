# Architecture

## What are the moving pieces, and how do they talk to each other?

The system is structured as a **Pragmatic Modular Monolith** built on **Next.js 14/15 App Router (TypeScript)**, **Prisma ORM**, and **PostgreSQL**.

The major components include:

1. **Client UI Layer (Browser / React Components)**:
   - Built with React 18, Tailwind CSS, and Lucide icons.
   - Manages interactive state: live client-side SLA countdowns (`slaDueAt - Date.now()`), server-side pagination, filtered queue queries, bulk selection, and tabbed reply/internal note composition.
   - Communicates with the backend exclusively via typed JSON REST endpoints and standard HTTP-only cookie sessions.

2. **Authentication & Central Policy Layer (`/lib/policies/`)**:
   - `AuthService` issues and validates cryptographically signed HTTP-only session cookies.
   - Centralized policy classes (`TicketPolicy`, `ReplyPolicy`, `CollaboratorPolicy`, `AlertPolicy`) evaluate authorization predicates based on the authenticated database user identity (`Role.SUPERVISOR` vs `Role.AGENT`) and relational ticket ownership.
   - The policy layer is queried both during mutation validation and when generating the consolidated ticket workspace state, ensuring UI controls dynamically match server capabilities.

3. **Domain Service Modules (`/lib/services/`)**:
   - `TicketService`: Encapsulates ticket CRUD, server-side filtering with mandatory archive isolation (`archivedAt IS NULL`), multi-column sorting, text search, and server pagination (`Promise.all([findMany, count])`).
   - `LifecycleService`: Enforces the finite state machine (`NEW -> OPEN -> PENDING -> RESOLVED -> CLOSED`) and the 7-day reopen guard.
   - `SlaService`: Manages deadline calculations by priority, pauses active time on `PENDING`, resumes deadlines on customer replies, and tracks alert lifecycles across re-breach cycles (`slaCycle`).
   - `ReplyService`: Distinguishes public agent replies, customer messages, and internal notes, automatically triggering lifecycle transitions and SLA unpausing when customer replies arrive.
   - `CollaborationService`: Manages normalized many-to-many agent collaborations with atomic audit logging.
   - `AuditService`: Append-only event logger storing JSON old/new diffs. Strictly read-only to external clients.
   - `TimelineService`: Merges normalized `Reply` records and `AuditLog` events into a unified chronological activity feed.
   - `BulkService`: Processes batch reassignments and closures with per-ticket transaction isolation.
   - `DashboardService`: Executes high-performance SQL aggregations for headline metrics, workload breakdowns, and 8-week historical resolution trends.
   - `ExportService`: Streams RFC-4180 compliant CSV exports matching current queue filters.

4. **Data Access & Storage Tier (PostgreSQL + Prisma)**:
   - Normalized PostgreSQL database accessed via Prisma ORM.
   - Handles data persistence, unique constraints, foreign key cascades/set-null rules, and composite indexes (`(primaryAssigneeId, status, archivedAt)`, `(status, archivedAt, slaDueAt)`, `(userId, ticketId)`).

---

## Where does each piece run?

- **Browser**: React Server Component hydration, Client Components, live 1-second interval SLA countdown timers, modal overlays.
- **Application Server (Next.js Node.js Runtime on Vercel / Render)**: Middleware session extraction, REST API route handlers, policy validation, domain service logic, timeline merging, CSV generation, and Prisma query construction.
- **Database (PostgreSQL on Supabase / Docker)**: Relational tables, unique constraints, atomic ACID transactions, and analytical aggregations (`COUNT`, `GROUP BY`, `date_trunc`).

---

## What is the request path for one representative user action, end to end?

### Representative Action: Inbound Customer Reply (Pending $\rightarrow$ Open with SLA Clock Resumption)

1. **Client / Webhook Trigger**:
   - A customer sends a reply (or the reviewer clicks **"Simulate Customer Reply"** in the ticket workspace).
   - Browser sends `POST /api/tickets/cly12345/customer-reply` with `{ body: "Here is the Okta metadata XML file..." }`.

2. **API Route & Input Validation (`/app/api/tickets/[id]/customer-reply/route.ts`)**:
   - The route handler parses the request JSON, sanitizes string inputs, and delegates execution to `ReplyService.addCustomerReply(ticketId, data)`.

3. **Domain Service & State Machine Transition (`ReplyService.ts`)**:
   - The service opens an atomic database transaction (`prisma.$transaction`).
   - **Step 3a**: Inserts a new `Reply` row with `authorType: AuthorType.CUSTOMER`, `isInternal: false`, `body: "..."`.
   - **Step 3b**: Appends an `AuditLog` event of type `REPLY_ADDED`.
   - **Step 3c**: Inspects the ticket's current status. Since the ticket is in `PENDING`, it invokes `SlaService.computeStateOnStatusChange(ticket, Status.OPEN, now)`.
   - **Step 3d**: `SlaService` takes the stored `slaPausedRemainingSeconds` (e.g. 18 hours), calculates the new target deadline `slaDueAt = now() + 18 hours`, sets `slaPausedAt = null` and `slaPausedRemainingSeconds = null`, and updates the ticket status to `OPEN`.
   - **Step 3e**: Appends an immutable `AuditLog` event of type `STATUS_CHANGED` recording `oldValue: { status: "PENDING" }` and `newValue: { status: "OPEN" }` with metadata `{ reason: "Customer replied to ticket; SLA clock resumed" }`.
   - **Step 3f**: Calls `SlaService.syncAlertForTicket` to register or update active breach/due-soon alerts.

4. **Database Execution & Commit**:
   - PostgreSQL executes all operations inside the transaction. If any step fails, the entire operation rolls back.

5. **Response & Client UI Update**:
   - Server responds with HTTP 201 Created containing the reply object.
   - The React UI invalidates the ticket query, updates the status badge to `Open`, unpauses the live SLA countdown widget to display the resumed time, and appends the customer message and status audit pill to the activity timeline.

---

## What did you decide *not* to build, and why?

1. **No Microservices or Service Mesh**:
   - *Why rejected*: A ~12-hour assignment with strongly relational data (users, tickets, replies, audit events, SLA alerts) benefits from transactional consistency within a single database. Microservices would introduce network overhead, distributed transaction failures, eventual consistency edge cases, and deployment friction without solving a real scale bottleneck.

2. **No Kafka or Distributed Message Queues**:
   - *Why rejected*: Ticket movement and lifecycle state changes are relational database updates, not asynchronous high-throughput event streams. PostgreSQL transactions provide immediate consistency and audit reliability with zero external broker maintenance.

3. **No Redis Cache Layer**:
   - *Why rejected*: At this project scale, PostgreSQL executes indexed queries and aggregations in single-digit milliseconds. Adding Redis would introduce cache invalidation bugs (stale queue counts, out-of-sync SLA badges) without measurable latency gains.

4. **No Client-Side Authorization / Role Toggling**:
   - *Why rejected*: Client-side role switching is insecure and bypasses authentic access controls. We built real server-side authentication with signed HTTP-only cookies and seeded accounts (`supervisor@busy.com`, `sarah@busy.com`, etc.) to prove genuine server-side permission enforcement.

5. **No Continuous Background Polling for SLA Remaining Time**:
   - *Why rejected*: Storing a continuously decrementing integer column would require writing to every active ticket row in the database every second/minute. Instead, we use deadline-based math (`slaDueAt`), calculate remaining time once when entering `PENDING`, and compute live countdowns locally in the client browser.
