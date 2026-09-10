# Submission

## Links

- **GitHub repository:** https://github.com/kushdhruv/BusyDeskProject.git
- **Live application:** https://busydesk.vercel.app

## Notes for the reviewer

- The database is seeded with realistic demonstration data: 1 Supervisor, 3 Support Agents, and 35+ tickets across every lifecycle state, SLA breach scenarios, and 8 weeks of historical resolution cohorts.
- On the login page, you can use the quick **"Demo Accounts"** cards to auto-fill credentials for Supervisor or any Agent with a single click, or type the credentials manually.
- In the ticket workspace (`/tickets/:id`), click the **"Simulate Customer Reply"** button in the header to observe a Pending ticket automatically transition back to Open, unpause its SLA countdown, and record an immutable timeline entry.
- When evaluating Goal 4 (Closed Ticket Reopening): Ticket `#4` was closed recently (can be reopened), while Ticket `#5` was closed 15 days ago (reopening is rejected by the server with an explanatory 7-day expiration message).

## Demo credentials

| Role | Email | Password | Details |
|------|-------|----------|---------|
| **Supervisor** | `supervisor@busy.com` | `password123` | Suresh Menon — Global queue access, bulk reassign/close, metrics, and archive management. |
| **Senior Agent** | `sarah@busy.com` | `password123` | Sarah Jenkins — Primary assignee on urgent breached tickets; collaborator on others. |
| **Support Agent** | `alex@busy.com` | `password123` | Alex Rivera — Assigned high priority due-soon tickets; active team collaborations. |
| **Tier 1 Agent** | `jordan@busy.com` | `password123` | Jordan Lee — Assigned low/medium tickets; recently closed resolution. |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| **Frontend** (`frontend/`) | Pure Client React 18, Next.js App Router, Tailwind CSS, Lucide Icons, Recharts | Self-contained UI layer with separate `package.json` and `node_modules`. Features live SLA countdowns, responsive queue workspace, and dynamic analytics dashboard. |
| **Backend** (`backend/`) | Pure REST API & Microservice Layer, Next.js API Routes, TypeScript, Modular Domain Services (`/lib/services/`), Central Policies (`/lib/policies/`) | Decoupled domain service layer with separate `package.json`, `node_modules`, and CORS middleware. Strictly enforces server-side authorization and state transitions. |
| **Database** | PostgreSQL (Docker locally / Supabase in production), Prisma ORM | Strongly relational data model housed inside `backend/prisma/` with composite indexes, foreign key integrity, and atomic transactions. |
| **Hosting** | Vercel (Decoupled Frontend & Backend API Services), Supabase (PostgreSQL) | Independent microservice deployment with zero cross-service code leaking and managed PostgreSQL. |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | **Done** | Supervisor and Agent roles enforced strictly on the server via `/lib/policies/`. Agents cannot reassign away from themselves or access unauthorized tickets. |
| 2 | Tickets | **Done** | Created with subject, description, requester name/email, priority, category; editable; archive and restore functionality hides tickets from default queues without destroying history. |
| 3 | Replies inside tickets | **Done** | Normalized `Reply` table with author, body, timestamp, and `isInternal` flag distinguishing internal notes (yellow-tinted) from public customer replies. Ordered chronologically. |
| 4 | Ticket lifecycle | **Done** | `New -> Open -> Pending -> Resolved -> Closed`. Entering Pending pauses the SLA clock; customer replies return ticket to Open and resume the clock. Closed tickets can only be reopened within a 7-day window. |
| 5 | Collaborators | **Done** | One primary assignee + normalized many-to-many `ticket_collaborators` join table. Agents see their combined assigned and collaborating queue. |
| 6 | Finding tickets | **Done** | Server-side text search (subject, description, customer), filters (status, priority, category, assignee), multi-column sorting, and pagination via `Promise.all([findMany, count])`. |
| 7 | Acting on many tickets at once | **Done** | Bulk reassign and bulk close with per-ticket isolated transactions; returns granular per-ticket successes and refusal reasons in a summary modal. Server-side streamed RFC-4180 CSV export. |
| 8 | A dashboard | **Done** | 4 headline cards (Open, Pending on Customer, Resolved this week, Breaching SLA), status breakdown, agent workload table, and an 8-week historical resolution trend chart. |
| 9 | History you cannot rewrite | **Done** | Append-only `AuditLog` table capturing actor, action, and old/new JSON diffs for all mutations. Strictly read-only API contracts with zero edit/delete routes. |
| 10 | SLA alerts | **Done** | Response clock measured against target response times by priority; active and due-soon alerts with nav count badge. Cycle-based alert acknowledgement that automatically returns if a reopened ticket breaches again. |

## How much time did you actually spend?

Total time spent was approximately **11.5 hours** across 6 structured sessions:
- Planning, `/grill-me` alignment, and specification: 1.5h
- PostgreSQL modeling, Prisma schema, and seed data: 1.5h
- Central policies and domain services (`/lib/services/`): 2.5h
- REST API routes and session authentication: 2.0h
- Frontend UI workspace, queue table, and dashboard: 2.5h
- Automated integration test suite and documentation: 1.5h

## What would you do next, with another 12 hours?

1. **Email Integration (Inbound Webhooks & Outbound SMTP)**: Connect an inbound webhook provider (Postmark / SendGrid Inbound Parse) to convert incoming customer emails directly into tickets and replies, and dispatch email notifications on agent replies.
2. **Canned Responses / Snippets Library**: Build an internal template library allowing agents to insert pre-written replies with variable interpolation (e.g. `{{customer.name}}`, `{{ticket.number}}`).
3. **Customer Satisfaction (CSAT) Survey**: Automatically send a 1-click 5-star rating survey email upon ticket resolution and track CSAT metrics on the Supervisor Dashboard.
4. **PostgreSQL Full-Text Search Optimization**: Replace `ILIKE` queries with a native `tsvector` column and `GIN` index for sub-millisecond full-text search across 100,000+ ticket bodies.

## What are you least happy with in this codebase, and why?

While the modular domain services and policy layer cleanly isolate business logic, the dashboard currently aggregates the 8-week historical resolution trend on demand by querying resolved tickets within the past 8 weeks. While fast on current data (~15ms on PostgreSQL), at 100x scale with millions of historical tickets, this query should be backed by a PostgreSQL Materialized View or hourly rollup table rather than calculating date truncations on every dashboard load.
