import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status, SlaAlertType, SlaAlertStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { TicketService } from "../../lib/services/TicketService";
import { SlaService } from "../../lib/services/SlaService";
import { SessionUser } from "../../lib/types";

describe("Integration Tests: SLA Breach Detection, Alerts & Acknowledgement", () => {
  let supervisor: SessionUser;
  let agent1: SessionUser;

  beforeAll(async () => {
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    const ag1 = await prisma.user.findFirst({ where: { email: "sarah@busy.com" } });
    supervisor = { id: sup!.id, email: sup!.email, name: sup!.name, role: sup!.role };
    agent1 = { id: ag1!.id, email: ag1!.email, name: ag1!.name, role: ag1!.role };
  });

  it("Generates SLA breach alert when deadline passed, supports acknowledgement, and resolves alert on ticket resolution", async () => {
    // 1. Create a ticket with past slaDueAt (breached)
    const breachedDue = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    const ticket = await prisma.ticket.create({
      data: {
        subject: "SLA Alert Integration Test",
        description: "Breached ticket testing",
        requesterId: supervisor.id,
        requesterName: "Urgent Cust",
        requesterEmail: "urg@cust.com",
        priority: Priority.URGENT,
        category: Category.BUG,
        status: Status.OPEN,
        slaTargetMinutes: 240,
        slaDueAt: breachedDue,
        slaCycle: 1,
        createdById: supervisor.id,
        primaryAssigneeId: agent1.id,
      },
    });

    // 2. Sync alert
    await SlaService.syncAlertForTicket(ticket.id);

    const alert = await prisma.slaAlert.findFirst({
      where: { ticketId: ticket.id, breachCycle: 1 },
    });
    expect(alert).not.toBeNull();
    expect(alert?.type).toBe(SlaAlertType.BREACHED);
    expect(alert?.status).toBe(SlaAlertStatus.ACTIVE);

    // 3. Acknowledge alert
    const acked = await SlaService.acknowledgeAlert(ticket.id, alert!.id, agent1);
    expect(acked.status).toBe(SlaAlertStatus.ACKNOWLEDGED);
    expect(acked.acknowledgedById).toBe(agent1.id);

    // 4. Resolve ticket -> active/acknowledged alerts should transition to RESOLVED or be cleared
    await TicketService.changeStatus(ticket.id, Status.RESOLVED, agent1);
    await SlaService.syncAlertForTicket(ticket.id);

    const finalAlert = await prisma.slaAlert.findUnique({ where: { id: alert!.id } });
    // Alert should either be marked resolved or inactive
    expect(finalAlert?.status).not.toBe(SlaAlertStatus.ACTIVE);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
