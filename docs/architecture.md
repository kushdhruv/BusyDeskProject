# Architecture

## 1. What are the moving pieces, and how do they talk to each other?

The platform is engineered as a **Decoupled System** composed of an independent frontend client and a modular REST API backend. Each service maintains its own `package.json`, isolated `node_modules`, `tsconfig.json`, and environment configuration. They communicate strictly over typed HTTP REST contracts using JSON payloads and signed HTTP-only cookies.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                Client Browser                                    │
│   • Staff Workspace: Queue Table, Live SLA Countdowns, Split Inspector, Copilot  │
│   • Customer Portal: Ticket Submission, Public Conversation Feed, CSAT Ratings   │
│   • Supervisor Hub: Team Administration, Tag Governance, Analytics Dashboard     │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTP REST (Port 3000 / Next.js Proxy)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   Frontend Service (`frontend/` — Port 3000)                     │
│   • Next.js 14 App Router (React 18 Server & Client Components, Tailwind CSS)   │
│   • Typed REST Client (`frontend/lib/api-client.ts`)                            │
│   • Global Session Context (`frontend/lib/session-context.tsx`)                 │
│   • Reverse Proxy Rewrites: `/api/:path*` ➔ `http://localhost:3001/api/:path*`   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ JSON / Signed HTTP-only Cookie (`session_token`)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    Backend Service (`backend/` — Port 3001)                      │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ 1. API Route Layer (`backend/routes/`)                                   │   │
│   │    • Central `API_ROUTE_REGISTRY` mapping all endpoints                  │   │
│   │    • Unwraps HTTP requests, extracts parameters, validates inputs        │   │
│   │    • Maps domain exceptions to standard HTTP status codes (400, 401, 403)│   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ 2. Security & Policy Layer (`backend/models/policies/`)                  │   │
│   │    • JWT Session Verification (`jose` HS256 in secure HTTP-only cookies) │   │
│   │    • Pure predicate authorization: `TicketPolicy`, `ReplyPolicy`,        │   │
│   │      `TagPolicy`, `AlertPolicy`                                          │   │
│   │    • Query-level data isolation (Customer row-level scoping)             │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ 3. Domain Controllers & Business Engines (`backend/controllers/`)        │   │
│   │    • `TicketController`: CRUD, multi-criteria filtering, soft-archive    │   │
│   │    • `LifecycleController`: FSM state transitions, 7-day reopen guard    │   │
│   │    • `SlaController`: Zero-write deadline math, pause/resume, alerts     │   │
│   │    • `ReplyController`: Agent/customer messages, staff-only notes        │   │
│   │    • `CollaborationController`: Multi-agent assignments, RBAC rules      │   │
│   │    • `BulkController`: Per-ticket isolated transactions & error reporting│   │
│   │    • `TimelineController`: Interleaved chronological feed merge          │   │
│   │    • `DashboardController`: SQL aggregation, 8-week trend, CSAT KPIs     │   │
│   │    • `ExportController`: Streaming RFC-4180 CSV generation               │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ 4. Specialized Auxiliary Services (`backend/services/`)                  │   │
│   │    • `EmbeddingService`: 1536-d vectors via Gemini API + deterministic   │   │
│   │      keyword hash fallback (cached in-memory)                            │   │
│   │    • `RecommendationService`: Cosine similarity ranking (>0.52 / >0.22)  │   │
│   │    • `EmailService`: Dual-provider dispatch (Gmail SMTP via nodemailer  │   │
│   │      with IPv4 enforcement + Resend API + dev console fallback)          │   │
│   │    • `DigestService`: HTML queue briefings with smart empty suppression  │   │
│   │    • `ticketBroadcaster`: Lightweight in-memory SSE event bus            │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ 5. Data Access Layer (`backend/db/` & `backend/prisma/`)                 │   │
│   │    • Prisma ORM Client with dual-URL pooling configuration               │   │
│   │    • ACID Transactions (`prisma.$transaction`)                          │   │
│   └──────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ PostgreSQL Connection Pools
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                  Database Tier (Managed Supabase PostgreSQL 15)                  │
│   • Transaction Pooler (Supavisor Port 6543): Multiplexes web queries           │
│   • Direct Session (Port 5432): Used by Prisma CLI for schema migrations         │
│   • 13 Relational Models, Composite B-Tree Indexes & GIN Trigram Search Indexes  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Component Roles & Boundaries

1. **Frontend (`frontend/`)**:
   - Built on Next.js 14 App Router, React 18, and Tailwind CSS.
   - Operates purely as a presentation and interaction layer. It contains zero database drivers, ORM code, or server-side secrets.
   - Communicates with the backend through a typed API client (`frontend/lib/api-client.ts`). In development, Next.js rewrites (`next.config.js`) proxy `/api/*` requests to `localhost:3001`, enabling seamless cross-port cookie transmission without CORS preflight friction.
   - Calculates live 1-second SLA countdowns locally in the browser from `slaDueAt - Date.now()`, eliminating constant network polling for timer updates.

2. **Backend Route Layer (`backend/routes/`)**:
   - Houses an explicit `API_ROUTE_REGISTRY` catalog listing all endpoints, allowed HTTP methods, authentication requirements, and authorized roles.
   - Each route module (e.g. `ticket.routes.ts`, `auth.routes.ts`) handles parameter extraction, invokes the domain controller, and maps errors to clear HTTP response codes (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`).
   - The Next.js API route files (`backend/app/api/.../route.ts`) are clean one-line delegates pointing directly into `backend/routes/`. This keeps the API fully decoupled from Next.js server internals and directly testable in Vitest without mocking HTTP contexts.

3. **Policy Engine (`backend/models/policies/`)**:
   - Implements declarative, pure authorization predicates: `TicketPolicy`, `ReplyPolicy`, `CollaboratorPolicy`, `TagPolicy`, and `AlertPolicy`.
   - Each policy function accepts the target entity and the authenticated `SessionUser`, returning a boolean or structured refusal reason.
   - Evaluated identically during mutation requests and when computing client UI permission flags (`permissions.canReply`, `permissions.canReassign`, `permissions.canClose`).

4. **Domain Controllers (`backend/controllers/`)**:
   - Encapsulate all core business logic: finite state machine rules, zero-write SLA mathematics, multi-agent collaboration integrity, bulk execution, and audit logging.
   - Run multi-step database mutations inside PostgreSQL ACID transactions (`prisma.$transaction`).

5. **Specialized Domain Services (`backend/services/`)**:
   - `EmbeddingService`: Generates 1536-dimensional semantic vector embeddings via the Google Gemini API (`text-embedding-004`). Includes an in-memory LRU cache and an automated deterministic n-gram vector fallback if the API key is absent or hits rate limits.
   - `RecommendationService`: Evaluates cosine similarity between open tickets and historical resolutions/KB articles, applying a category-affinity boost (+0.12) to surface high-signal suggested solutions above the reply composer.
   - `EmailService`: Dispatches transactional emails (agent invitations and daily queue digests) using a resilient dual-provider architecture: Gmail SMTP via `nodemailer` (with forced IPv4 and strict timeouts) as the primary arbitrary-recipient sender, Resend API as secondary, and local console logging as dev fallback.
   - `DigestService`: Compiles role-aware HTML queue briefings for agents and weekly summaries for supervisors, with smart suppression when queues are empty.
   - `ticketBroadcaster`: An in-memory event bus providing Server-Sent Events (SSE) at `GET /api/tickets/[id]/events` for real-time conversation updates without page reloads.

6. **Data Tier (`backend/prisma/`)**:
   - 13 normalized relational tables hosted on PostgreSQL, enforcing foreign key cascades, uniqueness invariants, and composite B-tree and GIN trigram indexes.

---

## 2. Where does each piece run?

| Component | Runtime Environment | Network Location | Key Operational Responsibilities |
|:---|:---|:---|:---|
| **Frontend UI** | Node.js (Local) / Vercel Edge | `localhost:3000` (Production: Vercel) | Hydrates React component tree, runs client-side SLA countdowns, manages UI state, proxies `/api/*` to backend. |
| **Backend REST API** | Node.js (Local) / Render / Vercel Serverless | `localhost:3001` (Production: Render/Vercel) | Executes business logic, verifies JWTs, enforces authorization policies, coordinates ACID transactions. |
| **Database Tier** | Managed Supabase PostgreSQL 15 | AWS `ap-northeast-2` (Seoul) | Enforces relational constraints, cascades, foreign keys, unique constraints, and composite indexes. |
| **Connection Pooler** | Supavisor (Supabase Pooler) | Port `6543` (`pgbouncer=true`) | Multiplexes concurrent application queries over a constrained connection pool in transaction mode. |
| **Direct Migration Port** | PostgreSQL Session | Port `5432` | Direct connection mode used exclusively by Prisma CLI for running schema migrations and seed scripts. |
| **AI Embedding API** | Google Gemini Generative Language API | `generativelanguage.googleapis.com` | Computes 1536-dimensional semantic vectors for KB articles and ticket resolutions (with automatic offline fallback). |
| **Transactional Email** | Gmail SMTP / Resend API | `smtp.gmail.com` / `api.resend.com` | Delivers agent invitation links and queue digest briefings over TLS. |

---

## 3. What is the request path for one representative user action, end to end?

### Representative Flow: A Customer Replies to a Ticket in `PENDING` Status

This action exercises cross-tier proxying, authentication, ownership validation, finite state machine transitions, mathematical SLA resumption, immutable audit logging, and real-time SSE broadcasting:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Alice)
    participant Browser as Browser Client (Port 3000)
    participant Proxy as Next.js Proxy Rewrite
    participant Route as Backend Route (reply.routes.ts)
    participant Auth as Auth Middleware & Policy
    participant Ctrl as ReplyController & SlaController
    participant DB as PostgreSQL (Supabase Prisma $transaction)
    participant SSE as ticketBroadcaster (SSE)
    actor Agent as Assigned Agent (Sarah)

    Customer->>Browser: Enters reply message & clicks "Send Reply"
    Browser->>Proxy: POST /api/tickets/{ticketId}/customer-reply { body: "Here are the requested logs." }
    Proxy->>Route: Forward to http://localhost:3001/api/tickets/{ticketId}/customer-reply
    Route->>Auth: Verify signed HTTP-only cookie (`session_token`) via `jose`
    Auth-->>Route: Authenticated Session (userId: "cust_1", role: "CUSTOMER", status: "ACTIVE")
    Route->>Ctrl: ReplyController.addCustomerReply(ticketId, data, sessionUser)
    Ctrl->>DB: Fetch ticket by ID & verify requester ownership (requesterId === "cust_1")
    Note over Ctrl,DB: Ticket is currently in PENDING status (waiting on customer).
    
    Ctrl->>DB: BEGIN Transaction
    Ctrl->>DB: INSERT INTO "replies" (ticketId, authorId, authorType="CUSTOMER", body, isInternal=false)
    Ctrl->>DB: INSERT INTO "audit_logs" (eventType="REPLY_ADDED", actorName="Alice Henderson")
    
    Ctrl->>Ctrl: SlaController.computeStateOnStatusChange(ticket, Status.OPEN, now)
    Note over Ctrl: Read frozen slaPausedRemainingSeconds.<br/>Compute resumed slaDueAt = now + slaPausedRemainingSeconds.<br/>Clear slaPausedAt = null, slaPausedRemainingSeconds = null.
    
    Ctrl->>DB: UPDATE "tickets" SET status="OPEN", slaDueAt=resumedDueAt, slaPausedAt=null, slaPausedRemainingSeconds=null
    Ctrl->>DB: INSERT INTO "audit_logs" (eventType="STATUS_CHANGED", oldValue="PENDING", newValue="OPEN", reason="Customer replied; SLA clock resumed")
    Ctrl->>DB: UPSERT "sla_alerts" (sync alert record to resumed deadline)
    Ctrl->>DB: COMMIT Transaction
    DB-->>Ctrl: Transaction Committed Successfully
    
    Ctrl->>SSE: ticketBroadcaster.broadcast(ticketId, { type: "REPLY_ADDED", reply })
    SSE-->>Agent: Live message pushed to active agent workspace without page reload
    Ctrl->>Ctrl: invalidateMetricsCache() (clears 15s supervisor dashboard cache)
    Ctrl-->>Route: Return { success: true, reply, ticket }
    Route-->>Browser: HTTP 201 Created { reply, ticket }
    Browser->>Customer: Reply appears in conversation feed; status badge switches to OPEN; SLA countdown resumes ticking!
```

---

## 4. What did you decide *not* to build, and why?

Every architectural boundary involves balancing correctness, operational overhead, and maintainability. Here is what I deliberately chose *not* to build:

| Proposed Feature / Pattern | What Was Rejected | What Was Chosen Instead | Engineering Rationale |
|:---|:---|:---|:---|
| **SLA Tracking Daemon** | A background cron or `setInterval` worker running every 60s executing `UPDATE tickets SET remainingSeconds = remainingSeconds - 60 WHERE status = 'OPEN'`. | **Mathematical Deadline Timestamps** (`slaDueAt`, `slaPausedAt`, `slaPausedRemainingSeconds`). | A polling worker creates catastrophic database write amplification: 5,000 open tickets generate 300,000 DB writes per hour for tickets sitting idle, causing lock contention and clock drift. Mathematical deadlines require **zero database writes** while a ticket is open, and the client browser computes live 1-second countdowns locally. |
| **Stateful WebSocket Server** | A persistent WebSocket cluster (Socket.io / ws) with Redis pub/sub for queue updates. | **Client-side countdown math + 15s queue polling + lightweight SSE for chat.** | WebSockets require persistent stateful server instances, sticky load balancer sessions, complex reconnection backoff, and cluster pub/sub. Ticking countdowns calculated locally from `slaDueAt - Date.now()` deliver the same live user experience with zero stateful connection overhead. Ticket chat uses lightweight, one-way Server-Sent Events (SSE). |
| **Monolithic Unified Repo** | Merging frontend and backend into a single Next.js app sharing the same `package.json` and build step. | **Decoupled `frontend/` and `backend/` services** with reverse-proxy routing. | Prevents backend Prisma models, database connection strings, bcrypt binaries, and server-side secrets from accidentally leaking into client bundles. Enables independent test execution (`npm test` in backend runs in seconds without compiling React pages) and modular cloud deployment. |
| **Single Monolithic Bulk Transaction** | Wrapping all selected bulk tickets into a single `prisma.$transaction([ ... ])`. | **Per-ticket isolated transactions** returning granular itemized success and refusal details. | If a supervisor selects 20 tickets to bulk-close and one is already closed or ineligible, rolling back all 19 valid operations creates immense operator frustration. Per-ticket isolation commits valid operations while returning itemized refusal reasons in a summary modal, fulfilling the assignment's explicit partial failure requirement. |
| **Client-Side Role Switcher** | An unauthenticated navbar dropdown that toggles `user.role` in React state or `localStorage`. | **Server-side signed JWT cookies (`jose`)** paired with bcrypt password hashing and database status checks. | Client-side persona toggles are security theater. Real server-side auth ensures that row-level queries, permission gates, and internal note exclusions are genuinely enforced by the backend, as required by the specification. |
| **External Vector Database Tier** | Provisioning an external vector SaaS database (Pinecone / Qdrant) or compiling `pgvector` C-extensions. | **In-memory cosine similarity engine** with Google Gemini API embeddings and an automated deterministic n-gram vector fallback. | Keeps the application completely self-contained and zero-dependency. Works reliably on any standard PostgreSQL instance or Supabase transaction pooler without requiring external SaaS vector subscriptions or custom binary database extensions. |
| **Heavy Multi-Part S3 Cloud Storage** | Setting up AWS S3 buckets, IAM credentials, and presigned upload URLs. | **Native file upload endpoint (`/api/upload`)** with file type sanitization, 15MB limits, and direct preview chips. | Eliminates unnecessary external cloud infrastructure while providing a fully working, secure file attachment experience for images, logs, and PDFs directly in ticket conversations. |
