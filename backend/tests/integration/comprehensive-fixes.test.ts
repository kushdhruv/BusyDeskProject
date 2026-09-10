import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status, SlaAlertType, SlaAlertStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { TicketService } from "../../lib/services/TicketService";
import { SlaService } from "../../lib/services/SlaService";
import { TimelineService } from "../../lib/services/TimelineService";
import { SessionUser } from "../../lib/types";

describe("Integration Tests: Comprehensive Bug Fix Verifications", () => {
  let supervisor: SessionUser;
  let agent1: SessionUser;
  let agent2: SessionUser;

  beforeAll(async () => {
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    const ag1 = await prisma.user.findFirst({ where: { email: "sarah@busy.com" } });
    const ag2 = await prisma.user.findFirst({ where: { email: "alex@busy.com" } });
    supervisor = { id: sup!.id, email: sup!.email, name: sup!.name, role: sup!.role };
    agent1 = { id: ag1!.id, email: ag1!.email, name: ag1!.name, role: ag1!.role };
    agent2 = { id: ag2!.id, email: ag2!.email, name: ag2!.name, role: ag2!.role };
  });

  it("1. Detects passive SLA breaches dynamically when getActiveAlerts is called", async () => {
    const pastDue = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
    const ticket = await prisma.ticket.create({
      data: {
        subject: "Passive SLA Breach Test",
        description: "Testing dynamic SLA detection without explicit mutation",
        requesterId: supervisor.id,
        requesterName: "Passive User",
        requesterEmail: "passive@example.com",
        priority: Priority.HIGH,
        category: Category.QUESTION,
        status: Status.OPEN,
        slaTargetMinutes: 480,
        slaDueAt: pastDue,
        slaCycle: 1,
        createdById: supervisor.id,
        primaryAssigneeId: agent1.id,
      },
    });

    const activeAlertsRes = await SlaService.getActiveAlerts(agent1);
    const foundAlert = activeAlertsRes.alerts.find((a) => a.ticketId === ticket.id);

    expect(foundAlert).toBeDefined();
    expect(foundAlert?.type).toBe(SlaAlertType.BREACHED);

    // Cleanup
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  it("2. Escalates an acknowledged DUE_SOON warning to an ACTIVE BREACHED alert when time passes", async () => {
    const pastDue = new Date(Date.now() - 10 * 60 * 1000); // Breached
    const ticket = await prisma.ticket.create({
      data: {
        subject: "Warning Escalation Test",
        description: "Testing warning to breach escalation",
        requesterId: supervisor.id,
        requesterName: "Warn User",
        requesterEmail: "warn@example.com",
        priority: Priority.HIGH,
        category: Category.BUG,
        status: Status.OPEN,
        slaTargetMinutes: 480,
        slaDueAt: pastDue,
        slaCycle: 1,
        createdById: supervisor.id,
        primaryAssigneeId: agent1.id,
      },
    });

    // Create an acknowledged warning alert
    const warnAlert = await prisma.slaAlert.create({
      data: {
        ticketId: ticket.id,
        type: SlaAlertType.DUE_SOON,
        status: SlaAlertStatus.ACKNOWLEDGED,
        breachCycle: 1,
        acknowledgedById: agent1.id,
        acknowledgedAt: new Date(),
      },
    });

    // Sync alert should escalate to BREACHED and ACTIVE
    await SlaService.syncAlertForTicket(ticket.id);

    const updatedAlert = await prisma.slaAlert.findUnique({ where: { id: warnAlert.id } });
    expect(updatedAlert?.type).toBe(SlaAlertType.BREACHED);
    expect(updatedAlert?.status).toBe(SlaAlertStatus.ACTIVE);

    // Cleanup
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  it("3. Recalculates SLA due date by target delta on priority update, preserving elapsed time", async () => {
    const now = Date.now();
    const initialDue = new Date(now + 1440 * 60 * 1000); // 24 hours from now (MEDIUM)
    const ticket = await TicketService.createTicket(
      {
        subject: "Delta SLA Test",
        description: "Testing delta SLA math",
        requesterName: "Delta User",
        requesterEmail: "delta@example.com",
        priority: Priority.MEDIUM,
        category: Category.BILLING,
        primaryAssigneeId: supervisor.id,
      },
      supervisor
    );

    // Change priority to HIGH (8h = 480m). Target delta = 480 - 1440 = -960m (-16h)
    const updatedTicket = await TicketService.updateTicketDetails(
      ticket.id,
      { priority: Priority.HIGH },
      supervisor
    );

    const expectedDueMs = ticket.slaDueAt!.getTime() - 16 * 60 * 60 * 1000;
    expect(Math.abs(updatedTicket.slaDueAt!.getTime() - expectedDueMs)).toBeLessThan(5000);

    // Cleanup
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  it("4. Prevents non-supervisor agent from assigning tickets to other agents upon creation", async () => {
    await expect(
      TicketService.createTicket(
        {
          subject: "Bypass Creation Assignment",
          description: "Agent attempting to assign to another agent",
          requesterName: "Hacker Agent",
          requesterEmail: "hacker@agent.com",
          primaryAssigneeId: agent2.id,
        },
        agent1
      )
    ).rejects.toThrow("Agents cannot assign tickets to other agents upon creation");
  });

  it("5. Filters out REPLY_ADDED audit logs in unified timeline to prevent duplicate reply entries", async () => {
    const ticket = await TicketService.createTicket(
      {
        subject: "Timeline Deduplication Test",
        description: "Testing single entry for replies",
        requesterName: "Timeline User",
        requesterEmail: "time@example.com",
        primaryAssigneeId: supervisor.id,
      },
      supervisor
    );

    await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        authorId: supervisor.id,
        authorName: supervisor.name,
        authorEmail: supervisor.email,
        body: "Test Reply Body",
      },
    });

    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        actorId: supervisor.id,
        actorName: supervisor.name,
        eventType: "REPLY_ADDED",
      },
    });

    const timeline = await TimelineService.getUnifiedTimeline(ticket.id);
    const replyItems = timeline.filter((t) => t.type === "REPLY");
    const auditReplyItems = timeline.filter(
      (t) => t.type === "AUDIT" && t.audit?.eventType === "REPLY_ADDED"
    );

    expect(replyItems.length).toBe(1);
    expect(auditReplyItems.length).toBe(0);

    // Cleanup
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
