# System Architecture & Technical Design

## 1. System Overview & Moving Pieces

The platform is designed as a **Decoupled Microservice-Ready Architecture** composed of two completely isolated, independently deployable services:

- **Frontend Client Application (`frontend/` — Port 3000)**: Next.js 14 App Router, React 18, Tailwind CSS, Lucide icons.
- **Backend API & Domain Service (`backend/` — Port 3001)**: Next.js REST API route layer, modular domain controllers, policy enforcement engine, Prisma ORM, and PostgreSQL.

Both services maintain separate `package.json`, isolated `node_modules/`, independent TypeScript configurations, and dedicated `.env` files to ensure zero cross-tier dependency leaking.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Web Browser                            │
│  - Support Agent Workspace: Live SLA Countdowns, Queue, Timeline, Bulk  │
│  - Customer Portal: Ticket Submission, Public Tracking, CSAT Ratings    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP REST (CORS / Proxy)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Frontend Service (`frontend/` — Port 3000)             │
│  - Next.js 14 App Router (React 18 + Tailwind CSS + Lucide Icons)       │
│  - Typed API Client (`frontend/lib/api-client.ts`)                      │
│  - Reverse Proxy Rewrites: `/api/*` -> `http://localhost:3001/api/*`    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ JSON / HTTP-only Cookies
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Backend Service (`backend/` — Port 3001)               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. Routing & Route Registry Layer (`backend/routes/`)             │  │
│  │    - Auth, Ticket, Reply, Collaboration, SLA, CSAT, Bulk, Export  │  │
│  │    - Parameter parsing, HTTP error mapping, API_ROUTE_REGISTRY    │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 2. Security, Middleware & Policy Layer (`backend/models/policies`)│  │
│  │    - JWT Session Verification (`jose` + HTTP-only Cookie)         │  │
│  │    - Query-Level Security & Role Authorization (Super/Agent/Cust) │  │
│  │    - TicketPolicy, ReplyPolicy, CollaboratorPolicy, AlertPolicy   │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 3. Domain Controller & Service Layer (`backend/controllers/`)     │  │
│  │    - TicketController (CRUD, Filtering, Archival, Reassignment)   │  │
│  │    - LifecycleController (FSM: NEW->OPEN->PENDING->RESOLVED...)   │  │
│  │    - SlaController (Deadline math, Pause/Resume, Alert Sync)      │  │
│  │    - ReplyController (Agent/Customer replies, Internal notes)     │  │
│  │    - CollaborationController (Secondary agents, RBAC rules)       │  │
│  │    - TimelineController (Merged chronological activity feed)      │  │
│  │    - BulkController (Per-ticket isolated batch transactions)      │  │
│  │    - DashboardController (Analytical SQL KPI aggregations)        │  │
│  │    - ExportController (RFC-4180 streaming CSV generator)          │  │
│  │    - CsatController (Customer satisfaction ratings & feedback)    │  │
│  │    - AuditController (Immutable audit event logger)               │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    │ ACID Transactions & Multi-Index    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 4. Data Access Layer (`backend/db/` & `backend/prisma/`)          │  │
│  │    - Prisma ORM Client (`backend/db/prisma.db.ts`)                │  │
│  │    - Normalized PostgreSQL Database (Tables, FKs, Indexes, Enums) │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Boundaries & Responsibilities

### A. Routing & Route Registry Layer (`backend/routes/`)
- **Single Source of Truth for Routing**: Houses all HTTP handler functions (`auth.routes.ts`, `ticket.routes.ts`, `sla.routes.ts`, etc.) and the centralized `API_ROUTE_REGISTRY` catalog.
- **Protocol Boundary**: Unwraps HTTP request bodies, query strings, and headers; validates input types; invokes domain controllers; and maps domain responses or exceptions to standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Error`).
- **Thin Next.js Adapters**: Files under `backend/app/api/.../route.ts` are clean, single-line re-exports or delegates to the route handlers in `@/routes`.

### B. Security & Policy Engine (`backend/models/policies/` & `backend/middlewares/`)
- **Cryptographic Authentication**: Issues signed HTTP-only JWT session cookies using `jose` with 24-hour expiration. Passwords are salted and hashed with `bcryptjs`.
- **Three-Role Access Control**:
  - `SUPERVISOR`: Global visibility across all tickets, reassignments, bulk actions, and system-wide KPI analytics.
  - `AGENT`: Restricted to assigned tickets, collaborated tickets, or unassigned public queue tickets; can add collaborators and post internal notes; restricted from supervisor-only reassignments or bulk actions.
  - `CUSTOMER`: Strict row-level isolation. Customers can only view tickets where `requesterEmail` or `requesterId` matches their authenticated session, submit CSAT upon resolution, and reply to their own tickets. Customers are physically blocked from viewing internal notes, agent audit logs, or other customers' tickets.

### C. Domain Controller Layer (`backend/controllers/`)
- **Pure Business Logic**: Encapsulates transactional business logic without being coupled to HTTP request/response objects, enabling 100% unit-testability without mocking HTTP frameworks.
- **Finite State Machine (`LifecycleController`)**: Enforces legal state transitions (`NEW -> OPEN -> PENDING -> RESOLVED -> CLOSED -> REOPENED`) and the strict 7-day post-resolution reopen guard.
- **Zero-Write SLA Engine (`SlaController`)**: Calculates deadlines mathematically (`slaDueAt = createdAt + targetMinutes`). When a ticket is placed in `PENDING` (awaiting customer), active remaining seconds are captured once (`slaPausedRemainingSeconds`). When a customer replies, the clock is resumed (`slaDueAt = now + slaPausedRemainingSeconds`).
- **Unified Timeline Feed (`TimelineController`)**: Merges normalized `Reply` records and `AuditLog` events chronologically, suppressing redundant `REPLY_ADDED` audit entries to provide a clean, unified activity stream.

### D. Data Tier (`backend/prisma/` — PostgreSQL)
- Normalized relational schema with strict foreign keys (`ON DELETE CASCADE` on child replies/collaborators/alerts, `ON DELETE SET NULL` on assignee references).
- Composite indexes tailored for queue filtering and sorting:
  - `@@index([primaryAssigneeId, status, archivedAt])`
  - `@@index([status, archivedAt, slaDueAt])`
  - `@@index([requesterEmail, status])`
  - `@@index([userId, ticketId])`

---

## 3. End-to-End Request Trace: Customer Reply & SLA Resumption

To illustrate how data flows across all tiers, consider a customer replying to a `PENDING` ticket:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / Reviewer
    participant UI as Frontend UI (Port 3000)
    participant Route as Backend Route (reply.routes.ts)
    participant Auth as Auth & Policy Middleware
    participant Ctrl as ReplyController & SlaController
    participant DB as PostgreSQL (Prisma $transaction)

    Customer->>UI: Types reply in Customer Portal (or clicks "Simulate Customer Reply")
    UI->>Route: POST /api/tickets/{id}/customer-reply { body: "Here are the requested logs" }
    Route->>Auth: Validate Session / Token (Customer or Public Webhook)
    Auth-->>Route: Session Verified
    Route->>Ctrl: ReplyController.addCustomerReply(ticketId, data)
    Ctrl->>DB: BEGIN Transaction
    Ctrl->>DB: INSERT INTO "Reply" (ticketId, body, authorType="CUSTOMER", isInternal=false)
    Ctrl->>DB: INSERT INTO "AuditLog" (eventType="REPLY_ADDED")
    Note over Ctrl,DB: Check current ticket status. Status is PENDING.
    Ctrl->>Ctrl: SlaController.computeStateOnStatusChange(ticket, Status.OPEN, now)
    Note over Ctrl: Calculate resumed slaDueAt = now + slaPausedRemainingSeconds<br/>Set slaPausedAt = null, slaPausedRemainingSeconds = null
    Ctrl->>DB: UPDATE "Ticket" SET status="OPEN", slaDueAt=resumedDueAt
    Ctrl->>DB: INSERT INTO "AuditLog" (eventType="STATUS_CHANGED", reason="Customer replied; SLA clock resumed")
    Ctrl->>DB: UPDATE / UPSERT "SlaAlert" (sync warning/breach status)
    Ctrl->>DB: COMMIT Transaction
    DB-->>Ctrl: Transaction Committed
    Ctrl-->>Route: Return { reply, ticket }
    Route-->>UI: HTTP 201 Created { reply }
    UI->>Customer: Activity timeline updates live; Status switches to OPEN; SLA countdown unpauses
```

---

## 4. Intentional Non-Goals & Architecture Trade-offs

| Decision / Alternative | Rejected Approach | Chosen Approach | Rationale |
| :--- | :--- | :--- | :--- |
| **Backend API Structure** | Monolithic mixed API & UI | Decoupled `backend/` & `frontend/` services with dedicated `routes/` & `controllers/` layers | Prevents backend ORM/secrets from bundling into client code, allows independent scaling, and enables clear mental mapping of all API endpoints in one folder. |
| **SLA Tracking** | Background daemon polling every 60s to decrement DB integer counters | Mathematical deadline timestamps (`slaDueAt`, `slaPausedRemainingSeconds`) | Eliminates DB write amplification (zero writes per second for open tickets), prevents clock drift, and offloads 1-second countdown rendering to the client browser. |
| **Event Streaming** | Apache Kafka / RabbitMQ message brokers | Relational PostgreSQL ACID transactions + Append-only Audit Log | Ticket state updates and audit trails require strict transactional consistency. PostgreSQL eliminates distributed transaction failures and external broker operations. |
| **Collaboration Storage** | JSON array column on Ticket (`collaboratorIds: string[]`) | Normalized join table `ticket_collaborators` with `UNIQUE(ticketId, userId)` | Guarantees referential integrity, supports DB-level foreign key cascades, and enables high-performance indexed SQL joins for queue queries. |
| **Batch Processing** | Single atomic transaction for entire bulk list | Per-ticket isolated transactions with partial success reporting | Allows valid tickets to be committed with audit logs while reporting itemized refusal reasons for invalid tickets (e.g. attempting to close an already-closed ticket). |
| **Client Role Toggling** | Unauthenticated dropdown switching `role: "SUPERVISOR"` | Cryptographic server-side JWT session cookies & real seeded user accounts | Client-side role switching is insecure. Real server-side auth proves that all permission checks and row-level queries are genuinely enforced by the backend. |
