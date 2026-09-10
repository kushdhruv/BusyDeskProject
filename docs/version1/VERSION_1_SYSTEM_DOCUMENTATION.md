# SupportDesk (BusyDesk) — Version 1.0 Complete System Documentation & Snapshot

## Overview
**SupportDesk** is a production-minded, modular-monolith Support Ticketing Platform built with **Next.js 14 App Router**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**. It satisfies all 10 core requirements of Assignment 04 with strict server-side policy enforcement, deadline-based SLA lifecycle calculations, atomic per-ticket bulk operations, an immutable append-only audit trail, an 8-week historical resolution metrics dashboard, and a modern minimalist `#0F172A` SaaS design system.

This document serves as the **Version 1.0 Baseline Reference** prior to entering subsequent feature phases and upgrades.

---

## 1. System Architecture & Tech Stack

### Core Technologies
- **Framework**: Next.js 14.2 (App Router, Server Actions, Route Handlers)
- **Language**: TypeScript 5.0 (Strict mode enabled)
- **Database**: PostgreSQL 16 (Relational database with ACID transactions)
- **ORM**: Prisma 5.22.0 (Client generation, migrations, composite indexes)
- **Styling**: Tailwind CSS + Vanilla CSS utilities (`#0F172A` Slate design system)
- **Icons**: Lucide React
- **Authentication**: `jose` (Signed JWT sessions in secure HTTP-only cookies) + `bcryptjs` (Salted password hashing)
- **Testing**: Vitest 2.1.9 (Unit, Integration, Fuzz, and Business Rules testing)

### Architectural Pattern: Decoupled Microservice Architecture
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
└── SUBMISSION.md
```

---

## 2. Database Schema & Relational Design

### Entity Models

#### 1. `users`
Represents agents and supervisors.
- `id` (`String` / `cuid`, PK)
- `email` (`String`, Unique)
- `passwordHash` (`String`, bcrypt)
- `name` (`String`)
- `role` (`Enum: SUPERVISOR | AGENT`)
- `createdAt`, `updatedAt` (`DateTime`)

#### 2. `tickets`
Core entity holding metadata, lifecycle status, and SLA timestamps.
- `id` (`String` / `cuid`, PK)
- `ticketNumber` (`Int`, Unique, Auto-increment)
- `subject` (`String`)
- `description` (`Text`)
- `requesterName`, `requesterEmail` (`String`)
- `priority` (`Enum: LOW | MEDIUM | HIGH | URGENT`)
- `category` (`Enum: BUG | BILLING | FEATURE | QUESTION`)
- `status` (`Enum: NEW | OPEN | PENDING | RESOLVED | CLOSED`)
- `createdById` (`String`, FK $\rightarrow$ `users.id`)
- `primaryAssigneeId` (`String?`, Nullable, FK $\rightarrow$ `users.id`)
- `slaTargetMinutes` (`Int`) — Urgent: 120m, High: 480m, Medium: 1440m, Low: 4320m
- `slaDueAt` (`DateTime?`, Nullable, Indexed) — Null while paused in `PENDING`
- `slaPausedAt` (`DateTime?`, Nullable)
- `slaPausedRemainingSeconds` (`Int?`, Nullable) — Preserved duration while in `PENDING`
- `slaCycle` (`Int`, Default: 1) — Increments upon reopen
- `resolvedAt`, `closedAt`, `archivedAt` (`DateTime?`, Nullable, Indexed)
- `createdAt`, `updatedAt` (`DateTime`, Indexed)

#### 3. `ticket_collaborators`
Normalized many-to-many join table for secondary agents.
- `id` (`String`, PK)
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade)
- `userId` (`String`, FK $\rightarrow$ `users.id`, OnDelete: Cascade)
- `addedById` (`String`, FK $\rightarrow$ `users.id`)
- `createdAt` (`DateTime`)
- **Constraint**: `UNIQUE(ticketId, userId)`

#### 4. `replies`
Append-only conversation messages.
- `id` (`String`, PK)
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade)
- `authorId` (`String?`, FK $\rightarrow$ `users.id`, OnDelete: SetNull)
- `authorType` (`Enum: AGENT | CUSTOMER | SYSTEM`)
- `authorName`, `authorEmail` (`String`)
- `body` (`Text`)
- `isInternal` (`Boolean`, Default: `false`) — `true` for private staff notes
- `createdAt` (`DateTime`, Indexed)

#### 5. `audit_logs`
Immutable append-only ledger for all system mutations.
- `id` (`String`, PK)
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade)
- `actorId` (`String?`, FK $\rightarrow$ `users.id`, OnDelete: SetNull)
- `actorName` (`String`)
- `eventType` (`Enum: TICKET_CREATED | STATUS_CHANGED | REASSIGNED | COLLABORATOR_ADDED | COLLABORATOR_REMOVED | REPLY_ADDED | TICKET_EDITED | TICKET_ARCHIVED | TICKET_RESTORED | SLA_ALERT_ACKNOWLEDGED`)
- `oldValue`, `newValue`, `metadata` (`Json?`, Nullable)
- `createdAt` (`DateTime`, Indexed)

#### 6. `sla_alerts`
Tracks active and acknowledged SLA breach notifications.
- `id` (`String`, PK)
- `ticketId` (`String`, FK $\rightarrow$ `tickets.id`, OnDelete: Cascade)
- `type` (`Enum: DUE_SOON | BREACHED`)
- `status` (`Enum: ACTIVE | ACKNOWLEDGED | RESOLVED`)
- `breachCycle` (`Int`, Default: 1)
- `acknowledgedById` (`String?`, FK $\rightarrow$ `users.id`)
- `acknowledgedAt` (`DateTime?`, Nullable)
- `createdAt` (`DateTime`, Indexed)
- **Constraint**: `UNIQUE(ticketId, breachCycle)`

---

## 3. Core Business Invariants & Domain Rules

1. **Role Enforcement (`lib/policies/TicketPolicy.ts`)**:
   - **Supervisors**: Full access to all tickets, reassign to anyone, close tickets, reopen within 7 days, trigger bulk operations, export CSV, access department analytics.
   - **Agents**: Can only view, reply to, add notes to, and resolve tickets where `primaryAssigneeId === user.id` or they exist in `ticket_collaborators`. Cannot reassign away from themselves. Cannot close tickets.

2. **State Machine & Lifecycle (`lib/services/LifecycleService.ts`)**:
   - Valid transitions:
     - `NEW -> OPEN`
     - `OPEN -> PENDING`, `OPEN -> RESOLVED`
     - `PENDING -> OPEN` (via customer reply), `PENDING -> RESOLVED`
     - `RESOLVED -> CLOSED`, `RESOLVED -> OPEN` (within 7 days)
     - `CLOSED -> OPEN` (Supervisors only, within 7-day window)
   - Invalid moves are rejected server-side with explanatory messages.

3. **Deadline-Based SLA Math (`lib/services/SlaService.ts`)**:
   - **Zero Polling Database Writes**: No periodic decrementing counters in the database.
   - Priority targets: Urgent (2h), High (8h), Medium (24h), Low (72h).
   - When entering `PENDING`: Frozen remaining seconds stored in `slaPausedRemainingSeconds`; `slaDueAt` set to `null`.
   - When returning to `OPEN` (Customer Reply): `slaDueAt = now() + slaPausedRemainingSeconds`.
   - Live 1-second interval countdowns are calculated locally in the browser from `slaDueAt - Date.now()`.
   - Reopening a ticket increments `slaCycle`, establishing a clean boundary for subsequent breach alerts.

4. **Isolated Bulk Operations (`lib/services/BulkService.ts`)**:
   - Each ticket in a bulk request is processed in its own isolated database transaction.
   - Failure on one ticket does not roll back valid updates to other tickets.
   - Returns granular partial success summary: `{ totalRequested, successCount, failureCount, results: [...] }`.

5. **Default Archive Isolation**:
   - Every default queue query enforces `archivedAt IS NULL`.
   - Archived tickets are accessible only through explicit `scope=archived` filters.

---

## 4. Test Suite Structure & Validation (104 Tests, 100% Passing)

```bash
npm test
```

| Suite | File | Tests | Coverage Scope |
|---|---|---|---|
| **Unit** | `tests/unit/policies.test.ts` | 29 | Complete role $\times$ permission matrix, boundary conditions |
| **Unit** | `tests/unit/lifecycle-service.test.ts` | 26 | Valid/invalid state machine transitions, 7-day reopen window |
| **Unit** | `tests/unit/sla-service.test.ts` | 10 | Deadline math, pause math, resume math, cycle increments |
| **Unit** | `tests/unit/export-service.test.ts` | 5 | RFC-4180 CSV formatting, comma/quote escaping, formula sanitization |
| **Unit** | `tests/unit/auth.test.ts` | 3 | JWT signing, verification, tampering, expiration |
| **Unit** | `tests/unit/timeline-service.test.ts` | 1 | Interleaving of replies, internal notes, and audit events |
| **Integration** | `tests/integration/lifecycle.integration.test.ts` | 3 | Real PostgreSQL transactions for status changes and audit logs |
| **Integration** | `tests/integration/collaboration.integration.test.ts` | 1 | Multi-agent collaborator assignments, duplicate prevention |
| **Integration** | `tests/integration/bulk-operations.integration.test.ts` | 3 | Per-ticket atomicity, partial success reporting, empty payloads |
| **Integration** | `tests/integration/queue-and-filters.integration.test.ts` | 3 | Multi-field compound filters, text search, pagination, archive isolation |
| **Integration** | `tests/integration/dashboard-and-metrics.integration.test.ts` | 1 | Headline metric cards, status distributions, 8-week trend buckets |
| **Integration** | `tests/integration/sla-alerts.integration.test.ts` | 1 | Breach detection, alert sync, 1-click acknowledgement |
| **Business Rules** | `tests/business-rules.test.ts` | 11 | End-to-end invariant validation of all 10 core requirements |
| **Fuzz** | `tests/fuzz/input-fuzzing.test.ts` | 3 | SQL injection, XSS payloads, 10KB+ strings, Unicode/RTL, null bytes |
| **Fuzz** | `tests/fuzz/query-fuzzing.test.ts` | 2 | Out-of-bounds pagination, negative integers, regex wildcards |
| **Fuzz** | `tests/fuzz/bulk-and-concurrency-fuzzing.test.ts` | 2 | Chaotic ID arrays, non-existent UUIDs, 10 concurrent parallel replies |

**Total Coverage: 16 Test Files &bull; 104 Tests &bull; 100% Passed**

---

## 5. Pre-configured Demo Accounts

| Role | Name | Email | Password | Scope & Permissions |
|---|---|---|---|---|
| **Supervisor** | Suresh Menon | `supervisor@busy.com` | `password123` | Full access, Close/Reopen, Reassign, Bulk Operations, CSV Export, Metrics |
| **Senior Agent** | Sarah Jenkins | `sarah@busy.com` | `password123` | Assigned urgent breached tickets, collaborators, pending customer replies |
| **Support Agent** | Alex Rivera | `alex@busy.com` | `password123` | High priority due-soon tickets, team collaborations, ticket resolution |
| **Tier 1 Agent** | Jordan Lee | `jordan@busy.com` | `password123` | Low/medium tickets, resolved incident tickets |

---

## 6. Verification & Run Commands

```bash
# 1. Install dependencies in both modules
cd frontend && npm install
cd ../backend && npm install

# 2. Setup PostgreSQL database & seed demo accounts (in backend/)
cd backend
npx prisma db push
npm run seed

# 3. Run full automated test suite (104/104 tests passing in backend/)
cd backend
npm test

# 4. Start backend REST API service (Port 3001)
cd backend
npm run dev

# 5. Start frontend UI application (Port 3000 in a separate terminal)
cd frontend
npm run dev
```
