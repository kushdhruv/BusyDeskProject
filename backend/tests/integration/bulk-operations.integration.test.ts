import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status } from "@prisma/client";
import { prisma } from "@/db/prisma.db";
import { TicketController as TicketService } from "@/controllers/ticket.controller";
import { BulkController as BulkService } from "@/controllers/bulk.controller";
import { SessionUser } from "@/models/types.model";

describe("Integration Tests: Bulk Actions, Partial Success & Isolated Transactions", () => {
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

  it("Executes Bulk Close with partial success (valid resolved tickets succeed; invalid open ticket fails)", async () => {
    // 1. Create two tickets: one resolved, one open
    const ticket1 = await TicketService.createTicket(
      {
        subject: "Bulk Test Ticket 1 (Resolved)",
        description: "Ready for close",
        requesterName: "Customer A",
        requesterEmail: "a@cust.com",
      },
      supervisor
    );
    await TicketService.changeStatus(ticket1.id, Status.OPEN, supervisor);
    await TicketService.changeStatus(ticket1.id, Status.RESOLVED, supervisor);

    const ticket2 = await TicketService.createTicket(
      {
        subject: "Bulk Test Ticket 2 (Open)",
        description: "Not resolved yet",
        requesterName: "Customer B",
        requesterEmail: "b@cust.com",
      },
      supervisor
    );
    await TicketService.changeStatus(ticket2.id, Status.OPEN, supervisor);

    const nonExistentId = "non-existent-ticket-id-999";

    // 2. Perform bulk close on [ticket1.id, ticket2.id, nonExistentId]
    const result = await BulkService.executeBulkAction(
      [ticket1.id, ticket2.id, nonExistentId],
      "CLOSE",
      {},
      supervisor
    );

    expect(result.totalRequested).toBe(3);
    expect(result.succeededCount).toBe(1); // ticket1 succeeded
    expect(result.failedCount).toBe(2); // ticket2 and nonExistent failed

    // Verify ticket1 status in DB is actually CLOSED
    const updated1 = await prisma.ticket.findUnique({ where: { id: ticket1.id } });
    expect(updated1?.status).toBe(Status.CLOSED);

    // Verify ticket2 status remained OPEN (not rolled back or corrupted)
    const updated2 = await prisma.ticket.findUnique({ where: { id: ticket2.id } });
    expect(updated2?.status).toBe(Status.OPEN);

    // Clean up
    await prisma.ticket.deleteMany({ where: { id: { in: [ticket1.id, ticket2.id] } } });
  }, 60000);

  it("Executes Bulk Reassign with per-ticket transaction isolation", async () => {
    const t1 = await TicketService.createTicket(
      {
        subject: "Bulk Reassign 1",
        description: "Reassign to Agent 2",
        requesterName: "Cust 1",
        requesterEmail: "c1@test.com",
        primaryAssigneeId: agent1.id,
      },
      supervisor
    );

    const t2 = await TicketService.createTicket(
      {
        subject: "Bulk Reassign 2",
        description: "Already assigned to Agent 2",
        requesterName: "Cust 2",
        requesterEmail: "c2@test.com",
        primaryAssigneeId: agent2.id,
      },
      supervisor
    );

    const result = await BulkService.executeBulkAction(
      [t1.id, t2.id],
      "REASSIGN",
      { targetAssigneeId: agent2.id },
      supervisor
    );

    expect(result.succeededCount).toBe(1);
    expect(result.failedCount).toBe(1); // t2 failed because already assigned to agent2

    // Clean up
    await prisma.ticket.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
  });

  it("Blocks Agent from executing bulk actions", async () => {
    const t = await TicketService.createTicket(
      {
        subject: "Agent Bulk Attempt",
        description: "Agent cannot do this",
        requesterName: "Cust",
        requesterEmail: "c@test.com",
      },
      supervisor
    );

    const result = await BulkService.executeBulkAction(
      [t.id],
      "REASSIGN",
      { targetAssigneeId: agent2.id },
      agent1 // Agent actor
    );

    expect(result.succeededCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.results[0].reason).toContain("Only Supervisors");

    await prisma.ticket.delete({ where: { id: t.id } });
  });
});
