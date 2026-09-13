# Architecture

Answer each of these, in your own words, once the system has taken real shape.

- What are the moving pieces, and how do they talk to each other?
- Where does each piece run?
- What is the request path for one representative user action, end to end?
- What did you decide *not* to build, and why?

---

## 1. What are the moving pieces, and how do they talk to each other?

The platform is designed as a **Decoupled Architecture** composed of two completely isolated, independently deployable services that communicate over typed HTTP REST contracts:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               Client Web Browser                                │
│   - Support Agent Workspace: Live SLA Countdowns, Queue, Smart Assist, Bulk    │
│   - Customer Portal: Ticket Submission, Timeline Feed, CSAT Star Ratings        │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ HTTP REST (Port 3000 / Proxy)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Frontend Service (`frontend/` — Port 3000)                   │
│   - Next.js 14 App Router (React 18 + Tailwind CSS + Lucide Icons)              │
│   - Typed API Client (`frontend/lib/api-client.ts`)                             │
│   - Reverse Proxy Rewrites: `/api/*` -> `http://localhost:3001/api/*`           │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ JSON / Signed HTTP-only Cookie
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Backend Service (`backend/` — Port 3001)                     │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ 1. Routing & Route Registry Layer (`backend/routes/`)                   │   │
│   │    - Auth, Ticket, Reply, Collaboration, SLA, CSAT, Bulk, Export, Copilot│   │
│   │    - Parameter parsing, HTTP error mapping, centralized registry        │   │
│   └────────────────────────────────────┬────────────────────────────────────┘   │
│                                        ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ 2. Security, Middleware & Policy Layer (`backend/models/policies/`)     │   │
│   │    - JWT Session Verification (`jose` + HTTP-only Cookie)               │   │
│   │    - Query-Level Security & 3-Role Authorization (Supervisor/Agent/Cust)│   │
│   │    - TicketPolicy, ReplyPolicy, CollaboratorPolicy, AlertPolicy         │   │
│   └────────────────────────────────────┬────────────────────────────────────┘   │
│                                        ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ 3. Domain Controller & Service Layer (`backend/controllers/ & services/`)│   │
│   │    - TicketController (CRUD, Filtering, Archival, Reassignment)         │   │
│   │    - LifecycleController (FSM: NEW -> OPEN -> PENDING -> RESOLVED...)   │   │
│   │    - SlaController (Deadline math, Pause/Resume, Alert Sync)            │   │
│   │    - ReplyController (Agent/Customer replies, Internal notes)           │   │
│   │    - CollaborationController (Secondary agents, RBAC rules)             │   │
│   │    - TimelineController (Merged chronological activity feed)            │   │
│   │    - BulkController (Per-ticket isolated batch transactions)            │   │
│   │    - RecommendationService (Semantic Copilot RAG, Gemini embeddings)    │   │
│   │    - EmailService & DigestService (Resend transactional dispatch)       │   │
│   │    - DashboardController (Analytical SQL KPI aggregations)              │   │
│   │    - ExportController (RFC-4180 streaming CSV generator)                │   │
│   │    - CsatController (Customer satisfaction ratings & feedback)          │   │
│   └────────────────────────────────────┬────────────────────────────────────┘   │
│                                        │ ACID Transactions & Multi-Index        │
│                                        ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ 4. Data Access Layer (`backend/db/` & `backend/prisma/`)                │   │
│   │    - Prisma ORM Client (`backend/db/prisma.db.ts`)                      │   │
│   │    - Normalized PostgreSQL Database (Tables, FK Cascades, Enums)        │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown:
1. **Frontend Client (`frontend/`)**:
   - Renders the UI using Next.js 14 App Router, React 18, and Tailwind CSS.
   - Communicates exclusively via HTTP requests through `frontend/lib/api-client.ts`.
   - In development, Next.js rewrites (`next.config.js`) proxy `/api/*` to the backend on port 3001, allowing seamless CORS-free cookie transmission.
2. **Backend Route Layer (`backend/routes/`)**:
   - Central entry point containing all route handlers (`auth.routes.ts`, `ticket.routes.ts`, `sla.routes.ts`, `recommendation.routes.ts`, etc.).
   - Unwraps HTTP request bodies, handles query parameters, invokes controllers, and maps exceptions to standard HTTP response codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`).
3. **Policy Engine (`backend/models/policies/`)**:
   - Pure, stateless authorization predicates that evaluate whether an authenticated session (`SessionUser`) can perform an action on a ticket or reply.
   - Evaluated both during mutations and when computing client UI permission flags (`permissions.canReply`, `permissions.canReassign`, `permissions.canClose`).
4. **Domain Controllers (`backend/controllers/`)**:
   - Encapsulate business logic, state machine rules, SLA mathematics, and database queries. Completely decoupled from HTTP frameworks.
5. **Specialized Domain Services (`backend/services/`)**:
   - `EmbeddingService`: Generates 1536-dimensional semantic vectors using Google Gemini API (`text-embedding-004`) with an in-memory deterministic fallback.
   - `RecommendationService`: Finds semantically similar resolved tickets and KB articles above the 0.72 cosine similarity threshold.
   - `EmailService`: Sends transactional emails (agent invites, queue digests) using Resend API with automated console fallback in development.
   - `DigestService`: Generates HTML email digests with smart suppression for empty queues.
6. **Data Tier (`backend/prisma/`)**:
   - PostgreSQL database managed by Prisma ORM with 13 normalized relational models.

---

## 2. Where does each piece run?

| Moving Piece | Execution Environment | Port / Network Location | Key Runtime Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | Node.js / Vercel Edge Runtime | `localhost:3000` (Production: Vercel) | Renders server components, hydrates client React trees, manages client session state, and renders live 1-second interval SLA countdown timers. |
| **Backend REST API** | Node.js / Vercel Serverless / Render | `localhost:3001` (Production: Vercel/Render) | Executes business logic, enforces cryptographic JWT authentication, validates state transitions, evaluates policies, and coordinates database transactions. |
| **Database Tier** | Supabase Managed PostgreSQL | `aws-0-ap-northeast-2.pooler.supabase.com` | Stores relational data, enforces foreign key constraints (`ON DELETE CASCADE`, `ON DELETE SET NULL`), and manages composite B-tree indexes. |
| **Connection Pooler** | Supavisor (Supabase) | Port `6543` (Pooled Transaction Mode) | Multiplexes hundreds of concurrent application queries over 15 pooled connections with `pgbouncer=true`. |
| **Direct Migration DB** | PostgreSQL Session | Port `5432` (Direct Session Mode) | Dedicated direct connection used exclusively by Prisma CLI for running schema pushes and migrations. |
| **AI Embedding Service**| Google Gemini AI API | `generativelanguage.googleapis.com` | Generates 1536-dimensional vector embeddings for ticket resolutions and KB articles (with built-in deterministic fallback). |
| **Transactional Email** | Resend API | `api.resend.com` | Dispatches invitation emails and daily queue digests over HTTP REST with TLS. |

---

## 3. What is the request path for one representative user action, end to end?

### Representative Action: Customer Replies to a Ticket in `PENDING` Status
This action demonstrates cross-tier authentication, state machine transitions, SLA countdown resumption, audit log immutability, and database transactions:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Alice)
    participant UI as Frontend UI (Port 3000)
    participant Proxy as Next.js Proxy Rewrite
    participant Route as Backend Route (reply.routes.ts)
    participant Auth as Auth & Policy Middleware
    participant Ctrl as ReplyController & SlaController
    participant DB as PostgreSQL (Prisma $transaction)

    Customer->>UI: Enters reply message in Customer Portal and clicks "Send Reply"
    UI->>Proxy: POST /api/tickets/{ticketId}/customer-reply { body: "Here are the requested logs" }
    Proxy->>Route: Forward to http://localhost:3001/api/tickets/{ticketId}/customer-reply
    Route->>Auth: Extract signed HTTP-only cookie & verify JWT via `jose`
    Auth-->>Route: Verified Session (userId: "cust_1", role: "CUSTOMER")
    Route->>Ctrl: ReplyController.addCustomerReply(ticketId, data, sessionUser)
    Ctrl->>DB: Fetch current ticket state & verify ownership (requesterId === sessionUser.id)
    Note over Ctrl,DB: Ticket is currently in PENDING status.
    Ctrl->>DB: BEGIN Transaction
    Ctrl->>DB: INSERT INTO "replies" (ticketId, body, authorType="CUSTOMER", isInternal=false)
    Ctrl->>DB: INSERT INTO "audit_logs" (eventType="REPLY_ADDED", actorName="Alice Henderson")
    Ctrl->>Ctrl: SlaController.computeStateOnStatusChange(ticket, Status.OPEN, now)
    Note over Ctrl: Read frozen slaPausedRemainingSeconds.<br/>Compute resumed slaDueAt = now + slaPausedRemainingSeconds.<br/>Clear slaPausedAt = null, slaPausedRemainingSeconds = null.
    Ctrl->>DB: UPDATE "tickets" SET status="OPEN", slaDueAt=resumedDueAt, slaPausedAt=null
    Ctrl->>DB: INSERT INTO "audit_logs" (eventType="STATUS_CHANGED", reason="Customer replied; SLA resumed")
    Ctrl->>DB: UPSERT "sla_alerts" (update active alert deadline if applicable)
    Ctrl->>DB: COMMIT Transaction
    DB-->>Ctrl: Transaction Committed Successfully
    Ctrl-->>Route: Return { success: true, reply, ticket }
    Route-->>UI: HTTP 201 Created { reply, ticket }
    UI->>Customer: Activity timeline appends reply; badge switches to OPEN; SLA countdown resumes live ticking!
```

---

## 4. What did you decide *not* to build, and why?

| Feature / Architecture | What We Rejected | What We Chose Instead | Engineering Rationale |
| :--- | :--- | :--- | :--- |
| **SLA Tracking Daemon** | Background cron running every 60 seconds updating integer counters in the DB | Mathematical deadline timestamps (`slaDueAt`, `slaPausedRemainingSeconds`) | Background polling introduces severe database write amplification (thousands of DB writes per minute for idle open tickets) and clock drift. Mathematical deadlines require **zero database writes** while a ticket is open, and the client browser computes live 1-second countdowns on the fly. |
| **Realtime WebSockets** | Stateful WebSocket server (Socket.io / ws) with persistent connection state | Client-side mathematical countdowns + 15-second background polling | WebSocket connections require sticky sessions, complex reconnection logic, and persistent server state. Ticking countdowns calculated locally from `slaDueAt - Date.now()` deliver the same live user experience with zero stateful connection overhead. |
| **Monolithic Single Next.js App** | Merging frontend and backend in one repository sharing dependencies | Decoupled `frontend/` (Port 3000) and `backend/` (Port 3001) services | Prevents backend Prisma models, database connection strings, and server secrets from leaking into client bundles. Enables independent scaling, modular testing, and clear mental models. |
| **Single Monolithic Bulk Transaction** | Wrapping all selected bulk tickets in one giant `prisma.$transaction([ ... ])` | Per-ticket isolated transactions returning granular success/refusal details | In a support team, rolling back 19 valid operations because 1 ticket was already closed causes severe frustration. Per-ticket isolation commits valid operations while returning itemized refusal reasons in a summary modal. |
| **Client-Side Role Switcher** | Unauthenticated navbar dropdown that toggles `role = "SUPERVISOR"` in state | Cryptographic server-side JWT session cookies (`jose`) with bcrypt password hashing | Client-side persona toggles are security theater. Real server-side auth ensures that row-level queries, permission gates, and internal note exclusions are genuinely enforced by the backend. |
| **External Vector Database Tier (Pinecone / Qdrant)** | Provisioning an external vector SaaS database | In-memory cosine similarity engine with Google Gemini embeddings & deterministic fallback | Keeps the application completely self-contained and zero-dependency. Works on any standard PostgreSQL instance without requiring external SaaS vector subscriptions or database C-extensions. |
