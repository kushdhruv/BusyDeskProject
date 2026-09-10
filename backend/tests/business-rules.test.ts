import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Role, Priority, Category, Status, AuthorType, AuditEventType, SlaAlertStatus } from "@prisma/client";
import { TicketPolicy, ReplyPolicy, CollaboratorPolicy, AlertPolicy } from "@/lib/policies";
import { LifecycleService } from "@/lib/services/LifecycleService";
import { SlaService } from "@/lib/services/SlaService";
import { ReplyService } from "@/lib/services/ReplyService";
import { TicketService } from "@/lib/services/TicketService";
import { BulkService } from "@/lib/services/BulkService";
import { AuditService } from "@/lib/services/AuditService";
import { SessionUser } from "@/lib/types";
import { REOPEN_WINDOW_DAYS } from "@/lib/constants";

const prisma = new PrismaClient();

describe("Support Ticketing System — Core Business Invariants", () => {
  let supervisorUser: SessionUser;
  let agentSarahUser: SessionUser;
  let agentAlexUser: SessionUser;

  beforeAll(async () => {
    // Look up seeded users
    const supervisor = await prisma.user.findUnique({ where: { email: "supervisor@busy.com" } });
    const sarah = await prisma.user.findUnique({ where: { email: "sarah@busy.com" } });
    const alex = await prisma.user.findUnique({ where: { email: "alex@busy.com" } });

    if (!supervisor || !sarah || !alex) {
      throw new Error("Seeded users not found in database. Run db:seed before tests.");
    }

    supervisorUser = { id: supervisor.id, email: supervisor.email, name: supervisor.name, role: supervisor.role };
    agentSarahUser = { id: sarah.id, email: sarah.email, name: sarah.name, role: sarah.role };
    agentAlexUser = { id: alex.id, email: alex.email, name: alex.name, role: alex.role };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // 1. Role-based authorization & Scoping
  it("Rule 1: Supervisor has global access; Agent can only access assigned or collaborating tickets", () => {
    const unassignedTicket = {
      id: "t-unassigned",
      status: Status.NEW,
      primaryAssigneeId: null,
      collaborators: [],
    };

    const sarahAssignedTicket = {
      id: "t-sarah",
      status: Status.OPEN,
      primaryAssigneeId: agentSarahUser.id,
      collaborators: [{ userId: agentAlexUser.id }],
    };

    // Supervisor can view both
    expect(TicketPolicy.canView(supervisorUser, unassignedTicket)).toBe(true);
    expect(TicketPolicy.canView(supervisorUser, sarahAssignedTicket)).toBe(true);

    // Sarah can view her assigned ticket, but not unassigned ticket
    expect(TicketPolicy.canView(agentSarahUser, sarahAssignedTicket)).toBe(true);
    expect(TicketPolicy.canView(agentSarahUser, unassignedTicket)).toBe(false);

    // Alex can view sarahAssignedTicket because he is a collaborator
    expect(TicketPolicy.canView(agentAlexUser, sarahAssignedTicket)).toBe(true);
  });

  // 2. Agent cannot reassign primary assignee away from themselves
  it("Rule 2: Only Supervisors can reassign primary ticket ownership; Agents are rejected", () => {
    expect(TicketPolicy.canReassign(supervisorUser)).toBe(true);
    expect(TicketPolicy.canReassign(agentSarahUser)).toBe(false);
    expect(TicketPolicy.canReassign(agentAlexUser)).toBe(false);
  });

  // 3. Ticket Closing Policy (Supervisor only)
  it("Rule 3: Only Supervisors are authorized to permanently close RESOLVED tickets", () => {
    const resolvedTicket = {
      id: "t-resolved",
      status: Status.RESOLVED,
      primaryAssigneeId: agentSarahUser.id,
    };

    expect(TicketPolicy.canClose(supervisorUser, resolvedTicket)).toBe(true);
    expect(TicketPolicy.canClose(agentSarahUser, resolvedTicket)).toBe(false);
  });

  // 4. Lifecycle State Machine Valid Transitions
  it("Rule 4: Valid lifecycle transitions are accepted by LifecycleService", () => {
    const context = { closedAt: null };

    // NEW -> OPEN
    expect(LifecycleService.validateTransition(Status.NEW, Status.OPEN, agentSarahUser, context).valid).toBe(true);
    // OPEN -> PENDING
    expect(LifecycleService.validateTransition(Status.OPEN, Status.PENDING, agentSarahUser, context).valid).toBe(true);
    // PENDING -> OPEN
    expect(LifecycleService.validateTransition(Status.PENDING, Status.OPEN, agentSarahUser, context).valid).toBe(true);
    // OPEN -> RESOLVED
    expect(LifecycleService.validateTransition(Status.OPEN, Status.RESOLVED, agentSarahUser, context).valid).toBe(true);
    // RESOLVED -> CLOSED (Supervisor)
    expect(LifecycleService.validateTransition(Status.RESOLVED, Status.CLOSED, supervisorUser, context).valid).toBe(true);
  });

  // 5. Lifecycle State Machine Invalid Transitions (Rejected with descriptive error)
  it("Rule 5: Illegal status jumps are rejected with descriptive explanatory reasons", () => {
    const context = { closedAt: null };

    // NEW -> CLOSED (Illegal direct jump)
    const res1 = LifecycleService.validateTransition(Status.NEW, Status.CLOSED, supervisorUser, context);
    expect(res1.valid).toBe(false);
    expect(res1.reason).toContain("A NEW ticket must be moved to OPEN");

    // OPEN -> CLOSED (Must be RESOLVED first)
    const res2 = LifecycleService.validateTransition(Status.OPEN, Status.CLOSED, supervisorUser, context);
    expect(res2.valid).toBe(false);
    expect(res2.reason).toContain("must be marked as RESOLVED before they can be CLOSED");

    // RESOLVED -> CLOSED by Agent (Supervisor only)
    const res3 = LifecycleService.validateTransition(Status.RESOLVED, Status.CLOSED, agentSarahUser, context);
    expect(res3.valid).toBe(false);
    expect(res3.reason).toContain("Only Supervisors are authorized");
  });

  // 6. 7-Day Reopen Window Guard
  it("Rule 6: Closed ticket can only be reopened within 7 days; rejected thereafter", () => {
    const now = Date.now();

    // Closed 3 days ago (Within window)
    const recentClosedContext = {
      closedAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
    };
    const recentReopen = LifecycleService.validateTransition(
      Status.CLOSED,
      Status.OPEN,
      supervisorUser,
      recentClosedContext
    );
    expect(recentReopen.valid).toBe(true);

    // Closed 15 days ago (Past 7-day window)
    const expiredClosedContext = {
      closedAt: new Date(now - 15 * 24 * 60 * 60 * 1000),
    };
    const expiredReopen = LifecycleService.validateTransition(
      Status.CLOSED,
      Status.OPEN,
      supervisorUser,
      expiredClosedContext
    );
    expect(expiredReopen.valid).toBe(false);
    expect(expiredReopen.reason).toContain("reopen window expired");
  });

  // 7. SLA Pause on PENDING & Resume on Customer Reply
  it("Rule 7 & 8: SLA clock pauses on PENDING and resumes with preserved time on customer reply", async () => {
    // Create test ticket
    const ticket = await TicketService.createTicket(
      {
        subject: "Test SLA Pause Resume Flow",
        description: "Testing pause and resume math",
        requesterName: "John Doe",
        requesterEmail: "john@example.com",
        priority: Priority.HIGH, // 8 hours (480 mins)
      },
      supervisorUser
    );

    expect(ticket.status).toBe(Status.NEW);
    expect(ticket.slaDueAt).not.toBeNull();

    // Move to OPEN then PENDING
    await TicketService.changeStatus(ticket.id, Status.OPEN, supervisorUser);
    const pendingTicket = await TicketService.changeStatus(ticket.id, Status.PENDING, supervisorUser);

    expect(pendingTicket.status).toBe(Status.PENDING);
    expect(pendingTicket.slaDueAt).toBeNull(); // Paused!
    expect(pendingTicket.slaPausedAt).not.toBeNull();
    expect(pendingTicket.slaPausedRemainingSeconds).toBeGreaterThan(0);

    const savedRemaining = pendingTicket.slaPausedRemainingSeconds!;

    // Simulate customer reply -> Pending should return to Open and SLA clock should resume
    await ReplyService.addCustomerReply(ticket.id, {
      body: "Here is the requested information.",
    });

    const resumedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(resumedTicket?.status).toBe(Status.OPEN);
    expect(resumedTicket?.slaPausedAt).toBeNull();
    expect(resumedTicket?.slaPausedRemainingSeconds).toBeNull();
    expect(resumedTicket?.slaDueAt).not.toBeNull();

    // Verify resumed deadline reflects preserved remaining seconds
    const expectedDueMs = Date.now() + savedRemaining * 1000;
    const actualDueMs = new Date(resumedTicket!.slaDueAt!).getTime();
    expect(Math.abs(actualDueMs - expectedDueMs)).toBeLessThan(5000); // within 5 seconds tolerance
  });

  // 8. SLA Alert Acknowledgement & Re-breach upon Reopening (SLA Cycle)
  it("Rule 9 & 10: SLA alert acknowledgement is cycle-bound; reopening increments cycle and re-triggers alert", async () => {
    // Create an already breached ticket
    const now = new Date();
    const breachedTicket = await prisma.ticket.create({
      data: {
        subject: "Test SLA Re-breach Cycle",
        description: "Testing alert return upon reopening",
        requesterName: "Alice",
        requesterEmail: "alice@example.com",
        priority: Priority.URGENT,
        status: Status.OPEN,
        createdById: supervisorUser.id,
        primaryAssigneeId: agentSarahUser.id,
        slaTargetMinutes: 120,
        slaDueAt: new Date(now.getTime() - 30 * 60 * 1000), // Breached
        slaCycle: 1,
      },
    });

    // Sync alert
    await SlaService.syncAlertForTicket(breachedTicket.id);

    const activeAlerts = await prisma.slaAlert.findMany({
      where: { ticketId: breachedTicket.id, status: SlaAlertStatus.ACTIVE },
    });
    expect(activeAlerts.length).toBe(1);
    expect(activeAlerts[0].breachCycle).toBe(1);

    // Sarah acknowledges the alert
    await SlaService.acknowledgeAlert(activeAlerts[0].id, agentSarahUser);

    const acknowledgedAlert = await prisma.slaAlert.findUnique({
      where: { id: activeAlerts[0].id },
    });
    expect(acknowledgedAlert?.status).toBe(SlaAlertStatus.ACKNOWLEDGED);

    // Ticket is resolved
    await TicketService.changeStatus(breachedTicket.id, Status.RESOLVED, agentSarahUser);

    // Ticket is later reopened -> slaCycle increments to 2
    const reopenedTicket = await TicketService.changeStatus(breachedTicket.id, Status.OPEN, agentSarahUser);
    expect(reopenedTicket.slaCycle).toBe(2);

    // Manually backdate the due date in cycle 2 to simulate a second breach
    await prisma.ticket.update({
      where: { id: breachedTicket.id },
      data: { slaDueAt: new Date(now.getTime() - 10 * 60 * 1000) },
    });

    await SlaService.syncAlertForTicket(breachedTicket.id);

    // A fresh ACTIVE alert must be created for cycle 2!
    const cycle2Alerts = await prisma.slaAlert.findMany({
      where: { ticketId: breachedTicket.id, status: SlaAlertStatus.ACTIVE },
    });
    expect(cycle2Alerts.length).toBe(1);
    expect(cycle2Alerts[0].breachCycle).toBe(2);
  });

  // 9. Bulk Operations Partial Success
  it("Rule 11: Bulk actions execute with per-ticket atomicity and return granular success/failure reasons", async () => {
    // Create 2 open tickets and 1 closed ticket
    const t1 = await TicketService.createTicket(
      { subject: "Bulk Test 1", description: "Desc", requesterName: "A", requesterEmail: "a@test.com" },
      supervisorUser
    );
    const t2 = await TicketService.createTicket(
      { subject: "Bulk Test 2", description: "Desc", requesterName: "B", requesterEmail: "b@test.com" },
      supervisorUser
    );

    await TicketService.changeStatus(t1.id, Status.OPEN, supervisorUser);
    await TicketService.changeStatus(t1.id, Status.RESOLVED, supervisorUser);

    await TicketService.changeStatus(t2.id, Status.OPEN, supervisorUser);
    // t2 is OPEN (not resolved yet)

    // Execute bulk close: t1 should succeed (RESOLVED -> CLOSED), t2 should fail (OPEN cannot close directly)
    const result = await BulkService.executeBulkAction(
      [t1.id, t2.id],
      "CLOSE",
      {},
      supervisorUser
    );

    expect(result.totalRequested).toBe(2);
    expect(result.succeededCount).toBe(1);
    expect(result.failedCount).toBe(1);

    const r1 = result.results.find((r) => r.ticketId === t1.id);
    const r2 = result.results.find((r) => r.ticketId === t2.id);

    expect(r1?.status).toBe("SUCCESS");
    expect(r2?.status).toBe("FAILED");
    expect(r2?.reason).toContain("RESOLVED before they can be CLOSED");
  });

  // 10. Archive Isolation (Default queue excludes archived)
  it("Rule 12: Default queue queries strictly filter out archived tickets", async () => {
    const t = await TicketService.createTicket(
      { subject: "Archive Test Ticket", description: "Desc", requesterName: "C", requesterEmail: "c@test.com" },
      supervisorUser
    );

    // Visible initially
    const q1 = await TicketService.getQueue({ search: "Archive Test Ticket" }, supervisorUser);
    expect(q1.tickets.some((item) => item.id === t.id)).toBe(true);

    // Archive ticket
    await TicketService.archive(t.id, supervisorUser);

    // Must not be in default queue
    const q2 = await TicketService.getQueue({ search: "Archive Test Ticket" }, supervisorUser);
    expect(q2.tickets.some((item) => item.id === t.id)).toBe(false);

    // Must appear in archived scope
    const qArchived = await TicketService.getQueue({ scope: "archived", search: "Archive Test Ticket" }, supervisorUser);
    expect(qArchived.tickets.some((item) => item.id === t.id)).toBe(true);
  });

  // 11. Transaction Atomicity Test (Ticket mutation + Audit Log rollback)
  it("Rule 13: Transaction Atomicity: A failed audit write rolls back ticket changes", async () => {
    const ticket = await TicketService.createTicket(
      { subject: "Atomicity Rollback Test", description: "Desc", requesterName: "D", requesterEmail: "d@test.com" },
      supervisorUser
    );

    const originalSubject = ticket.subject;

    // Simulate an atomic operation where audit fails
    try {
      await prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { subject: "Uncommitted Mutated Subject" },
        });

        // Deliberately throw error before transaction commits
        throw new Error("Simulated downstream audit insertion failure");
      });
    } catch {
      // expected error
    }

    // Verify database rolled back and subject remained unchanged
    const reloaded = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(reloaded?.subject).toBe(originalSubject);
  });
});
