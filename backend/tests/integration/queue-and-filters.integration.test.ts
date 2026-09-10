import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status } from "@prisma/client";
import { prisma } from "@/db/prisma.db";
import { TicketController as TicketService } from "@/controllers/ticket.controller";
import { SessionUser } from "@/models/types.model";

describe("Integration Tests: Queue Search, Multi-Filters, Pagination & Archive Rule", () => {
  let supervisor: SessionUser;
  let agent1: SessionUser;

  beforeAll(async () => {
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    const ag1 = await prisma.user.findFirst({ where: { email: "sarah@busy.com" } });
    supervisor = { id: sup!.id, email: sup!.email, name: sup!.name, role: sup!.role };
    agent1 = { id: ag1!.id, email: ag1!.email, name: ag1!.name, role: ag1!.role };
  });

  it("Enforces Archive Rule: Archived tickets are strictly excluded from default queue queries", async () => {
    const ticket = await TicketService.createTicket(
      {
        subject: "Archive Filter Test Ticket",
        description: "Checking that archivedAt IS NULL rule holds strictly",
        requesterName: "Arch Customer",
        requesterEmail: "arch@cust.com",
      },
      supervisor
    );

    // Verify it appears in standard queue
    const queueBefore = await TicketService.getQueue({ search: "Archive Filter Test" }, supervisor);
    expect(queueBefore.tickets.some((t) => t.id === ticket.id)).toBe(true);

    // Archive ticket
    await TicketService.archive(ticket.id, supervisor);

    // Verify it NO LONGER appears in standard queue
    const queueAfter = await TicketService.getQueue({ search: "Archive Filter Test" }, supervisor);
    expect(queueAfter.tickets.some((t) => t.id === ticket.id)).toBe(false);

    // Verify it DOES appear in archived scope
    const archiveQueue = await TicketService.getQueue(
      { scope: "archived", search: "Archive Filter Test" },
      supervisor
    );
    expect(archiveQueue.tickets.some((t) => t.id === ticket.id)).toBe(true);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  it("Performs compound filtering by status, priority, and category", async () => {
    const queue = await TicketService.getQueue(
      {
        status: Status.OPEN,
        priority: Priority.HIGH,
        category: Category.BUG,
      },
      supervisor
    );

    for (const t of queue.tickets) {
      expect(t.status).toBe(Status.OPEN);
      expect(t.priority).toBe(Priority.HIGH);
      expect(t.category).toBe(Category.BUG);
      expect(t.archivedAt).toBeNull();
    }
  });

  it("Handles server-side pagination with accurate total count and pages", async () => {
    const resPage1 = await TicketService.getQueue({ page: 1, limit: 5 }, supervisor);
    expect(resPage1.tickets.length).toBeLessThanOrEqual(5);
    expect(resPage1.pagination.page).toBe(1);
    expect(resPage1.pagination.limit).toBe(5);
    expect(resPage1.pagination.totalCount).toBeGreaterThan(0);
    expect(resPage1.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });
});
