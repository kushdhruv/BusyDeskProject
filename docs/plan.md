# Plan

## 1. How did you break the work into sessions?

The project began framed around a ~12-hour assignment scope (aiming for a pragmatic, simple modular monolith as reflected in early architectural sketches). However, building a truly production-grade enterprise support system—incorporating strict server-side policy enforcement, a 3-role security model, empirical scalability profiling on live Supabase, microservice decoupling, and five advanced stretch features—required an iterative, disciplined schedule. 

I structured the work across **8 focused engineering sessions totaling 18.0 actual hours** (against an initial budgeted estimate of 21.0 hours across phases). Rather than working in a single marathon, I scheduled blocks of 1.5 to 3.5 hours over multiple days. This allowed critical breathing room between sessions to research enterprise support patterns (Zendesk, Linear, Front), analyze PostgreSQL query planner mechanics (`EXPLAIN (ANALYZE, BUFFERS)`), and reason about concurrency and failure modes before writing code.

The build followed an **outside-in design, inside-out implementation** approach: beginning with requirements decomposition and state machine modeling, locking down relational schemas and security policies, implementing domain controllers and route handlers, and assembling the frontend against verified contracts before subjecting the system to empirical performance and security audits.

| Session | Focus Area | Estimated | Actual | Key Decisions & What Was Actually Built / Resolved |
|:---|:---|:---:|:---:|:---|
| **Session 1** | Problem decomposition, B2B SaaS research, state machine & SLA math | 3.5h | 3.0h | Researched enterprise ticketing platforms (Linear, Zendesk, Front). Defined finite state machine rules (`NEW → OPEN → PENDING → RESOLVED → CLOSED`) and 7-day reopen window. Formulated mathematical zero-write SLA deadline model (`slaDueAt`, `slaPausedRemainingSeconds`) to eliminate the 300,000 writes/hour polling daemon trap (**Decision 2**). Outlined 3-role authorization predicates and Supabase dual-pool connection architecture (port 6543 vs 5432). |
| **Session 2** | Relational schema design, composite indexing & dynamic seeding | 2.0h | 1.5h | Modeled 13 normalized relational tables in Prisma. Chose normalized `ticket_collaborators` join table with composite PK `(ticketId, userId)` over JSON arrays (**Decision 3**). Configured foreign key cascades, composite B-tree indexes, and GIN trigram indexes (`pg_trgm`). Built a dynamic seed generator (`prisma/seed.ts`) producing 8 weeks of historical tickets, SLA breaches, agent specialties, and CSAT distributions so development had realistic, high-volume data on Day 1. |
| **Session 3** | Core domain services, pure policy layer & SLA engine | 3.0h | 2.5h | Implemented domain controllers (`ticket.controller.ts`, `lifecycle.controller.ts`, `sla.controller.ts`). Built pure authorization policies (`models/policies/`) decoupled from HTTP contexts. Implemented zero-write SLA pause/resume formulas on `PENDING` transitions. Built chronological timeline merger (`timeline.controller.ts`), dynamically interleaving public replies, internal notes, and audit logs while suppressing redundant `REPLY_ADDED` audit events (**Decision 7**). |
| **Session 4** | Explicit route registry, session auth, bulk processor & CSV streaming | 2.5h | 2.0h | Created centralized `backend/routes/` with an explicit `API_ROUTE_REGISTRY` catalog, decoupling domain logic from HTTP routing. Implemented server-side signed JWT sessions (`jose` HS256) in HTTP-only cookies with bcrypt password hashing (**Decision 5**). Built `bulk.controller.ts` with per-ticket isolated transactions and granular itemized success/failure reporting (**Decision 4**). Implemented streaming RFC-4180 CSV export. |
| **Session 5** | Frontend B2B SaaS workspace, live SLA countdown & customer portal | 3.5h | 3.0h | Built Next.js 14 App Router UI with Linear/Intercom-inspired visual restraint (eliminating AI slop copy, excessive rounded cards, and decorative gradients). Built zero-network client-side 1-second live countdown timers (`slaDueAt - Date.now()`). Created filterable queue table, split-view ticket inspector, and Recharts 8-week dashboard. Built dedicated Customer Self-Service Portal (`frontend/components/customer/`) with strict row-level isolation and post-resolution CSAT star ratings + comments. |
| **Session 6** | Scalability audit, concurrency locking & set-based SQL optimization | 2.0h | 1.5h | Conducted empirical scalability profiling against live Supabase PostgreSQL in Seoul (`ap-northeast-2`). Discovered 68s SLA polling latency and a real race condition where concurrent client polling created duplicate breach alerts 437ms apart. Added database uniqueness `@@unique([ticketId, breachCycle])` and PostgreSQL transaction advisory locking (`pg_try_advisory_xact_lock`) (**Decision 8**). Rewrote SLA sync to set-based SQL upserts (`INSERT ... ON CONFLICT DO UPDATE`), slashing p50 latency from 67,976ms to 4,045ms (16.8× speedup). Replaced in-memory JavaScript dashboard date crunching with PostgreSQL `date_trunc('week', "resolvedAt")` aggregation. |
| **Session 7** | Architectural decoupling: monolith to microservices | 1.5h | 1.5h | Reassessed monolithic Next.js repository as domain complexity grew: observed server/client type coupling and bundle pollution risks (**Decision 1**). Explicitly partitioned the codebase into independent `frontend/` (Port 3000) and `backend/` (Port 3001) packages with isolated `package.json`, dependencies, and `tsconfig.json`. Configured cross-port CORS cookie forwarding (`credentials: "include"`, `SameSite=Lax`) and Next.js reverse-proxy rewrites (`next.config.js`). Validated dual deployment readiness (Vercel edge UI + Render/AWS REST API). |
| **Session 8** | Advanced extensions: Semantic Copilot RAG, resilient email & security audit | 3.0h | 3.0h | Built Semantic Knowledge Copilot (`embedding.service.ts` + `recommendation.service.ts`): initially attempted `pgvector`, but reversed to application cosine similarity with Google Gemini RAG + deterministic vector fallback for zero-friction portability across pooled databases (**Decision 6**). Built free-form tag taxonomy with 5 orthogonal groups and group exclusivity rules. Built secure single-use agent invitation system (`sha256` token storage, 24h TTL, `/setup-account` workflow). Built dual-provider email service (`email.service.ts`), debugging Render Linux container IPv6 SMTP connection hangs by enforcing IPv4 `family: 4` and 6.5s timeout guards (**Decision 9**). Executed full 25-suite / 195-test Vitest regression audit. |
| **Total** | | **21.0h** | **18.0h** | **Comprehensive research, 10 core requirements + 5 production stretch features, empirical performance audit, and 195 automated tests.** |

---

## 2. What order did you build in, and why that order?

I followed an **outside-in domain design, inside-out technical implementation** sequence:

```
[ 1. State Machine & SLA Math ]
       │  (FSM transitions, zero-write deadline formulas, 7-day reopen window)
       ▼
[ 2. Relational Schema & Dynamic Seeder ]
       │  (13 Prisma models, composite indexes, 8 weeks of historical seed data)
       ▼
[ 3. Pure Authorization Policies & Domain Controllers ]
       │  (Decoupled pure predicates, zero-write SLA pause/resume, timeline merger)
       ▼
[ 4. Route Registry, Auth & Bulk Transactions ]
       │  (API_ROUTE_REGISTRY catalog, signed JWT cookies, per-ticket bulk isolation)
       ▼
[ 5. Frontend B2B Workspace & Customer Portal ]
       │  (Linear-inspired UI, 1s client countdowns, customer portal, CSAT reviews)
       ▼
[ 6. Scalability Profiling & Concurrency Hardening ]
       │  (PostgreSQL advisory locking, set-based SQL upserts, date_trunc aggregation)
       ▼
[ 7. Monolith-to-Microservice Decoupling ]
       │  (Independent frontend:3000 / backend:3001 services, proxy rewrites, CORS cookies)
       ▼
[ 8. Advanced Extensions & Adversarial QA Audit ]
       │  (Semantic Copilot RAG, dual-mode IPv4 email, agent invites, 195 Vitest tests)
```

1. **State Machine & Lifecycle Invariants First (Outside-In Modeling)**:
   - *What*: Before touching database code or UI components, I formally specified the finite state machine (`NEW → OPEN → PENDING → RESOLVED → CLOSED`), legal state transitions, the SLA clock pause mechanics in `PENDING`, and the 7-day closed ticket reopen window.
   - *Why*: In a support ticketing system, if your lifecycle transitions or SLA pause mechanics are ambiguous, every controller, UI badge, policy guard, and database query you build afterwards will require structural rewrites.

2. **Relational Schema & Realistic Dynamic Seeding Second (Inside-Out Foundation)**:
   - *What*: Modeled 13 normalized Prisma tables with strict foreign keys, cascade hygiene, composite B-tree indexes, and GIN trigram indexes. Crucially, I authored a comprehensive dynamic seeder (`prisma/seed.ts`) immediately, generating 30+ realistic tickets, specialized agents, customer accounts, active SLA breaches, and 8 weeks of resolution history with CSAT ratings.
   - *Why*: Building against an empty or toy database is a cardinal mistake—it masks pagination bugs, layout breaks, sorting defects, and query planner degradations. Having realistic volume on Day 1 provided immediate, authentic feedback.

3. **Pure Policy Layer & Domain Controllers Third**:
   - *What*: Implemented authorization rules as pure functions in `models/policies/` (`TicketPolicy`, `ReplyPolicy`, `TagPolicy`) completely decoupled from HTTP request/response objects. Domain controllers in `controllers/` handled business logic, transactions, and audit logging.
   - *Why*: Authorization policies are safest and easiest to test when they take plain entity inputs and return boolean results without mocking HTTP headers, cookies, or framework contexts. If authorization is embedded inside UI components or API handlers, privilege escalation bugs inevitably emerge.

4. **Dedicated Route Registry Layer & Session Auth Fourth**:
   - *What*: Created `backend/routes/` with an explicit `API_ROUTE_REGISTRY` catalog. Built server-side signed JWT sessions (`jose` HS256) in HTTP-only cookies, bcrypt password hashing, per-ticket isolated transactions with itemized partial failure reporting (`bulk.controller.ts`), and streaming RFC-4180 CSV export.
   - *Why*: Keeping the route layer explicit and thin ensured that HTTP transport concerns (parsing bodies, status code mapping) were cleanly separated from domain logic, making the entire API surface transparent and auditable.

5. **Frontend Workspace, Live Countdowns & Customer Portal Fifth**:
   - *What*: Once backend contracts were stable, I assembled the Next.js 14 frontend: the queue workspace, client-side live 1-second countdowns (`slaDueAt - Date.now()`), split-view ticket inspector, Recharts 8-week dashboard, and dedicated Customer Self-Service Portal (`frontend/components/customer/`).
   - *Why*: Frontend implementation became rapid assembly rather than guesswork because every endpoint, payload shape, and error code was already defined, verified, and backed by realistic seed data.

6. **Scalability Profiling & Concurrency Hardening Sixth**:
   - *What*: Stress-tested the system against live Supabase PostgreSQL (`ap-northeast-2`), exposing an $O(N)$ SLA polling bottleneck and duplicate alert race conditions under concurrent client tabs. Implemented PostgreSQL transaction advisory locking (`pg_try_advisory_xact_lock`), `@@unique([ticketId, breachCycle])`, and set-based SQL upserts (`INSERT ... ON CONFLICT DO UPDATE`).
   - *Why*: Concurrency defects and N+1 query loops rarely surface during basic functional testing. Profiling early under simulated multi-worker traffic allowed us to harden the database engine before deploying to production.

7. **Monolith-to-Microservice Decoupling Seventh**:
   - *What*: Partitioned the initial Next.js monolith into independent `frontend/` and `backend/` packages with isolated `package.json` files, dependencies, and `tsconfig.json`. Configured cross-port CORS cookie forwarding and Next.js reverse-proxy rewrites.
   - *Why*: As domain logic expanded, having backend Prisma models, database connection strings, and server-side secrets in the same package as client components created bundling risks. Decoupling enforced total dependency isolation and enabled independent service scaling.

8. **Advanced Extensions & Adversarial QA Audit Eighth**:
   - *What*: Built the Semantic Knowledge Copilot (Gemini RAG with deterministic vector fallback), free-form tagging taxonomy, secure agent invitations, and dual-provider email service. Authored 25 test suites with 195 assertions covering lifecycle invariants, role-based security, SLA pause/resume math, and query fuzzing.

---

## 3. What did you estimate versus what it actually took?

### What matched estimates closely:
- **Domain Controllers & Lifecycle Logic** (Estimated 2.5h, took 2.5h): Because the finite state machine and mathematical SLA formulas were thoroughly mapped out in Session 1, implementing `LifecycleController` and `SlaController` proceeded without architectural churn.
- **Relational Schema Design** (Estimated 2.0h, took 1.5h): Prisma's declarative schema made defining models, foreign key cascades, and composite indexes rapid and predictable.
- **Frontend Core Workspace UI** (Estimated 3.5h, took 3.0h): Having rich seed data and stable REST contracts meant zero backend churn during UI development, allowing full focus on B2B SaaS aesthetics and responsive layouts.

### What took more time and iteration than estimated:

1. **SLA Alert Concurrency, Duplicate Alerts & Advisory Locking**:
   - *Estimate*: 30 minutes to query candidate tickets and flag breach records.
   - *Reality*: 1.5 hours. During empirical benchmarking with multiple active browser tabs polling `/api/sla/alerts` every 15 seconds, I discovered that concurrent requests raced to insert duplicate active alerts for the same ticket (created just 437ms apart). Furthermore, the unoptimized sequential loop created an $O(N)$ DB round-trip spike taking ~68 seconds under load. Resolving this required:
     - Adding a database-level composite uniqueness constraint: `@@unique([ticketId, breachCycle])` on `SlaAlert`.
     - Implementing PostgreSQL transaction advisory locking (`SELECT pg_try_advisory_xact_lock(hashtext('sla_alert_sync'))`) so concurrent polling requests skip redundant write reconciliations and immediately execute fast, indexed reads with zero lock waiting.
     - Rewriting the alert synchronization into set-based SQL upserts (`INSERT ... ON CONFLICT DO UPDATE`), dropping p50 latency from 67,976ms to 4,045ms (16.8× faster).

2. **Microservice Decoupling & Cross-Port Cookie Forwarding**:
   - *Estimate*: 45 minutes to split directory trees and `package.json` files.
   - *Reality*: 1.5 hours. Separating the Next.js monolith into `frontend/` (Port 3000) and `backend/` (Port 3001) introduced subtle browser transport hurdles:
     - Browsers treat different ports on `localhost` as distinct origins for CORS, requiring precise CORS headers (`Access-Control-Allow-Credentials: true`, `SameSite=Lax`).
     - In production, Next.js reverse-proxy rewrites in `next.config.js` (`/api/:path* → backend:3001/api/:path*`) had to be tuned to forward HTTP-only session cookies transparently between edge client components and the backend container.

3. **Timezone Boundary Discrepancies in Dashboard SQL**:
   - *Estimate*: 30 minutes to chart the last 8 weeks of resolutions.
   - *Reality*: 1.0 hour. In Node.js, `weekStart.setHours(0,0,0,0)` produces local midnight. On machines with timezone offsets (e.g., UTC+5:30), `.toISOString().split("T")[0]` produced Sunday dates while text labels displayed Monday, causing an off-by-one discrepancy against PostgreSQL's `date_trunc('week', ...)`. I had to strictly normalize all date bucketing to UTC (`getUTCDay()`, `setUTCDate()`, `setUTCHours(0,0,0,0)`) to guarantee identical results regardless of local server locale.

4. **Production SMTP Relay on Linux Containers (IPv6 Route Hanging)**:
   - *Estimate*: 20 minutes for email notification dispatch.
   - *Reality*: 1.0 hour. Resend's free tier restricts deliveries strictly to the account owner's email without a verified custom corporate domain. When adding Gmail SMTP via `nodemailer` as a universal fallback, Render's Linux containers hung indefinitely because Node attempted to route SMTP connections over unrouted IPv6 interfaces, exhausting the 60-second HTTP timeout. I had to enforce IPv4 resolution (`family: 4`), implement dual-port fallback (587 then 465), and add strict 6.5-second connection timeout guards.

---

## 4. What did you cut when you ran short?

To keep the system robust, production-grade, and completed within a realistic timeframe, I made four deliberate architectural cuts:

1. **Cut Stateful WebSocket Cluster (Socket.io / Redis PubSub)**:
   - *Why*: Managing a stateful WebSocket cluster introduces connection state, heartbeat handling, sticky sessions, reconnect backoff, and distributed pub/sub infrastructure.
   - *What I did instead*: Built **client-side mathematical countdowns** (`slaDueAt - Date.now()`) that update every second locally in the browser with **zero network traffic**. Paired this with a 15-second background poll for queue list updates and a lightweight Server-Sent Events (SSE) stream (`/api/tickets/[id]/events`) for live ticket chat.

2. **Cut External Redis Caching Cluster**:
   - *Why*: Introducing Redis creates a separate point of failure, increases deployment complexity, and creates cache invalidation bugs across frequent ticket mutations, status updates, and reassignments.
   - *What I did instead*: Leveraged PostgreSQL composite B-tree indexes, single-query set-based SQL joins, and a lightweight 15-second in-memory server cache for the supervisor dashboard with event-driven invalidation on ticket mutations.

3. **Cut Database-Level `pgvector` C-Extension Prerequisite**:
   - *Why*: `pgvector` requires root database extension privileges or custom compiled binaries that are often unsupported or cumbersome to manage in standard serverless database transaction poolers (such as Supabase port 6543 where `vector` is not a native Prisma type).
   - *What I did instead*: Implemented the Semantic Knowledge Copilot with application-level cosine similarity in Node.js. It calls Google Gemini for vector embeddings when available, with an automatic deterministic n-gram vector fallback if the API key is absent or rate-limited. This makes the application 100% portable across any PostgreSQL or SQLite environment with zero setup friction (**Decision 6**).

4. **Cut Heavy Multi-Part S3 Cloud Storage Infrastructure**:
   - *Why*: Setting up AWS IAM roles, bucket policies, and presigned URLs adds operational overhead without improving the core support queue evaluation.
   - *What I did instead*: Built a secure local/streamed upload endpoint (`/api/upload`) with strict file type validation, 15MB size limits, sanitized unique filenames, directory traversal guards, and direct inline image/PDF previews in the chat timeline.
