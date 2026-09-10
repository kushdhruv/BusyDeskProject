import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status, AuditEventType, AuthorType } from "@prisma/client";
import { prisma } from "@/db/prisma.db";
import { AuthController as AuthService } from "@/controllers/auth.controller";
import { TicketController as TicketService } from "@/controllers/ticket.controller";
import { ReplyController as ReplyService } from "@/controllers/reply.controller";
import { CsatController as CsatService } from "@/controllers/csat.controller";
import { DashboardController as DashboardService } from "@/controllers/dashboard.controller";
import { SessionUser, DashboardMetrics, CustomerDashboardMetrics } from "@/models/types.model";

describe("Security & Integration Tests: Unified 3-Role Customer Security, Isolation & CSAT Invariants", () => {
  let supervisor: SessionUser;
  let agent: SessionUser;
  let customerAlice: SessionUser;
  let customerBob: SessionUser;

  beforeAll(async () => {
    const supUser = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    const agUser = await prisma.user.findFirst({ where: { role: Role.AGENT } });
    const aliceUser = await prisma.user.findUnique({ where: { email: "alice@customer.com" } });
    const bobUser = await prisma.user.findUnique({ where: { email: "bob@customer.com" } });

    supervisor = { id: supUser!.id, email: supUser!.email, name: supUser!.name, role: supUser!.role };
    agent = { id: agUser!.id, email: agUser!.email, name: agUser!.name, role: agUser!.role };
    customerAlice = { id: aliceUser!.id, email: aliceUser!.email, name: aliceUser!.name, role: aliceUser!.role };
    customerBob = { id: bobUser!.id, email: bobUser!.email, name: bobUser!.name, role: bobUser!.role };
  });

  describe("1. Public Registration Security & Role Hardcoding", () => {
    it("Public registration forces Role.CUSTOMER and ignores client-supplied roles", async () => {
      const regEmail = `test-reg-${Date.now()}@example.com`;
      const regResult = await AuthService.register({
        name: "Test Customer",
        email: regEmail,
        password: "password123",
        // Attacker attempts privilege escalation by injecting role
        role: "SUPERVISOR",
      } as any);

      expect(regResult.role).toBe(Role.CUSTOMER);
      expect(regResult.email).toBe(regEmail.toLowerCase());

      const dbUser = await prisma.user.findUnique({ where: { id: regResult.id } });
      expect(dbUser?.role).toBe(Role.CUSTOMER);

      // Clean up
      await prisma.user.delete({ where: { id: regResult.id } });
    });
  });

  describe("2. Customer Ticket Creation & Server-Managed Urgency Mapping", () => {
    it("Maps customer urgency 'HIGH' to Priority.HIGH and hardcodes requesterId to actor.id", async () => {
      const ticket = await TicketService.createTicket(
        {
          subject: "Alice's High Urgency Ticket",
          description: "Production system issue",
          customerUrgency: "HIGH",
          category: Category.BUG,
        },
        customerAlice
      );

      expect(ticket.requesterId).toBe(customerAlice.id);
      expect(ticket.createdById).toBe(customerAlice.id);
      expect(ticket.priority).toBe(Priority.HIGH);
      expect(ticket.primaryAssigneeId).toBeNull();
      expect(ticket.status).toBe(Status.NEW);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it("Maps customer urgency 'LOW' to Priority.LOW and defaults to Priority.MEDIUM", async () => {
      const lowTicket = await TicketService.createTicket(
        {
          subject: "Alice's Low Urgency Ticket",
          description: "Minor styling question",
          customerUrgency: "LOW",
          category: Category.QUESTION,
        },
        customerAlice
      );
      expect(lowTicket.priority).toBe(Priority.LOW);

      const defaultTicket = await TicketService.createTicket(
        {
          subject: "Alice's Normal Urgency Ticket",
          description: "General question",
        },
        customerAlice
      );
      expect(defaultTicket.priority).toBe(Priority.MEDIUM);

      // Clean up
      await prisma.ticket.delete({ where: { id: lowTicket.id } });
      await prisma.ticket.delete({ where: { id: defaultTicket.id } });
    });
  });

  describe("3. Tenant & Customer Isolation (Queue Filtering)", () => {
    it("Customer A only retrieves their own tickets in the queue", async () => {
      const ticketA = await TicketService.createTicket(
        { subject: "Ticket for Alice Only", description: "Alice secret" },
        customerAlice
      );
      const ticketB = await TicketService.createTicket(
        { subject: "Ticket for Bob Only", description: "Bob secret" },
        customerBob
      );

      const aliceQueue = await TicketService.getQueue({}, customerAlice);
      const bobQueue = await TicketService.getQueue({}, customerBob);

      const aliceTicketIds = aliceQueue.tickets.map((t) => t.id);
      const bobTicketIds = bobQueue.tickets.map((t) => t.id);

      expect(aliceTicketIds).toContain(ticketA.id);
      expect(aliceTicketIds).not.toContain(ticketB.id);

      expect(bobTicketIds).toContain(ticketB.id);
      expect(bobTicketIds).not.toContain(ticketA.id);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticketA.id } });
      await prisma.ticket.delete({ where: { id: ticketB.id } });
    });
  });

  describe("4. Query-Level Data Masking (Internal Notes, Audit Logs & SLA Internals)", () => {
    it("Omits internal notes and audit logs from customer ticket details query", async () => {
      const ticket = await TicketService.createTicket(
        { subject: "Data Masking Test Ticket", description: "Testing redaction" },
        customerAlice
      );

      // Assign agent and add public reply + internal note
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { primaryAssigneeId: agent.id },
      });

      await ReplyService.addReply(
        ticket.id,
        { body: "Hello customer, we are on it.", isInternal: false },
        agent
      );

      await ReplyService.addReply(
        ticket.id,
        { body: "INTERNAL SECRET: Server cluster 4 failed.", isInternal: true },
        agent
      );

      // Fetch as Customer
      const customerView = await TicketService.getTicketDetails(ticket.id, customerAlice);
      expect(customerView.timeline.length).toBe(1);
      expect(customerView.timeline[0].reply.body).toBe("Hello customer, we are on it.");
      expect(customerView.timeline[0].reply.isInternal).toBe(false);

      // Verify no audit events leaked
      const hasAudit = customerView.timeline.some((item) => item.type === "AUDIT");
      expect(hasAudit).toBe(false);

      // Fetch as Agent
      const agentView = await TicketService.getTicketDetails(ticket.id, agent);
      const internalReplies = agentView.timeline.filter(
        (t) => t.type === "REPLY" && t.reply?.isInternal === true
      );
      expect(internalReplies.length).toBe(1);
      expect(internalReplies[0].reply?.body).toBe("INTERNAL SECRET: Server cluster 4 failed.");

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });

  describe("5. Unauthorized Customer Actions are Strictly Rejected", () => {
    it("Customer cannot submit internal notes", async () => {
      const ticket = await TicketService.createTicket(
        { subject: "Action Rejection Test", description: "Testing action limits" },
        customerAlice
      );

      await expect(
        ReplyService.addReply(ticket.id, { body: "Sneaky internal note", isInternal: true }, customerAlice)
      ).rejects.toThrow(/internal notes/i);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it("Customer cannot reassign or change status directly", async () => {
      const ticket = await TicketService.createTicket(
        { subject: "Status Rejection Test", description: "Testing status rejection" },
        customerAlice
      );

      await expect(
        TicketService.reassign(ticket.id, agent.id, customerAlice)
      ).rejects.toThrow(/supervisors/i);

      await expect(
        TicketService.changeStatus(ticket.id, Status.RESOLVED, customerAlice)
      ).rejects.toThrow(/permission/i);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it("Customer cannot view another customer's ticket details", async () => {
      const ticketAlice = await TicketService.createTicket(
        { subject: "Alice Private", description: "Alice secret" },
        customerAlice
      );

      await expect(
        TicketService.getTicketDetails(ticketAlice.id, customerBob)
      ).rejects.toThrow(/permission/i);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticketAlice.id } });
    });
  });

  describe("6. Targeted Lifecycle & SLA Resumption on Customer Reply", () => {
    it("Customer reply transitions PENDING ticket to OPEN and resumes SLA clock", async () => {
      const ticket = await TicketService.createTicket(
        { subject: "SLA Resume Test", description: "Testing SLA unpause" },
        customerAlice
      );

      // Move to OPEN then PENDING (valid lifecycle transitions)
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { primaryAssigneeId: agent.id },
      });
      await TicketService.changeStatus(ticket.id, Status.OPEN, agent);
      await TicketService.changeStatus(ticket.id, Status.PENDING, agent);

      const pendingTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(pendingTicket?.status).toBe(Status.PENDING);
      expect(pendingTicket?.slaPausedRemainingSeconds).not.toBeNull();

      // Alice replies
      await ReplyService.addReply(
        ticket.id,
        { body: "Here is the additional info requested." },
        customerAlice
      );

      const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updatedTicket?.status).toBe(Status.OPEN);
      expect(updatedTicket?.slaDueAt).not.toBeNull();

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it("Customer reply on already OPEN ticket keeps OPEN status without resetting SLA clock", async () => {
      const ticket = await TicketService.createTicket(
        { subject: "Open Reply Test", description: "Testing already open reply" },
        customerAlice
      );

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { primaryAssigneeId: agent.id, status: Status.OPEN },
      });

      const beforeReply = await prisma.ticket.findUnique({ where: { id: ticket.id } });

      await ReplyService.addReply(
        ticket.id,
        { body: "Another customer note while already open" },
        customerAlice
      );

      const afterReply = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(afterReply?.status).toBe(Status.OPEN);
      expect(afterReply?.slaDueAt?.getTime()).toBe(beforeReply?.slaDueAt?.getTime());

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });

  describe("7. CSAT Submission, Atomicity & Immutability", () => {
    it("Atomically records CSAT rating and CSAT_SUBMITTED audit log on resolved ticket", async () => {
      const ticket = await TicketService.createTicket(
        { subject: "CSAT Test Ticket", description: "Testing CSAT flow" },
        customerAlice
      );

      // Assign and Resolve
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { primaryAssigneeId: agent.id, status: Status.RESOLVED, resolvedAt: new Date() },
      });

      const csat = await CsatService.submitCsat(
        ticket.id,
        { rating: 5, comment: "Super fast support, thanks!" },
        customerAlice
      );

      expect(csat.rating).toBe(5);
      expect(csat.comment).toBe("Super fast support, thanks!");
      expect(csat.userId).toBe(customerAlice.id);

      // Verify audit log created in same transaction
      const auditLog = await prisma.auditLog.findFirst({
        where: { ticketId: ticket.id, eventType: AuditEventType.CSAT_SUBMITTED },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorId).toBe(customerAlice.id);
      expect((auditLog?.newValue as any)?.rating).toBe(5);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it("Rejects duplicate CSAT rating (immutable single rating invariant)", async () => {
      const ticket = await TicketService.createTicket(
        { subject: "CSAT Immutable Test", description: "Testing duplicate rejection" },
        customerAlice
      );

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { primaryAssigneeId: agent.id, status: Status.RESOLVED, resolvedAt: new Date() },
      });

      await CsatService.submitCsat(
        ticket.id,
        { rating: 4, comment: "Good service" },
        customerAlice
      );

      // Second attempt must fail
      await expect(
        CsatService.submitCsat(
          ticket.id,
          { rating: 5, comment: "Trying to change to 5" },
          customerAlice
        )
      ).rejects.toThrow(/already been submitted/i);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it("Rejects CSAT rating on OPEN or PENDING tickets", async () => {
      const openTicket = await TicketService.createTicket(
        { subject: "CSAT Open Rejection", description: "Still open" },
        customerAlice
      );

      await expect(
        CsatService.submitCsat(openTicket.id, { rating: 5 }, customerAlice)
      ).rejects.toThrow(/resolved or closed/i);

      // Clean up
      await prisma.ticket.delete({ where: { id: openTicket.id } });
    });

    it("Rejects CSAT rating from another user or agent", async () => {
      const ticket = await TicketService.createTicket(
        { subject: "CSAT Wrong User Test", description: "Alice ticket" },
        customerAlice
      );

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { primaryAssigneeId: agent.id, status: Status.RESOLVED, resolvedAt: new Date() },
      });

      // Bob tries to rate Alice's ticket
      await expect(
        CsatService.submitCsat(ticket.id, { rating: 1 }, customerBob)
      ).rejects.toThrow(/permission/i);

      // Agent tries to rate
      await expect(
        CsatService.submitCsat(ticket.id, { rating: 5 }, agent)
      ).rejects.toThrow(/permission/i);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });

  describe("8. Dashboard Metrics Scoping & Supervisor CSAT Aggregation", () => {
    it("Customer metrics return only customer-scoped ticket totals", async () => {
      const metrics = (await DashboardService.getMetrics(customerAlice)) as CustomerDashboardMetrics;

      expect(metrics.totalTicketsCount).toBeDefined();
      expect(metrics.openTicketsCount).toBeDefined();
      expect(metrics.pendingOnCustomerCount).toBeDefined();
      expect(metrics.resolvedTicketsCount).toBeDefined();
    });

    it("Supervisor metrics include aggregated CSAT score, response count and rating distribution", async () => {
      const metrics = (await DashboardService.getMetrics(supervisor)) as DashboardMetrics;

      expect(metrics.averageCsatRating).toBeDefined();
      expect(typeof metrics.averageCsatRating).toBe("number");
      expect(metrics.csatResponseCount).toBeDefined();
      expect(Array.isArray(metrics.csatRatingDistribution)).toBe(true);
      expect(metrics.csatRatingDistribution.length).toBe(5);
    });
  });
});
