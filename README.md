# SupportDesk — Enterprise Support Ticketing Platform

> A production-minded, microservices-ready decoupled support ticketing platform featuring a pure React/Next.js frontend UI (`frontend/`) and an independent Next.js REST API & domain service backend (`backend/`), complete with strict server-side authorization policies, deadline-based SLA lifecycle calculations, atomic per-ticket bulk operations, immutable audit history, and team collaboration.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Tests-104%20Passing-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

---

## 🏛️ Decoupled Architecture (`frontend/` & `backend/`)

The repository is structured into **exactly two isolated, top-level service folders** to ensure clean separation of concerns, independent deployability, and microservice modularity:

```
takehome-04-support-ticketing/
├── frontend/                          # Pure Client/UI Application Layer (Port 3000)
│   ├── app/                           # Next.js App Router (Pages: /tickets, /dashboard, /alerts, /login)
│   ├── components/                    # Rich UI components (AppShell, Sidebar, TopBar, Modals)
│   ├── lib/
│   │   ├── api-client.ts              # Pure HTTP REST API Client (zero DB/ORM dependencies)
│   │   └── types.ts                   # Frontend domain type interfaces
│   ├── next.config.js                 # API Proxy Rewrites (/api/* -> backend:3001)
│   ├── package.json                   # Frontend dependencies & scripts
│   └── tsconfig.json
│
├── backend/                           # Pure REST API & Microservice Domain Layer (Port 3001)
│   ├── app/api/                       # REST Controllers (/api/auth, /api/tickets, /api/dashboard, /api/sla)
│   ├── lib/
│   │   ├── services/                  # Business Logic Services (TicketService, SlaService, LifecycleService)
│   │   ├── policies/                  # Declarative Authorization Policies (TicketPolicy, ReplyPolicy)
│   │   ├── auth.ts                    # JWT Session Auth & Password Hashing
│   │   └── prisma.ts                  # Database Access Layer
│   ├── cors.ts                        # Pre-configured CORS Middleware Headers
│   ├── prisma/                        # Database Schema (schema.prisma) & Seeder (seed.ts)
│   ├── tests/                         # 104 Unit, Integration & Fuzzing Tests
│   ├── package.json                   # Backend dependencies, scripts & vitest config
│   └── tsconfig.json
│
├── docs/                              # Architecture Specs, Schema Docs, ADRs, & Version Logs
├── README.md
└── package.json                       # Root script orchestrator
```

### CORS & Independent Deployability
- **Frontend Rewrites**: `frontend/next.config.js` routes all `/api/*` requests through Next.js proxy rewrites to the configured Backend API URL (`NEXT_PUBLIC_API_URL` or `http://localhost:3001`), completely removing browser CORS headaches.
- **Backend CORS Headers**: `backend/cors.ts` attaches explicit `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, and `Access-Control-Allow-Methods` headers on all REST routes.

---

## 🚀 Key Features

### 1. 🛡️ Strict Server-Side Role Enforcement
- **Supervisors**: Full queue visibility, reassign any ticket to any agent, close tickets, reopen within a 7-day window, trigger bulk operations, export CSV, and view department analytics.
- **Agents**: Can only view, reply to, add internal notes to, and resolve tickets where they are the **primary assignee** or an active **collaborator**. Strictly prohibited from closing tickets or reassigning tickets away from themselves.
- **Enforcement**: Built with centralized domain policy classes in `backend/lib/policies/` evaluating cryptographically signed HTTP-only JWT cookies on every request.

### 2. ⏱️ Deadline-Based SLA Lifecycle Engine (Zero DB Polling Writes)
- **Deadlines over Counters**: Active deadlines (`slaDueAt`) are mathematically calculated based on ticket priority:
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

### 3. 👥 Multi-Agent Collaboration
- One primary assignee per ticket with support for any number of secondary collaborator agents via a normalized join table (`ticket_collaborators`).
- Collaborators inherit full working rights to view, reply, add internal notes, and resolve tickets.

### 4. 📝 Unified Chronological Timeline & Immutable Audit Ledger
- Interleaves public customer replies, agent replies, **warm amber staff-only internal notes**, and system lifecycle events into a single unified chronological feed.
- Every state change, assignment, and collaborator update is committed atomically alongside an append-only `AuditEvent` record.

### 5. ⚡ Atomic Per-Ticket Bulk Operations & CSV Export
- Bulk status transitions and reassignments execute in isolated per-ticket database transactions.
- Provides partial success reporting (`{ totalRequested, successCount, failureCount, results: [...] }`).
- Real-time RFC-4180 compliant CSV streaming export respecting active queue filters.

### 6. 📊 Real-Time Analytics & SLA Alerts Center
- **Supervisor Dashboard**: 4 headline metrics (Active, Breached, Pending Customer, Resolved This Week), SVG Donut Status Breakdown, horizontal Agent Workload bars, and an **8-Week Historical Resolution Trend** chart.
- **SLA Alerts**: Imminent ($<30\text{m}$) and breached tickets appear in the alert navigation center with live badge counts and 1-click acknowledgement.

---

## 🧪 Comprehensive Test Suite (104 Tests, 100% Passing)

Run the full automated test suite inside `backend/`:

```bash
npm test
```

### Test Suite Breakdown
| Test Category | Test File | Count | Focus Areas |
|---|---|---|---|
| **Unit Testing** | `backend/tests/unit/policies.test.ts` | 29 | Complete role $\times$ permission matrix |
| **Unit Testing** | `backend/tests/unit/lifecycle-service.test.ts` | 26 | Valid/invalid state machine transitions |
| **Unit Testing** | `backend/tests/unit/sla-service.test.ts` | 10 | Target minutes calculation, pause & resume math |
| **Unit Testing** | `backend/tests/unit/export-service.test.ts` | 5 | RFC-4180 CSV escaping, formula injection |
| **Unit Testing** | `backend/tests/unit/auth.test.ts` | 3 | JWT signing, verification, expiration |
| **Unit Testing** | `backend/tests/unit/timeline-service.test.ts` | 1 | Interleaving of replies & audit events |
| **Integration** | `backend/tests/integration/lifecycle.integration.test.ts` | 3 | Real PostgreSQL transactions & audit logs |
| **Integration** | `backend/tests/integration/collaboration.integration.test.ts` | 1 | Multi-agent collaborator assignment |
| **Integration** | `backend/tests/integration/bulk-operations.integration.test.ts` | 3 | Isolated per-ticket atomicity & partial success |
| **Integration** | `backend/tests/integration/queue-and-filters.integration.test.ts` | 3 | Multi-field filtering, search, pagination |
| **Integration** | `backend/tests/integration/dashboard-and-metrics.integration.test.ts` | 1 | Headline metrics & 8-week trend buckets |
| **Integration** | `backend/tests/integration/sla-alerts.integration.test.ts` | 1 | Breach detection & alert sync |
| **Business Rules**| `backend/tests/business-rules.test.ts` | 11 | End-to-end invariant validation |
| **Fuzz Testing** | `backend/tests/fuzz/input-fuzzing.test.ts` | 3 | SQL injection, XSS payloads, Unicode, null bytes |
| **Fuzz Testing** | `backend/tests/fuzz/query-fuzzing.test.ts` | 2 | Out-of-bounds pagination & negative integers |
| **Fuzz Testing** | `backend/tests/fuzz/bulk-and-concurrency-fuzzing.test.ts` | 2 | Chaotic ID arrays & 10 concurrent parallel replies |

---

## 👥 Pre-configured Demo Accounts

| Role | Name | Email | Password | Primary Capabilities |
|---|---|---|---|---|
| **Supervisor** | Suresh Menon | `supervisor@busy.com` | `password123` | Full access, Close/Reopen, Reassign, Bulk Operations, CSV Export, Metrics |
| **Senior Agent** | Sarah Jenkins | `sarah@busy.com` | `password123` | Assigned urgent breached tickets, collaborators, pending customer replies |
| **Support Agent** | Alex Rivera | `alex@busy.com` | `password123` | High priority due-soon tickets, team collaborations, ticket resolution |
| **Tier 1 Agent** | Jordan Lee | `jordan@busy.com` | `password123` | Low/medium tickets, resolved incident tickets |

---

## 🛠️ Quick Start & Local Setup

### 1. Install Dependencies
```bash
# Install dependencies in both frontend and backend
cd frontend && npm install
cd ../backend && npm install
```

### 2. Configure Environment Variables & Database
Create `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketing?schema=public"
JWT_SECRET="super-secret-jwt-key-for-session-tokens"
NODE_ENV="development"
PORT=3001
```

### 3. Run Database Setup (Backend)
```bash
cd backend
npx prisma db push
npm run seed
```

### 4. Run Services
From the root directory:
```bash
# Start Backend REST Service (Port 3001)
npm run dev:backend

# Start Frontend UI Application (Port 3000)
npm run dev:frontend
```

---

## 📄 License
MIT
