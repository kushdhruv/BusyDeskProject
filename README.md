# BusyDesk — Enterprise Support Ticketing Platform

> A production-minded, microservices-ready decoupled support ticketing platform featuring an independent Next.js/React frontend UI (`frontend/` on Port 3000) and a modular REST API backend (`backend/` on Port 3001) with dedicated route registry, domain controllers, strict server-side policy engine, zero-write mathematical SLA lifecycle tracking, per-ticket atomic bulk operations, immutable audit history, customer portal with CSAT ratings, and multi-agent collaboration.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Supabase-Managed%20Postgres-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Tests-176%20Passing-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

---

## 🏛️ Decoupled Architecture (`frontend/` & `backend/`)

The repository is structured into **two completely isolated service modules** to ensure clean separation of concerns, independent scaling, and zero cross-tier dependency leaking:

```
takehome-04-support-ticketing/
├── frontend/                          # Pure Client/UI Application Layer (Port 3000)
│   ├── app/                           # Next.js App Router (Pages: /tickets, /dashboard, /alerts, /login, etc.)
│   ├── components/                    # Design system components (AppShell, Sidebar, TopBar, Modals, Badges)
│   │   ├── customer/                  # Dedicated Customer Portal UI components
│   │   └── ui/                        # Reusable atomic UI primitives (Badge, Button, Modal, Input, Select)
│   ├── lib/                           # Typed HTTP REST API Client (zero direct database dependencies)
│   ├── next.config.js                 # API Proxy Rewrites (/api/* -> backend:3001)
│   ├── package.json                   # Frontend dependencies & scripts
│   └── tsconfig.json
│
├── backend/                           # Pure REST API & Microservice Domain Layer (Port 3001)
│   ├── routes/                        # Dedicated API Route Layer (auth, ticket, reply, sla, csat, bulk, export, health)
│   │   └── index.ts                   # Central Barrel Export & API_ROUTE_REGISTRY catalog
│   ├── controllers/                   # Pure Domain Logic & Business Rules (Ticket, Sla, Lifecycle, Reply, etc.)
│   ├── models/                        # Domain types & declarative authorization policies (TicketPolicy, etc.)
│   ├── middlewares/                   # JWT Session Auth, Role Guards & CORS Middleware
│   ├── db/                            # Database connection & Prisma client wrapper (Supavisor + Direct pooling)
│   ├── utils/                         # Global constants & utility helpers
│   ├── app/api/                       # Next.js route entry points (1-line delegates to @/routes)
│   ├── prisma/                        # Database Schema (schema.prisma) & Rich Seeder (seed.ts)
│   ├── tests/                         # 176 Unit, Integration, Security & Fuzzing Tests (23 suites)
│   ├── package.json                   # Backend dependencies, scripts & Vitest runner
│   └── tsconfig.json
│
├── docs/                              # In-depth Architecture, Decisions, Plan, & Schema Documentation
├── README.md
└── SUBMISSION.md
```

---

## 🚀 Key Features & Capabilities

### 1. 🛡️ Strict Server-Side 3-Tier Access Control
- **Supervisors**: Global queue visibility, reassign any ticket, close tickets, reopen within a 7-day window, execute bulk actions, export CSV, and inspect KPI analytics.
- **Support Agents**: Restrictive access to assigned tickets, collaborated tickets, or public queue tickets; can add secondary collaborators and post internal notes; strictly forbidden from closing tickets or reassigning tickets away from themselves.
- **Customers**: Dedicated customer portal with strict row-level security. Customers can only view their own tickets, submit public replies, and rate resolved tickets (1–5 star CSAT). Customers are physically blocked from viewing internal notes, agent audit logs, or other customers' tickets.

### 2. ⏱️ Zero-Write Mathematical SLA Lifecycle Engine
- **Mathematical Deadlines**: Active deadlines (`slaDueAt`) are computed mathematically from ticket priority:
  - `URGENT`: 120 minutes (2 hours)
  - `HIGH`: 480 minutes (8 hours)
  - `MEDIUM`: 1440 minutes (24 hours)
  - `LOW`: 4320 minutes (72 hours)
- **Zero DB Polling Writes**: Sitting in the queue consumes **zero database writes**. The client browser computes live 1-second countdowns locally from `slaDueAt - Date.now()`.
- **Accurate Pause & Resume**: When set to `PENDING` (awaiting customer), active remaining seconds are frozen once into `slaPausedRemainingSeconds`. When a customer replies, `slaDueAt = now() + slaPausedRemainingSeconds` unpauses the clock with zero drift.

### 3. 👥 Multi-Agent Collaboration
- One primary assignee per ticket with support for any number of secondary collaborator agents via a normalized join table (`ticket_collaborators`).
- Collaborators inherit full working rights to view, reply, add internal notes, and resolve tickets.

### 4. 📝 Unified Chronological Timeline & Immutable Audit Ledger
- Interleaves public customer replies, agent replies, **warm amber staff-only internal notes**, and system lifecycle events into a single unified chronological feed.
- Every state change, assignment, and collaborator update is committed atomically alongside an append-only `AuditLog` record.

### 5. ⚡ Atomic Per-Ticket Bulk Operations & CSV Export
- Bulk status transitions and reassignments execute in isolated per-ticket database transactions.
- Provides itemized partial success reporting (`{ totalRequested, successCount, failureCount, results: [...] }`).
- Real-time RFC-4180 compliant CSV streaming export respecting active queue filters.

### 6. 📊 Real-Time Analytics & SLA Alerts Center
- **Supervisor Dashboard**: Headline metrics (Active, Breached, Pending Customer, Resolved This Week, CSAT Average), SVG Status Donut, Agent Workload bars, and an **8-Week Historical Resolution Trend** chart.
- **SLA Alerts Center**: Imminent ($<30\text{m}$) and breached tickets appear in the alert navigation center with live badge counts and 1-click acknowledgement.

---

## 🧪 Comprehensive Test Suite (176 Tests, 100% Passing)

Run the full automated test suite inside `backend/`:

```bash
cd backend
npm test
```

### Test Suite Breakdown (23 Test Suites)
| Test Category | Test File | Count | Focus Areas |
|---|---|---|---|
| **Unit Testing** | `backend/tests/unit/policies.test.ts` | 39 | Complete 3-role $\times$ permission matrix |
| **Unit Testing** | `backend/tests/unit/lifecycle-service.test.ts` | 26 | Valid/invalid state machine transitions & 7-day reopen guard |
| **Unit Testing** | `backend/tests/unit/api-routes-comprehensive.test.ts` | 21 | Route layer request/response validation & 401/400 auth guards |
| **Unit Testing** | `backend/tests/unit/sla-service.test.ts` | 10 | Target minutes calculation, pause & resume math |
| **Unit Testing** | `backend/tests/unit/cors-and-security.test.ts` | 6 | Dynamic origin reflection, cross-origin cookies, production partitioning |
| **Unit Testing** | `backend/tests/unit/export-service.test.ts` | 5 | RFC-4180 CSV escaping, formula injection protection |
| **Unit Testing** | `backend/tests/unit/auth.test.ts` | 3 | JWT signing, verification, expiration |
| **Unit Testing** | `backend/tests/unit/routes.test.ts` | 2 | API Route Registry structure & auth requirement verification |
| **Unit Testing** | `backend/tests/unit/health.test.ts` | 2 | Live DB health ping (`SELECT 1`), latency monitoring, error fallback |
| **Unit Testing** | `backend/tests/unit/timeline-service.test.ts` | 1 | Interleaving of replies & audit events with deduplication |
| **Security Testing** | `backend/tests/security/customer-security.test.ts` | 16 | Strict customer row-level isolation & internal note protection |
| **Integration** | `backend/tests/integration/route-handlers.integration.test.ts` | 10 | End-to-end HTTP route execution on live Supabase (CRUD, replies, status, CSAT, bulk) |
| **Integration** | `backend/tests/integration/comprehensive-fixes.test.ts` | 5 | Multi-agent collaboration, SLA cycles, bulk workflows |
| **Integration** | `backend/tests/integration/bulk-operations.integration.test.ts` | 3 | Isolated per-ticket atomicity & partial success reporting |
| **Integration** | `backend/tests/integration/lifecycle.integration.test.ts` | 3 | Real PostgreSQL transactions & audit logs |
| **Integration** | `backend/tests/integration/queue-and-filters.integration.test.ts` | 3 | Multi-field filtering, search, pagination |
| **Integration** | `backend/tests/integration/collaboration.integration.test.ts` | 1 | Multi-agent collaborator assignment & access |
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
| **Customer** | John Doe | `john@acme.com` | `password123` | Customer Portal: Submit tickets, view own tickets, rate CSAT |

---

## 🛠️ Quick Start & Local Setup

### 1. Install Dependencies
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 2. Configure Environment Variables & Database
Create `backend/.env` (supports both local PostgreSQL or cloud Supabase with connection pooling):
```env
# Supabase Pooler (Transaction Mode, Port 6543)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15&pool_timeout=30"

# Supabase Direct Session (Port 5432 - Used by Prisma migrations)
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

JWT_SECRET="super-secret-jwt-key-for-session-tokens"
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

### 3. Run Database Setup (Backend)
```bash
cd backend
npx prisma db push
npm run seed
```

### 4. Run Services (Independently in Separate Terminals)

**Start Backend REST Service (Port 3001)**:
```bash
cd backend
npm run dev
```

**Start Frontend UI Application (Port 3000)**:
```bash
cd frontend
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 📄 License
MIT
