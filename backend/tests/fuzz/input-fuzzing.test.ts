import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status } from "@prisma/client";
import { prisma } from "@/db/prisma.db";
import { TicketService } from "@/controllers/ticket.controller";
import { ReplyService } from "@/controllers/reply.controller";
import { SessionUser } from "@/models/types.model";

describe("Fuzz Testing: Input Validation, Payloads, Injection & Unicode Edge Cases", () => {
  let supervisor: SessionUser;

  beforeAll(async () => {
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    supervisor = { id: sup!.id, email: sup!.email, name: sup!.name, role: sup!.role };
  });

  const maliciousStrings = [
    // SQL Injection patterns
    "' OR '1'='1",
    "'; DROP TABLE \"Ticket\"; --",
    "UNION SELECT id, passwordHash, email FROM \"User\" --",
    "1; SELECT pg_sleep(1); --",
    // XSS payloads
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert(document.cookie)>",
    "<svg/onload=alert('XSS')>",
    "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/'/+/onmouseover=1/+/[*/[]/+alert(1)//'>",
    // Unicode & Edge characters
    "🔥💥🚀✨🎉👩‍💻👨‍👩‍👧‍👦",
    "مرحبا بالعالم (RTL Arabic)",
    "בדיקת עברית (RTL Hebrew)",
    "Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞A̵̧̮͇̭̲ͫ͆ͪ͐́ͪͥ͑͡Ļ̙͔ͨͬ͜Gͨ̽͏͢ͅO",
    "\\u0000\\u0001\\u001f null control characters",
    "Special symbols: © ® ™ § ¶ † ‡ • … ‰ ′ ″ ⁄ € №",
    "Very long string: " + "A".repeat(10000),
  ];

  it("Safely handles SQL injection, XSS, Unicode, and huge payloads in Ticket Creation & Updates", async () => {
    const createdTicketIds: string[] = [];

    for (const testStr of maliciousStrings) {
      // Create ticket with fuzzed payload
      const ticket = await TicketService.createTicket(
        {
          subject: `Fuzz Subject: ${testStr.slice(0, 100)}`,
          description: `Fuzz Description Body: ${testStr}`,
          requesterName: `Requester: ${testStr.slice(0, 50)}`,
          requesterEmail: "fuzz.test@example.com",
          priority: Priority.MEDIUM,
          category: Category.BUG,
        },
        supervisor
      );

      expect(ticket.id).toBeDefined();
      createdTicketIds.push(ticket.id);

      // Verify the content was stored as raw sanitized data without executing injection
      const fetched = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(fetched?.description).toBe(`Fuzz Description Body: ${testStr}`.trim());

      // Update ticket with fuzzed payload
      const updated = await TicketService.updateTicketDetails(
        ticket.id,
        {
          subject: `Updated Fuzz: ${testStr.slice(0, 80)}`,
          description: `Updated Fuzz Body: ${testStr}`,
        },
        supervisor
      );

      expect(updated.id).toBe(ticket.id);
    }

    // Clean up
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  }, 200000);

  it("Safely handles fuzzed payloads in Agent and Customer replies", async () => {
    const ticket = await TicketService.createTicket(
      {
        subject: "Reply Fuzzing Ticket",
        description: "Testing fuzzed reply bodies",
        requesterName: "Fuzz Requester",
        requesterEmail: "fuzz@req.com",
      },
      supervisor
    );

    for (const payload of maliciousStrings) {
      // Agent reply fuzz
      const agentReply = await ReplyService.addAgentReply(
        ticket.id,
        { body: `Agent Note: ${payload}`, isInternal: true },
        supervisor
      );
      expect(agentReply.body).toBe(`Agent Note: ${payload}`.trim());

      // Customer reply fuzz
      const customerReply = await ReplyService.addCustomerReply(ticket.id, {
        body: `Customer Msg: ${payload}`,
        customerName: `Customer ${payload.slice(0, 20)}`,
      });
      expect(customerReply.body).toBe(`Customer Msg: ${payload}`.trim());
    }

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  }, 200000);

  it("Rejects empty or whitespace-only inputs strictly", async () => {
    const emptyVariants = ["", "   ", "\t\t", "\n\n", "   \r\n   "];

    for (const empty of emptyVariants) {
      await expect(
        TicketService.createTicket(
          {
            subject: empty,
            description: "Valid Description",
            requesterName: "Valid Name",
            requesterEmail: "valid@email.com",
          },
          supervisor
        )
      ).rejects.toThrow();

      await expect(
        TicketService.createTicket(
          {
            subject: "Valid Subject",
            description: empty,
            requesterName: "Valid Name",
            requesterEmail: "valid@email.com",
          },
          supervisor
        )
      ).rejects.toThrow();
    }
  });
});
