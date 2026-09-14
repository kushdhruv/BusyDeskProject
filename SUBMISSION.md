# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/kushdhruv/BusyDeskProject.git
- **Live application:** https://busy-desk-project.vercel.app

## Notes for the reviewer

- **Decoupled Architecture**: Built as two independent, decoupled services (`frontend/` on Port 3000 and `backend/` on Port 3001) with separate `package.json` files, isolated dependencies, and reverse-proxy API routing (`/api/*`).
- **Database & Pre-seeded Data**: Hosted on managed Supabase PostgreSQL (`ap-northeast-2`). The database is seeded with curated, realistic support operations data: 1 Supervisor, 5 Specialized Support Agents, 4 Customers, 30+ tickets across all 10 categories, active and historical SLA breaches, 8 weeks of resolution history with dynamic 1–5 star CSAT feedback, and 10 Knowledge Base articles.
- **Three-Role Access Control**:
  - **Supervisor (`supervisor@busy.com`)**: Global queue visibility, reassign any ticket, close/reopen within 7 days, execute bulk actions, export RFC-4180 CSV, manage tag taxonomies, and view department-wide KPI analytics.
  - **Agents (`sarah@busy.com`, `alex@busy.com`, `jordan@busy.com`, `priya@busy.com`, `marcus@busy.com`)**: Scoped to assigned tickets, collaborated tickets, and unassigned queues. Can reply, add internal notes, and attach collaborators. Cannot close tickets or reassign tickets away from themselves.
  - **Customers (`alice@customer.com`, `bob@customer.com`, `carol@startup.io`, `david@fintech.co`)**: Dedicated self-service Customer Portal. Strict row-level isolation ensures customers only see their own tickets (`requesterId == user.id`), can only submit public replies, and can rate resolved tickets (1–5 star CSAT). Internal notes, staff audit logs, and SLA internals are completely stripped at the database query level.
- **SLA Engine**: Mathematical deadline tracking (`slaDueAt = createdAt + targetMinutes`). When a ticket enters `PENDING`, remaining seconds are frozen once. When a customer replies, the clock automatically unpauses and resumes with mathematical precision.
- **Semantic Knowledge Copilot / Smart Assist**: Integrated Google Gemini embedding service with high-signal deterministic vector fallback. Recommends semantically similar resolved tickets and KB articles directly above the agent reply composer.
- **Transactional Email & Agent Invitation**: One-time 24-hour setup tokens stored as SHA-256 hashes with resilient dual-provider delivery (Gmail SMTP via Nodemailer with IPv4 enforcement + Resend API) and automated local dev console fallback.
- **Hosting & Cold Starts**: Deployed on Vercel and managed Supabase PostgreSQL. There are no idle sleep timeouts, though the very first database query after an idle period may take 1–2 seconds to establish the Supavisor connection pool.

## Demo credentials

| Role | Email | Password | Details |
|------|-------|----------|---------|
| **Supervisor** | `supervisor@busy.com` | `password123` | Suresh Menon — Global queue access, bulk reassign/close, CSAT analytics, team invites. |
| **Incident & Security Lead** | `sarah@busy.com` | `password123` | Sarah Jenkins — Primary assignee on urgent breached tickets; collaborator on others. |
| **Integrations Specialist** | `alex@busy.com` | `password123` | Alex Rivera — Assigned high-priority due-soon tickets; webhook & API integrations. |
| **Billing Operations** | `jordan@busy.com` | `password123` | Jordan Lee — Assigned billing mismatch, VAT, and proration tickets. |
| **Performance Engineer** | `priya@busy.com` | `password123` | Priya Sharma — Database latency, connection pooling, and query optimization. |
| **Onboarding & Success** | `marcus@busy.com` | `password123` | Marcus Vance — User account lockouts, agent invitations, and workspace onboarding. |
| **Customer (Alice)** | `alice@customer.com` | `password123` | Alice Henderson (ACME Corp) — Enterprise customer with open and pending tickets; CSAT reviews. |
| **Customer (Bob)** | `bob@customer.com` | `password123` | Bob Martinez (Globex Corp) — Mid-market customer with separate isolated tickets. |
| **Customer (Carol)** | `carol@startup.io` | `password123` | Carol Danvers (Apex Technologies) — Developer customer with webhook and SSO tickets. |
| **Customer (David)** | `david@fintech.co` | `password123` | David Chen (FinTech Global) — High-volume enterprise customer with database & security tickets. |

*You can also register a new customer account at `/register` or invite an agent at `/team`.*

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| **Frontend** | React 18, Next.js 14 App Router, Tailwind CSS, Lucide Icons | Decoupled client application layer with its own `package.json`. Provides dedicated Customer Portal, live 1-second SLA countdowns, responsive queue workspace, and dynamic supervisor analytics. |
| **Backend** | Node.js, Next.js API Routes, TypeScript, Prisma ORM, Jose (JWT), BcryptJS | Decoupled REST microservice layer with its own `package.json`. Houses a centralized Route Layer (`routes/`), Policy Authorization Engine (`models/policies/`), and Domain Controllers (`controllers/`). |
| **Database** | PostgreSQL on Supabase (Dual-URL Pooling: Supavisor Transaction Pooler on 6543 + Direct Session on 5432) | Strongly typed relational schema with composite indexes, foreign key cascading integrity, and atomic multi-step `$transaction` executions. |
| **Hosting** | Vercel (Frontend & Backend API Services) + Supabase (Managed PostgreSQL) | Reliable serverless microservice deployment with independent build pipelines, SSL, and managed connection pooling. |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | **Done** | Supervisor, Agent, and Customer roles enforced strictly on the server via `models/policies/` and query-level Prisma filters. Customers cannot see internal data, other customers' tickets, or staff controls. |
| 2 | Tickets | **Done** | Created with subject, description, requester, priority, and category; editable; archive and restore functionality hides tickets from default queues without destroying history. |
| 3 | Replies inside tickets | **Done** | Normalized `Reply` table with author, body, timestamp, and `isInternal` flag distinguishing internal notes from public replies. Customers only receive public replies. File attachments supported. |
| 4 | Ticket lifecycle | **Done** | `New → Open → Pending → Resolved → Closed`. Entering Pending pauses the SLA clock; customer replies return ticket to Open and resume the clock. Closed tickets can only be reopened within a 7-day window. |
| 5 | Collaborators | **Done** | One primary assignee + normalized many-to-many `ticket_collaborators` join table. Agents see their combined assigned and collaborating queue. Customers cannot view or manage collaborators. |
| 6 | Finding tickets | **Done** | Server-side text search (subject, description, customer), filters (status, priority, category, assignee), multi-column sorting, and pagination via `Promise.all([findMany, count])`. Fully server-side. |
| 7 | Acting on many tickets at once | **Done** | Bulk reassign and bulk close with per-ticket isolated transactions; returns granular per-ticket successes and refusal reasons in a summary modal. Server-side streamed RFC-4180 CSV export. Restricted to Supervisors. |
| 8 | A dashboard | **Done** | Dual dashboard support: Staff Dashboard with 4 headline cards, status breakdown, agent workload, 8-week historical resolution trend, and CSAT metrics; Customer Dashboard with 4 customer-focused cards and ticket search. |
| 9 | History you cannot rewrite | **Done** | Append-only `AuditLog` table capturing actor, action, and old/new JSON diffs for all mutations including `CSAT_SUBMITTED`. Strictly read-only API contracts with zero edit/delete routes. |
| 10 | SLA alerts | **Done** | Response clock measured against target response times by priority; active and due-soon alerts with nav count badge. Cycle-based alert acknowledgement that automatically returns if a reopened ticket breaches again. |

### Stretch Goals Completed

| Feature | Status | Implementation Details |
|---------|--------|------------------------|
| **Post-Resolution CSAT Ratings** | **Done** | Customers rate resolved/closed tickets with 1–5 stars and comments. Submissions are atomic (`CSAT_SUBMITTED` audit event in 1 transaction). Supervisors see company-wide CSAT averages and rating distributions. |
| **Free-Form Tagging & Grouped Taxonomy** | **Done** | Tags organized into 5 groups (`Platform`, `Environment`, `Component`, `Impact`, `Workflow`) with group exclusivity rules (e.g. setting `Environment: Production` replaces `Environment: Staging`). Full supervisor governance at `/settings/tags` including tag merging with batch retagging. |
| **Email Queue Digest & Smart Suppression** | **Done** | Role-aware daily agent briefings and weekly supervisor rollups with smart suppression when queues are empty. Interactive HTML preview modal and live dispatch via Resend API (`backend/services/digest.service.ts`). |
| **Semantic Knowledge Copilot (Smart Assist)** | **Done** | AI-driven semantic resolution recommendations above reply composer. Compares active tickets against historical resolved solutions and Knowledge Base articles using Google Gemini embeddings with deterministic fallback. |
| **Secure Single-Use Agent Invitations** | **Done** | Supervisors invite agents at `/team`. Generates cryptographically secure 24-hour tokens, stores SHA-256 hashes, dispatches via Resend API (or dev console link), and validates at `/setup-account` with atomic activation. |

## How much time did you actually spend?

**Total time spent: approximately 18.0 hours** across 8 focused sessions (against an initial budgeted estimate of 21.0 hours):
- **Problem Decomposition, B2B SaaS Research & State Machine Modeling (Session 1)**: 3.0 hours (Est: 3.5h) — Researched enterprise ticketing platforms (Linear, Zendesk, Front). Defined finite state machine rules (`NEW → OPEN → PENDING → RESOLVED → CLOSED`) and 7-day reopen window. Formulated mathematical zero-write SLA deadline model (`slaDueAt`, `slaPausedRemainingSeconds`) to eliminate the 300,000 writes/hour polling daemon trap (Decision 2). Outlined 3-role authorization predicates and Supabase dual-pool connection architecture (port 6543 vs 5432).
- **Relational Schema Design, Composite Indexing & Dynamic Seeding (Session 2)**: 1.5 hours (Est: 2.0h) — Modeled 13 normalized relational tables in Prisma. Chose normalized `ticket_collaborators` join table with composite PK `(ticketId, userId)` over JSON arrays (Decision 3). Configured foreign key cascades, composite B-tree indexes, and GIN trigram indexes (`pg_trgm`). Built a dynamic seed generator (`prisma/seed.ts`) producing 8 weeks of historical tickets, SLA breaches, agent specialties, and CSAT distributions so development had realistic, high-volume data on Day 1.
- **Core Domain Services, Pure Policy Layer & SLA Engine (Session 3)**: 2.5 hours (Est: 3.0h) — Implemented domain controllers (`ticket.controller.ts`, `lifecycle.controller.ts`, `sla.controller.ts`). Built pure authorization policies (`models/policies/`) decoupled from HTTP contexts. Implemented zero-write SLA pause/resume formulas on `PENDING` transitions. Built chronological timeline merger (`timeline.controller.ts`), dynamically interleaving public replies, internal notes, and audit logs while suppressing redundant `REPLY_ADDED` audit events (Decision 7).
- **Explicit Route Registry, Session Auth, Bulk Processor & CSV Streaming (Session 4)**: 2.0 hours (Est: 2.5h) — Created centralized `backend/routes/` with an explicit `API_ROUTE_REGISTRY` catalog, decoupling domain logic from HTTP routing. Implemented server-side signed JWT sessions (`jose` HS256) in HTTP-only cookies with bcrypt password hashing (Decision 5). Built `bulk.controller.ts` with per-ticket isolated transactions and granular itemized success/failure reporting (Decision 4). Implemented streaming RFC-4180 CSV export.
- **Frontend B2B SaaS Workspace, Live SLA Countdown & Customer Portal (Session 5)**: 3.0 hours (Est: 3.5h) — Built Next.js 14 App Router UI with Linear/Intercom-inspired visual restraint (eliminating AI slop copy, excessive rounded cards, and decorative gradients). Built zero-network client-side 1-second live countdown timers (`slaDueAt - Date.now()`). Created filterable queue table, split-view ticket inspector, and Recharts 8-week dashboard. Built dedicated Customer Self-Service Portal (`frontend/components/customer/`) with strict row-level isolation and post-resolution CSAT star ratings + comments.
- **Scalability Audit, Concurrency Locking & Set-Based SQL Optimization (Session 6)**: 1.5 hours (Est: 2.0h) — Conducted empirical scalability profiling against live Supabase PostgreSQL in Seoul (`ap-northeast-2`). Discovered 68s SLA polling latency and a real race condition where concurrent client polling created duplicate breach alerts 437ms apart. Added database uniqueness `@@unique([ticketId, breachCycle])` and PostgreSQL transaction advisory locking (`pg_try_advisory_xact_lock`) (Decision 8). Rewrote SLA sync to set-based SQL upserts (`INSERT ... ON CONFLICT DO UPDATE`), slashing p50 latency from 67,976ms to 4,045ms (16.8× speedup). Replaced in-memory JavaScript dashboard date crunching with PostgreSQL `date_trunc('week', "resolvedAt")` aggregation.
- **Architectural Decoupling: Monolith to Microservices (Session 7)**: 1.5 hours (Est: 1.5h) — Reassessed monolithic Next.js repository as domain complexity grew: observed server/client type coupling and bundle pollution risks (Decision 1). Explicitly partitioned the codebase into independent `frontend/` (Port 3000) and `backend/` (Port 3001) packages with isolated `package.json`, dependencies, and `tsconfig.json`. Configured cross-port CORS cookie forwarding (`credentials: "include"`, `SameSite=Lax`) and Next.js reverse-proxy rewrites (`next.config.js`). Validated dual deployment readiness (Vercel edge UI + Render/AWS REST API).
- **Advanced Extensions: Semantic Copilot RAG, Resilient Email & Security Audit (Session 8)**: 3.0 hours (Est: 3.0h) — Built Semantic Knowledge Copilot (`embedding.service.ts` + `recommendation.service.ts`): initially attempted `pgvector`, but reversed to application cosine similarity with Google Gemini RAG + deterministic vector fallback for zero-friction portability across pooled databases (Decision 6). Built free-form tag taxonomy with 5 orthogonal groups and group exclusivity rules. Built secure single-use agent invitation system (`sha256` token storage, 24h TTL, `/setup-account` workflow). Built dual-provider email service (`email.service.ts`), debugging Render Linux container IPv6 SMTP connection hangs by enforcing IPv4 `family: 4` and 6.5s timeout guards (Decision 9). Executed full 25-suite / 195-test Vitest regression audit.

## What would you do next, with another 12 hours?

1. **Real-time Presence & Ticket Collision Prevention (WebSockets / SSE)**:
   - When multiple agents open the same high-priority ticket, display real-time avatars ("Alex is currently typing a reply...") with soft ticket locking to eliminate duplicate replies.
2. **Inbound Email Processing (SendGrid/Postmark Webhooks)**:
   - Allow customers to reply directly from their email client. Build an inbound webhook handler that matches the `In-Reply-To` Message-ID or `#123` subject token, attaches the message as a public reply, and automatically resumes the SLA clock.
3. **Database-Level pgvector HNSW Indexing for 100K+ Vectors**:
   - Migrate semantic embeddings from on-the-fly application cosine similarity to PostgreSQL `pgvector` with HNSW indexes (`vector_cosine_ops`), enabling sub-5ms vector searches over millions of historical resolutions.
4. **Canned Responses & Macro Automation**:
   - Build a supervisor-curated canned response library with dynamic interpolation (`{{customer.name}}`, `{{ticket.number}}`) and one-click multi-action macros (apply reply + set status to Pending + add tag).

## What are you least happy with in this codebase, and why?

1. **Client-Side Polling for Queue Updates (15s interval) Instead of WebSockets**:
   - While client-side mathematical SLA countdowns (`slaDueAt - Date.now()`) ensure the clock updates every second with zero server load, queue-level ticket additions and status changes currently rely on a 15-second background polling cycle. In a large support team, a WebSocket or Server-Sent Events (SSE) stream would provide immediate, push-based queue updates and lower HTTP request volume.
2. **On-the-Fly Cosine Similarity Calculation for Embeddings**:
   - For the current dataset (dozens to hundreds of articles and historical tickets), computing cosine similarity across candidate vectors in Node.js memory takes less than 20ms. However, as the ticket archive grows beyond 10,000 resolved tickets, this approach will become a CPU bottleneck. It should be offloaded to PostgreSQL `pgvector` with indexed similarity queries (`ORDER BY embedding <=> query_vector LIMIT 5`).
3. **Dual Next.js Instances for Frontend and Backend in Local Development**:
   - Running two Next.js instances (`next dev -p 3000` and `next dev -p 3001`) cleanly enforces microservice isolation and prevents dependency leakage, but it consumes more local memory than a unified monorepo with an Express/Fastify backend. Moving the backend to a dedicated Fastify or NestJS microservice would make the backend even leaner.
