# Submission

## Links

- **GitHub repository:** https://github.com/kushdhruv/BusyDeskProject.git
- **Live application:** https://busydesk.vercel.app

## Notes for the reviewer

- The database is seeded with realistic demonstration data: 1 Supervisor, 3 Support Agents, 2 Customer accounts, and 35+ tickets across every lifecycle state, SLA breach scenarios, and 8 weeks of historical resolution cohorts.
- **Three-Role Architecture**:
  - **Supervisor & Agents**: Access the full ticket workspace, SLA alerts, internal notes, audit timeline, bulk operations, and supervisor analytics.
  - **Customer Portal**: Dedicated self-service portal for customers (`/dashboard` and `/register`) with query-level data isolation, public message timeline, and post-resolution CSAT surveys.
- **Customer Self-Registration & Security**:
  - Public registration at `/register` strictly creates `CUSTOMER` accounts only (role parameter from clients is discarded).
  - Query-level filtering ensures customers only see their own tickets (`requesterId === user.id`) and only public replies (`isInternal: false`). Audit logs and SLA internals are completely omitted.
- **SLA Resumption on Customer Reply**:
  - When a ticket is in `PENDING` status, a customer reply automatically transitions the ticket to `OPEN` and resumes the SLA response countdown.
- **Post-Resolution CSAT Ratings**:
  - Customers can rate resolved/closed tickets with a 1–5 star rating and feedback comment. Submissions are atomic (CSAT record + `CSAT_SUBMITTED` audit event in 1 transaction) and immutable.
  - Supervisors can view aggregated CSAT scores and rating distributions on the Supervisor Dashboard (refreshed on navigation/load).
- When evaluating Goal 4 (Closed Ticket Reopening): Ticket `#4` was closed recently (can be reopened by Supervisor), while Ticket `#5` was closed 15 days ago (reopening is rejected by the server with an explanatory 7-day expiration message).

## Demo credentials

| Role | Email | Password | Details |
|------|-------|----------|---------|
| **Supervisor** | `supervisor@busy.com` | `password123` | Suresh Menon — Global queue access, bulk reassign/close, CSAT analytics, and archive management. |
| **Senior Agent** | `sarah@busy.com` | `password123` | Sarah Jenkins — Primary assignee on urgent breached tickets; collaborator on others. |
| **Support Agent** | `alex@busy.com` | `password123` | Alex Rivera — Assigned high priority due-soon tickets; active team collaborations. |
| **Tier 1 Agent** | `jordan@busy.com` | `password123` | Jordan Lee — Assigned low/medium tickets; recently closed resolution. |
| **Customer (Alice)** | `alice@customer.com` | `password123` | Alice Henderson (ACME Corp) — Customer requester with open and pending tickets, can submit replies & rate CSAT. |
| **Customer (Bob)** | `bob@customer.com` | `password123` | Bob Martinez (Globex Corp) — Customer requester with separate isolated tickets. |

*You can also register a new customer account at `/register`.*

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| **Frontend** (`frontend/`) | Pure Client React 18, Next.js App Router, Tailwind CSS, Lucide Icons | Self-contained UI layer with separate `package.json` and `node_modules`. Features dedicated Customer Help Center portal, live SLA countdowns, responsive queue workspace, and dynamic supervisor analytics. |
| **Backend** (`backend/`) | Pure REST API & Domain Service Layer, Next.js API Routes, TypeScript, Modular Domain Services (`/lib/services/`), Central Policies (`/lib/policies/`) | Decoupled domain service layer with separate `package.json`, `node_modules`, and CORS middleware. Strictly enforces server-side authorization, query-level data masking, and state transitions. |
| **Database** | PostgreSQL (Docker locally / Supabase in production), Prisma ORM | Strongly relational data model housed inside `backend/prisma/` with composite indexes, foreign key integrity (`onDelete: Restrict` for CSAT preservation), and atomic transactions. |
| **Hosting** | Vercel (Decoupled Frontend & Backend API Services), Supabase (PostgreSQL) | Independent microservice deployment with zero cross-service code leaking and managed PostgreSQL. |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | **Done** | Supervisor, Agent, and Customer roles enforced strictly on the server via `/lib/policies/` and Prisma query-level filters. Customers cannot see internal data, other customers' tickets, or staff controls. |
| 2 | Tickets | **Done** | Created with subject, description, required `requesterId`, priority/urgency, category; editable; archive and restore functionality hides tickets from default queues without destroying history. |
| 3 | Replies inside tickets | **Done** | Normalized `Reply` table with author, body, timestamp, and `isInternal` flag distinguishing internal notes from public customer replies. Customers only receive public replies. |
| 4 | Ticket lifecycle | **Done** | `New -> Open -> Pending -> Resolved -> Closed`. Entering Pending pauses the SLA clock; customer replies return ticket to Open and resume the clock. Closed tickets can only be reopened within a 7-day window. |
| 5 | Collaborators | **Done** | One primary assignee + normalized many-to-many `ticket_collaborators` join table. Agents see their combined assigned and collaborating queue. Customers cannot view or manage collaborators. |
| 6 | Finding tickets | **Done** | Server-side text search (subject, description, customer), filters (status, priority, category, assignee), multi-column sorting, and pagination via `Promise.all([findMany, count])`. Customers are strictly scoped to their own tickets. |
| 7 | Acting on many tickets at once | **Done** | Bulk reassign and bulk close with per-ticket isolated transactions; returns granular per-ticket successes and refusal reasons in a summary modal. Server-side streamed RFC-4180 CSV export. Restricted to Supervisors. |
| 8 | A dashboard | **Done** | Dual dashboard support: Staff Dashboard with 4 headline cards, status breakdown, agent workload, 8-week historical resolution trend, and CSAT average/distribution; Customer Dashboard with 4 customer-focused cards and ticket search. |
| 9 | History you cannot rewrite | **Done** | Append-only `AuditLog` table capturing actor, action, and old/new JSON diffs for all mutations including `CSAT_SUBMITTED`. Strictly read-only API contracts with zero edit/delete routes. |
| 10 | SLA alerts | **Done** | Response clock measured against target response times by priority; active and due-soon alerts with nav count badge. Cycle-based alert acknowledgement that automatically returns if a reopened ticket breaches again. |
| 11 | Customer Portal & CSAT | **Done** | Customer self-registration, server-managed urgency mapping (`LOW`/`NORMAL`/`HIGH`), 1–5 star post-resolution CSAT surveys with atomic logging and supervisor CSAT aggregation. |

## Automated Test Suite

- **18 Test Suites / 135 Unit, Integration, Security & Fuzz Tests** passing with 100% green status (`npm test` in `backend/`):
  - `tests/security/customer-security.test.ts`: 16 comprehensive tests covering registration role enforcement, Customer A vs B isolation, query-level data masking, unauthorized action rejection, conditional SLA resumption, atomic CSAT logging, and supervisor CSAT metrics.
  - `tests/unit/policies.test.ts`: Complete 3-role policy validation matrix across `TicketPolicy`, `ReplyPolicy`, `CollaboratorPolicy`, `AlertPolicy`, and `canRateCsat`.
  - `tests/business-rules.test.ts`: 11 core SLA and lifecycle state machine invariant tests.
  - `tests/fuzz/*`: Injection, Unicode edge cases, query fuzzing, and concurrency testing.
