# SupportDesk — Enterprise Support Ticketing Platform

> A production-minded, modular-monolith support ticketing system with strict server-side authorization policies, deadline-based SLA lifecycle calculations, atomic per-ticket bulk operations, immutable audit history, and team collaboration.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Tests-104%20Passing-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

---

## 🚀 Key Features

### 1. 🛡️ Strict Server-Side Role Enforcement
- **Supervisors**: Full queue visibility, reassign any ticket to any agent, close tickets, reopen within a 7-day window, trigger bulk operations, export CSV, and view department analytics.
- **Agents**: Can only view, reply to, add internal notes to, and resolve tickets where they are the **primary assignee** or an active **collaborator**. Strictly prohibited from closing tickets or reassigning tickets away from themselves.
- **Enforcement**: Built with centralized domain policy classes ([`lib/policies/`](file:///c:/Users/dhruv/Downloads/takehome-04-support-ticketing/takehome-04-support-ticketing/lib/policies/)) evaluating cryptographically signed HTTP-only JWT cookies on every request.

### 2. ⏱️ Deadline-Based SLA Lifecycle Engine (Zero DB Polling Writes)
- **Deadlines over Counters**: Instead of decrementing countdown columns in the database every minute, active deadlines (`slaDueAt`) are mathematically calculated based on ticket priority:
  - `URGENT`: 120 minutes (2 hours)
  - `HIGH`: 480 minutes (8 hours)
  - `MEDIUM`: 1440 minutes (24 hours)
  - `LOW`: 4320 minutes (72 hours)
- **State Machine**:
  - `NEW` $\rightarrow$ `OPEN`: SLA deadline computed from creation timestamp.
  - `OPEN` $\rightarrow$ `PENDING`: Waiting on customer. Remaining active seconds are frozen once into `slaPausedRemainingSeconds`; `slaDueAt` is set to `null`.
  - `PENDING` $\rightarrow$ `OPEN` (Customer Reply): Resumes deadline mathematically: `slaDueAt = now() + slaPausedRemainingSeconds`.
  - `RESOLVED` / `CLOSED`: SLA timer stopped; cycle completed.
- **Re-breach Cycles**: Reopening increments `slaCycle`, establishing clean evaluation boundaries for recurring breach alerts.
- **Live UI Countdown**: The client calculates 1-second interval countdown timers locally from `slaDueAt - Date.now()`.

### 3. 👥 Multi-Agent Collaboration
- One primary assignee per ticket with support for any number of secondary collaborator agents via a normalized join table (`ticket_collaborators`).
- Collaborators inherit full working rights to view, reply, add internal notes, and resolve tickets.
- Dedicated queue scope tabs (`Assigned to Me`, `Collaborating`).

### 4. 📝 Unified Chronological Timeline & Immutable Audit Ledger
- Interleaves public customer replies, agent replies, **warm amber staff-only internal notes**, and system lifecycle events into a single unified chronological feed.
- Every state change, assignment, and collaborator update is committed atomically alongside an append-only `AuditEvent` record.
- Audit history cannot be updated or deleted by anyone, including supervisors.

### 5. ⚡ Atomic Per-Ticket Bulk Operations & CSV Export
- Bulk status transitions and reassignments execute in isolated per-ticket database transactions.
- Provides partial success reporting (`{ totalRequested, successCount, failureCount, results: [...] }`) so an invalid or unauthorized ticket does not roll back valid updates.
- Real-time RFC-4180 compliant CSV streaming export respecting active queue filters with formula injection sanitization.

### 6. 📊 Real-Time Analytics & SLA Alerts Center
- **Supervisor Dashboard**: 4 headline metrics (Active, Breached, Pending Customer, Resolved This Week), SVG Donut Status Breakdown, horizontal Agent Workload bars, and an **8-Week Historical Resolution Trend** dual-axis chart.
- **SLA Alerts**: Imminent ($<30\text{m}$) and breached tickets appear in the alert navigation center with live badge counts and 1-click acknowledgement.

---

## 🏗️ Architecture & Project Structure

```
takehome-04-support-ticketing/
├── app/
│   ├── api/                          # REST API Route Handlers (HTTP parsing & error handling)
│   │   ├── auth/                     # Session authentication (login, logout, me)
│   │   ├── tickets/                  # Ticket CRUD, bulk operations, CSV export
│   │   │   └── [id]/                 # Status, reassign, replies, customer-reply, collaborators, archive
│   │   ├── dashboard/                # Aggregation queries for dashboard metrics
│   │   ├── sla/alerts/               # SLA breach detection and acknowledgement
│   │   └── users/                    # Agent roster listing
│   ├── dashboard/                    # Analytics Dashboard Page
│   ├── tickets/                      # High-density Ticket Queue & Bulk Toolbar
│   │   ├── [id]/                     # 3-Column Ticket Detail Workspace
│   │   └── new/                      # Ticket Creation Form
│   ├── alerts/                       # SLA Alerts Center
│   └── login/                        # Clean Branded Login with Demo Personas
├── lib/
│   ├── policies/                     # Declarative Authorization Policies (TicketPolicy, ReplyPolicy, etc.)
│   ├── services/                     # Domain Business Services (TicketService, SlaService, LifecycleService, etc.)
│   ├── auth.ts                       # Cryptographic JWT signing and cookie verification (jose, bcryptjs)
│   ├── constants.ts                  # System constants (SLA targets, pagination boundaries)
│   └── prisma.ts                     # Prisma Client Singleton
├── components/                       # UI Shell, Dark Navy Sidebar, TopBar, Modals (AppShell, etc.)
├── docs/                             # Architecture, Schema, ADRs, and Version Documentation
│   ├── architecture.md               # System design, data flow, component boundaries
│   ├── schema.md                     # Relational schema, indexes, and scale considerations
│   ├── decisions.md                  # Architectural Decision Records (ADRs) and trade-offs
│   ├── plan.md                       # Phased execution log, estimates vs actuals
│   ├── ai-prompts.md                 # Prompts log and iteration history
│   └── version1/                     # Version 1.0 Complete System Snapshot
└── tests/                            # 104 Automated Tests (Unit, Integration, Fuzz)
```

---

## 🧪 Comprehensive Test Suite (104 Tests, 100% Passing)

The project includes an automated test suite structured across 4 distinct testing tiers:

```bash
npm test
```

### Test Suite Breakdown
| Test Category | Test File | Count | Focus Areas |
|---|---|---|---|
| **Unit Testing** | `tests/unit/policies.test.ts` | 29 | Complete role $\times$ permission matrix, boundary conditions |
| **Unit Testing** | `tests/unit/lifecycle-service.test.ts` | 26 | Valid/invalid state machine transitions, 7-day reopen window |
| **Unit Testing** | `tests/unit/sla-service.test.ts` | 10 | Target minutes calculation, pause math, resume math, cycle increments |
| **Unit Testing** | `tests/unit/export-service.test.ts` | 5 | RFC-4180 CSV escaping, quotes/commas/newlines, formula injection |
| **Unit Testing** | `tests/unit/auth.test.ts` | 3 | JWT signing, verification, tampering, expiration |
| **Unit Testing** | `tests/unit/timeline-service.test.ts` | 1 | Interleaving of public replies, internal notes, and audit events |
| **Integration** | `tests/integration/lifecycle.integration.test.ts` | 3 | Real PostgreSQL transactions for status changes & atomic audit logs |
| **Integration** | `tests/integration/collaboration.integration.test.ts` | 1 | Multi-agent collaborator assignment & duplicate prevention |
| **Integration** | `tests/integration/bulk-operations.integration.test.ts` | 3 | Isolated per-ticket atomicity & partial success reporting |
| **Integration** | `tests/integration/queue-and-filters.integration.test.ts` | 3 | Multi-field filtering, text search, pagination, archive isolation |
| **Integration** | `tests/integration/dashboard-and-metrics.integration.test.ts` | 1 | Headline metric cards, status distribution, 8-week trend buckets |
| **Integration** | `tests/integration/sla-alerts.integration.test.ts` | 1 | Breach detection, alert sync, 1-click acknowledgement |
| **Business Rules**| `tests/business-rules.test.ts` | 11 | End-to-end invariant validation of all 10 core requirements |
| **Fuzz Testing** | `tests/fuzz/input-fuzzing.test.ts` | 3 | SQL injection, XSS payloads, 10KB+ strings, Unicode/RTL, null bytes |
| **Fuzz Testing** | `tests/fuzz/query-fuzzing.test.ts` | 2 | Out-of-bounds pagination (`page=-10`, `limit=999999`), negative integers |
| **Fuzz Testing** | `tests/fuzz/bulk-and-concurrency-fuzzing.test.ts` | 2 | Chaotic ID arrays, non-existent UUIDs, 10 concurrent parallel replies |

---

## 👥 Pre-configured Demo Accounts

The login screen includes 1-click credential auto-fill cards for testing across all role permissions:

| Role | Name | Email | Password | Primary Capabilities |
|---|---|---|---|---|
| **Supervisor** | Suresh Menon | `supervisor@busy.com` | `password123` | Full access, Close/Reopen, Reassign, Bulk Operations, CSV Export, Metrics |
| **Senior Agent** | Sarah Jenkins | `sarah@busy.com` | `password123` | Assigned urgent breached tickets, collaborators, pending customer replies |
| **Support Agent** | Alex Rivera | `alex@busy.com` | `password123` | High priority due-soon tickets, team collaborations, ticket resolution |
| **Tier 1 Agent** | Jordan Lee | `jordan@busy.com` | `password123` | Low/medium tickets, resolved incident tickets |

---

## 🛠️ Quick Start & Local Setup

### Prerequisites
- Node.js `>= 18.17.0` (Node 20+ recommended)
- PostgreSQL database (or Docker)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/kushdhruv/BusyDeskProject.git
cd BusyDeskProject
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketing?schema=public"
JWT_SECRET="super-secret-jwt-key-for-session-tokens"
NODE_ENV="development"
PORT=3000
```

### 3. Run Database Migrations & Seed Data
```bash
# Push schema to database
npx prisma db push

# Seed 8 weeks of historical tickets, SLA breach scenarios, and demo accounts
npm run seed
```

### 4. Run Test Suite
```bash
npm test
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📚 Architectural Documentation

All architectural records and design justifications are documented under [`docs/`](file:///c:/Users/dhruv/Downloads/takehome-04-support-ticketing/takehome-04-support-ticketing/docs/):
- **[`docs/architecture.md`](file:///c:/Users/dhruv/Downloads/takehome-04-support-ticketing/takehome-04-support-ticketing/docs/architecture.md)** — System architecture, request lifecycles, and deliberate omissions.
- **[`docs/schema.md`](file:///c:/Users/dhruv/Downloads/takehome-04-support-ticketing/takehome-04-support-ticketing/docs/schema.md)** — Relational data model, composite indexing, and 100x scale analysis.
- **[`docs/decisions.md`](file:///c:/Users/dhruv/Downloads/takehome-04-support-ticketing/takehome-04-support-ticketing/docs/decisions.md)** — Architectural Decision Records (ADRs), trade-offs, and reversals.
- **[`docs/plan.md`](file:///c:/Users/dhruv/Downloads/takehome-04-support-ticketing/takehome-04-support-ticketing/docs/plan.md)** — Build session breakdown, estimates vs actuals.
- **[`docs/ai-prompts.md`](file:///c:/Users/dhruv/Downloads/takehome-04-support-ticketing/takehome-04-support-ticketing/docs/ai-prompts.md)** — Prompt log, corrections, and iteration history.
- **[`docs/version1/VERSION_1_SYSTEM_DOCUMENTATION.md`](file:///c:/Users/dhruv/Downloads/takehome-04-support-ticketing/takehome-04-support-ticketing/docs/version1/VERSION_1_SYSTEM_DOCUMENTATION.md)** — Complete Version 1.0 baseline system reference.

---

## 📄 License
MIT
