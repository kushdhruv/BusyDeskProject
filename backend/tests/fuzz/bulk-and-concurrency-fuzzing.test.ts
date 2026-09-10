import { describe, it, expect, beforeAll } from "vitest";
import { Role, Status } from "@prisma/client";
import { prisma } from "@/db/prisma.db";
import { TicketService } from "@/controllers/ticket.controller";
import { BulkService } from "@/controllers/bulk.controller";
import { ReplyService } from "@/controllers/reply.controller";
import { SessionUser } from "@/models/types.model";

describe("Fuzz Testing: Bulk Chaos Arrays & High Concurrency Race Conditions", () => {
  let supervisor: SessionUser;
  let agent1: SessionUser;

  beforeAll(async () => {
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    const ag1 = await prisma.user.findFirst({ where: { email: "sarah@busy.com" } });
    supervisor = { id: sup!.id, email: sup!.email, name: sup!.name, role: sup!.role };
    agent1 = { id: ag1!.id, email: ag1!.email, name: ag1!.name, role: ag1!.role };
  });

  it("Fuzzes Bulk Action with chaotic array inputs (empty, duplicate IDs, non-existent UUIDs, corrupt strings)", async () => {
    // 1. Create a valid ticket
    const validTicket = await TicketService.createTicket(
      {
        subject: "Bulk Chaos Test Ticket",
        description: "Testing chaos array handling",
        requesterName: "Chaos Cust",
        requesterEmail: "chaos@test.com",
      },
      supervisor
    );

    // Prepare a chaotic batch of 50 IDs: valid, duplicate, non-existent, invalid strings
    const chaoticIds: string[] = [
      validTicket.id,
      validTicket.id, // duplicate
      "random-guid-00000000-0000-0000-0000-000000000001",
      "random-guid-00000000-0000-0000-0000-000000000002",
      "",
      "invalid-string-id-!!!",
      validTicket.id, // duplicate again
    ];

    const result = await BulkService.executeBulkAction(
      chaoticIds,
      "REASSIGN",
      { targetAssigneeId: agent1.id },
      supervisor
    );

    expect(result.totalRequested).toBe(chaoticIds.length);
    expect(result.results.length).toBe(chaoticIds.length);
    // At least the first valid attempt succeeded
    expect(result.succeededCount).toBeGreaterThanOrEqual(1);

    // Clean up
    await prisma.ticket.delete({ where: { id: validTicket.id } });
  });

  it("Concurrency Stress Test: Simultaneous parallel replies on the same ticket maintain ACID consistency", async () => {
    const ticket = await TicketService.createTicket(
      {
        subject: "Concurrency Stress Ticket",
        description: "Testing 10 simultaneous replies and state changes",
        requesterName: "Concurrent Customer",
        requesterEmail: "concurrent@cust.com",
      },
      supervisor
    );

    // Launch 10 simultaneous asynchronous replies
    const replyPromises = Array.from({ length: 10 }).map((_, i) => {
      if (i % 2 === 0) {
        return ReplyService.addAgentReply(
          ticket.id,
          { body: `Concurrent Agent Note #${i}`, isInternal: true },
          supervisor
        );
      } else {
        return ReplyService.addCustomerReply(ticket.id, {
          body: `Concurrent Customer Message #${i}`,
        });
      }
    });

    const results = await Promise.allSettled(replyPromises);

    // Verify all 10 completed without unhandled crash or deadlock
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(10);

    // Check that database has exactly 10 replies for this ticket
    const count = await prisma.reply.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(10);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
