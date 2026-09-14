# Plan

## 1. How did you break the work into sessions?

I budgeted approximately 18 to 20 hours across a week, working in focused 1.5 to 3.5 hour blocks. In reality, deep research, the core requirements, five production-grade stretch features, scalability optimizations, and cloud deployment hardening took approximately **18.0 hours across 8 sessions** (against an estimate of 21.0 hours). 

Rather than jumping straight to UI scaffolding or superficial forms, I structured the build from the inside out: beginning with intensive research and domain modeling, locking down the database schema and security policies, implementing domain controllers and route handlers, and then assembling the frontend against verified contracts.

| Session | Focus Area | Estimated | Actual | What Was Actually Built / Resolved |
|:---|:---|:---:|:---:|:---|
| **Session 1** | Deep research, B2B SaaS analysis, domain contracts & architecture | 3.5h | 3.0h | Extensive research into B2B support ticketing platforms (Zendesk, Linear, Front); architectural exploration of zero-write SLA models vs polling write amplification; finite state machine (FSM) rules; 3-role authorization predicates; Supabase connection pooling (port 6543 vs 5432). |
| **Session 2** | Relational schema, indexing strategy & realistic dynamic seed data | 2.0h | 1.5h | 13 normalized relational models in Prisma, foreign key cascade hygiene, composite B-tree indexes, GIN trigram indexes (`pg_trgm`), and an extensive dynamic seed generator simulating 8 weeks of historical tickets, multi-tier agents, SLA breaches, and CSAT distributions. |
| **Session 3** | Pure policy authorization engine & domain controllers | 3.0h | 2.5h | Pure predicate authorization policies (`models/policies/`), finite state machine (`LifecycleController`), 7-day reopen guard, zero-write SLA calculator (`SlaController`) with mathematical pause/resume, and interleaved chronological timeline merger (`TimelineController`). |
| **Session 4** | Route registry layer, session auth, bulk processor & CSV streaming | 2.5h | 2.0h | Explicit `API_ROUTE_REGISTRY` catalog, signed HTTP-only JWT cookies via `jose`, bcrypt password hashing, per-ticket isolated transactions with itemized partial failure reporting (`BulkController`), and RFC-4180 streaming CSV exporter. |
| **Session 5** | Frontend B2B SaaS workspace UI, live SLA countdowns & customer portal | 3.5h | 3.0h | Next.js 14 App Router UI, client-side live 1-second countdowns (`slaDueAt - Date.now()`), split-view ticket inspector, filterable queue table, Recharts 8-week dashboard, customer self-service portal, and comprehensive UI polish (removing AI slop copy, fixing sidebar toggle/overlay). |
| **Session 6** | Automated test suite, fuzzing & invariant validation | 2.0h | 1.5h | 25 Vitest test suites (195 unit, integration, and fuzz tests), customer row-level isolation verification, lifecycle guards, and concurrent race-condition testing. |
| **Session 7** | Decoupled architecture partitioning & cloud deployment fixes | 1.5h | 1.5h | Split the codebase into independent `frontend/` and `backend/` packages with isolated `node_modules` and proxy rewrites. Configured Vercel and Render deployments, Supavisor connection pooling, and cross-port cookie forwarding. |
| **Session 8** | Stretch goals, AI copilot, email infrastructure & concurrency hardening | 3.0h | 3.0h | Free-form tag taxonomy with group exclusivity, daily queue email digests (Resend + Gmail SMTP IPv4 fallback), Semantic Knowledge Copilot (Gemini RAG), SHA-256 one-time agent invitations, and PostgreSQL transaction advisory locking (`pg_try_advisory_xact_lock`). |
| **Total** | | **21.0h** | **18.0h** | **Comprehensive research, 10 core requirements + 5 stretch features completed and verified.** |

---

## 2. What order did you build in, and why that order?

I followed an **outside-in design, inside-out implementation** strategy:

1. **State Machine & Lifecycle Rules First**:
   - Before writing application code, I mapped out every legal and illegal state transition (`New → Open → Pending → Resolved → Closed`), how the SLA clock interacts with the `Pending` state (customer pause), and the 7-day window for reopening closed tickets.
   - *Why*: In a support ticketing system, if your lifecycle transitions or SLA pause mechanics are ambiguous, every controller, UI badge, and database query you build afterwards will need to be rewritten.

2. **Database Schema & Realistic Seed Generation Second**:
   - I modeled the relational schema in Prisma with strict constraints, foreign keys, and composite indexes. Crucially, I wrote a comprehensive seed script immediately (`prisma/seed.ts`), generating 30+ tickets, realistic customer profiles, specialized agents, SLA breaches, 8 weeks of historical resolution data, and CSAT ratings.
   - *Why*: Building against an empty or toy database hides pagination bugs, layout breaks, sorting issues, and query latency. Having messy, realistic data on day one gave instant visual and functional feedback.

3. **Pure Policy Layer & Domain Controllers Third**:
   - I implemented authorization logic as pure functions in `models/policies/` (`TicketPolicy`, `ReplyPolicy`, `TagPolicy`) completely decoupled from HTTP request/response objects. Domain controllers in `controllers/` were written to handle business logic, ACID transactions, and audit logging.
   - *Why*: Business rules and role permissions are easiest to test and verify when they don't depend on HTTP frameworks, headers, or mock session objects. If authorization is embedded inside UI components or API handlers, edge cases inevitably slip into production.

4. **Dedicated Route Layer & Route Registry Fourth**:
   - I built `backend/routes/` with an explicit `API_ROUTE_REGISTRY` catalog. Each route handler unwraps HTTP requests, validates inputs, delegates to the appropriate controller, and maps domain exceptions to standard HTTP status codes (`400`, `401`, `403`, `404`).
   - *Why*: This kept the API surface fully auditable, decoupled HTTP transport from business logic, and allowed Vitest integration tests to exercise the complete route layer cleanly.

5. **Frontend Workspace & Customer Portal Fifth**:
   - Once backend API contracts were stable and verified, I built the Next.js 14 frontend: the queue workspace, live SLA countdown timers, ticket detail inspector, Recharts dashboard, and customer self-service portal.
   - *Why*: Frontend implementation became rapid assembly rather than guesswork because every endpoint, payload shape, and error code was already defined and tested.

6. **Comprehensive Automated Testing & Fuzzing Sixth**:
   - I created 25 test suites with 195 assertions covering lifecycle invariants, role-based security, SLA pause/resume math, multi-cycle breach alert resets, query fuzzing, input sanitization, and concurrent transactions.

7. **Decoupled Service Partitioning & Cloud Hardening Seventh & Eighth**:
   - Decoupled the repo into independent `frontend/` and `backend/` directories, added stretch capabilities (tagging taxonomy, queue digests, semantic AI copilot), and tuned PostgreSQL performance under real concurrency.

---

## 3. What did you estimate versus what it actually took?

### What matched estimates closely:
- **Domain Controllers & Lifecycle Logic** (Estimated 2.5h, took 2.5h): Because the state machine and SLA formulas were mathematically defined in Session 1, implementing the controllers was straightforward.
- **Frontend UI Workspace** (Estimated 2.5h, took 2.5h): Having rich seed data and stable REST contracts meant zero backend churn during UI development.

### What took less time than estimated:
- **Schema Design & Initial Migrations** (Estimated 2.0h, took 1.5h): Prisma's schema modeling made defining models, cascades, and composite indexes fast.

### What took more time and iteration than estimated:
- **SLA Alert Concurrency & Duplicate Prevention**:
  - *Estimate*: 30 minutes to query and flag alerts.
  - *Reality*: 1.5 hours. During initial testing under concurrent client polling, I discovered that multiple active tabs calling `/api/sla/alerts` simultaneously raced to insert duplicate alerts for the same ticket (created just 437ms apart). I had to add a database-level uniqueness constraint (`@@unique([ticketId, breachCycle])`) and implement PostgreSQL transaction advisory locking (`pg_try_advisory_xact_lock`) to make alert reconciliation strictly idempotent and concurrent-safe.
- **Microservice Decoupling & Cross-Port Cookie Forwarding**:
  - *Estimate*: 45 minutes to split package directories.
  - *Reality*: 1.5 hours. Separating into `frontend/` (Port 3000) and `backend/` (Port 3001) required configuring Next.js proxy rewrites in `next.config.js` and tuning CORS cookie forwarding (`credentials: "include"`, `SameSite=Lax`) to ensure the signed HTTP-only JWT cookie flowed seamlessly between local ports.
- **Timezone Boundary Discrepancies in Dashboard SQL**:
  - *Estimate*: 30 minutes to chart the last 8 weeks of resolutions.
  - *Reality*: 1 hour. In Node.js, `weekStart.setHours(0,0,0,0)` produces local midnight. On machines with timezone offsets (e.g., UTC+5:30), `.toISOString().split("T")[0]` produced Sunday dates while text labels displayed Monday, causing an off-by-one discrepancy against PostgreSQL's `date_trunc('week', ...)`. I had to strictly normalize all date bucketing to UTC (`getUTCDay()`, `setUTCDate()`, `setUTCHours(0,0,0,0)`).
- **Production SMTP Relay on Linux Containers**:
  - *Estimate*: 20 minutes for Resend email dispatch.
  - *Reality*: 1 hour. Resend's free tier restricts deliveries to the account owner's email without a custom verified domain. When adding Gmail SMTP via `nodemailer` as a universal fallback, Render's Linux containers hung indefinitely because Node attempted to route SMTP traffic over unrouted IPv6 interfaces. I had to force IPv4 resolution (`family: 4`), implement dual-port fallback (587 then 465), and add strict 6.5-second timeout guards.

---

## 4. What did you cut when you ran short?

To keep the system robust, bug-free, and completed within a realistic timeframe, I made deliberate cuts:

1. **Cut Stateful WebSocket Cluster (Socket.io / Redis PubSub)**:
   - *Why*: The prompt requires live SLA countdowns and responsive queues. Managing a stateful WebSocket cluster introduces connection state, heartbeat handling, sticky sessions, and reconnect backoff.
   - *What I did instead*: Built **client-side mathematical countdowns** (`slaDueAt - Date.now()`) that update every second locally with **zero network traffic**. Paired this with a 15-second background poll for queue list updates and a lightweight Server-Sent Events (SSE) stream (`/api/tickets/[id]/events`) for live ticket chat.
2. **Cut External Redis Caching Infrastructure**:
   - *Why*: Introducing Redis creates a separate point of failure and cache invalidation complexity across ticket status updates, replies, and reassignments.
   - *What I did instead*: Leveraged PostgreSQL composite B-tree indexes, single-query set-based SQL joins, and a lightweight 15-second in-memory server cache for the supervisor dashboard with event-driven invalidation on ticket mutations.
3. **Cut Database-Level `pgvector` C-Extension Prerequisite**:
   - *Why*: `pgvector` requires root database extension privileges or custom compiled binaries that are often unsupported or cumbersome to manage in standard serverless database transaction poolers.
   - *What I did instead*: Implemented the Semantic Knowledge Copilot with application-level cosine similarity in Node.js. It calls Google Gemini for vector embeddings when available, with an automatic deterministic n-gram vector fallback if the API key is absent or rate-limited. This makes the application 100% portable across any PostgreSQL or SQLite environment with zero setup friction.
4. **Cut Heavy Multi-Part S3 Cloud Storage**:
   - *Why*: Setting up AWS IAM roles, bucket policies, and presigned URLs adds operational overhead without improving the core support queue evaluation.
   - *What I did instead*: Built a secure local/streamed upload endpoint (`/api/upload`) with strict file type validation, 15MB size limits, sanitized unique filenames, directory traversal guards, and direct inline image/PDF previews in the chat timeline.
