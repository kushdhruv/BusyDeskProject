import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status, AuditEventType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { TicketService } from "../../lib/services/TicketService";
import { ReplyService } from "../../lib/services/ReplyService";
import { SessionUser } from "../../lib/types";

describe("Integration Tests: Ticket Lifecycle, Inbound Replies & SLA Transitions", () => {
  let supervisor: SessionUser;
  let agent1: SessionUser;
  let agent2: SessionUser;

  beforeAll(async () => {
    // Ensure test users exist
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    const ag1 = await prisma.user.findFirst({ where: { email: "sarah@busy.com" } });
    const ag2 = await prisma.user.findFirst({ where: { email: "alex@busy.com" } });

    supervisor = {
      id: sup!.id,
      email: sup!.email,
      name: sup!.name,
      role: sup!.role,
    };

    agent1 = {
      id: ag1!.id,
      email: ag1!.email,
      name: ag1!.name,
      role: ag1!.role,
    };

    agent2 = {
      id: ag2!.id,
      email: ag2!.email,
      name: ag2!.name,
      role: ag2!.role,
    };
  });

  it("Full Ticket Lifecycle: Create -> Open -> Pending -> Customer Reply -> Resolve -> Close -> Reopen", async () => {
    // 1. Create ticket
    const ticket = await TicketService.createTicket(
      {
        subject: "Integration Test Lifecycle Ticket",
        description: "Testing end to end lifecycle state machine",
        requesterName: "John Customer",
        requesterEmail: "john@customer.com",
        priority: Priority.HIGH,
        category: Category.BUG,
        primaryAssigneeId: agent1.id,
      },
      supervisor
    );

    expect(ticket.status).toBe(Status.NEW);
    expect(ticket.slaCycle).toBe(1);
    expect(ticket.slaDueAt).not.toBeNull();
    expect(ticket.primaryAssigneeId).toBe(agent1.id);

    // 2. Move to OPEN
    const openTicket = await TicketService.changeStatus(ticket.id, Status.OPEN, agent1);
    expect(openTicket.status).toBe(Status.OPEN);

    // 3. Move to PENDING (Waiting on customer) -> SLA pauses
    const pendingTicket = await TicketService.changeStatus(ticket.id, Status.PENDING, agent1);
    expect(pendingTicket.status).toBe(Status.PENDING);
    expect(pendingTicket.slaDueAt).toBeNull();
    expect(pendingTicket.slaPausedAt).not.toBeNull();
    expect(pendingTicket.slaPausedRemainingSeconds).toBeGreaterThan(0);

    // 4. Customer replies -> auto transitions to OPEN and unpauses SLA
    const reply = await ReplyService.addCustomerReply(ticket.id, {
      body: "Here is the requested screenshot of the bug.",
    });
    expect(reply.body).toContain("screenshot");

    const resumedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(resumedTicket?.status).toBe(Status.OPEN);
    expect(resumedTicket?.slaDueAt).not.toBeNull();
    expect(resumedTicket?.slaPausedAt).toBeNull();
    expect(resumedTicket?.slaPausedRemainingSeconds).toBeNull();

    // 5. Agent resolves ticket
    const resolvedTicket = await TicketService.changeStatus(ticket.id, Status.RESOLVED, agent1);
    expect(resolvedTicket.status).toBe(Status.RESOLVED);
    expect(resolvedTicket.resolvedAt).not.toBeNull();

    // 6. Agent tries to close -> rejected
    await expect(
      TicketService.changeStatus(ticket.id, Status.CLOSED, agent1)
    ).rejects.toThrow(/Only Supervisors/);

    // 7. Supervisor closes ticket
    const closedTicket = await TicketService.changeStatus(ticket.id, Status.CLOSED, supervisor);
    expect(closedTicket.status).toBe(Status.CLOSED);
    expect(closedTicket.closedAt).not.toBeNull();

    // 8. Supervisor reopens ticket -> starts cycle 2
    const reopenedTicket = await TicketService.changeStatus(ticket.id, Status.OPEN, supervisor);
    expect(reopenedTicket.status).toBe(Status.OPEN);
    expect(reopenedTicket.slaCycle).toBe(2);
    expect(reopenedTicket.closedAt).toBeNull();
    expect(reopenedTicket.resolvedAt).toBeNull();

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  it("Reopening ticket closed past 7 days is strictly refused", async () => {
    // Create a ticket and backdate closedAt to 15 days ago
    const pastDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const expiredTicket = await prisma.ticket.create({
      data: {
        subject: "Expired Closed Ticket",
        description: "Closed long ago",
        requesterName: "Old Customer",
        requesterEmail: "old@customer.com",
        priority: Priority.LOW,
        category: Category.QUESTION,
        status: Status.CLOSED,
        closedAt: pastDate,
        createdById: supervisor.id,
        primaryAssigneeId: agent1.id,
        slaTargetMinutes: 2880,
      },
    });

    await expect(
      TicketService.changeStatus(expiredTicket.id, Status.OPEN, supervisor)
    ).rejects.toThrow(/7-day reopen window expired/);

    // Clean up
    await prisma.ticket.delete({ where: { id: expiredTicket.id } });
  });

  it("Direct invalid transition OPEN -> CLOSED is rejected", async () => {
    const ticket = await TicketService.createTicket(
      {
        subject: "Direct Close Test",
        description: "Testing invalid direct close",
        requesterName: "Test Requester",
        requesterEmail: "test@req.com",
      },
      supervisor
    );

    await TicketService.changeStatus(ticket.id, Status.OPEN, supervisor);

    await expect(
      TicketService.changeStatus(ticket.id, Status.CLOSED, supervisor)
    ).rejects.toThrow(/marked as RESOLVED before they can be CLOSED/);

    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
