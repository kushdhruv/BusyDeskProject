import { PrismaClient, Role, Priority, Category, Status, AuthorType, AuditEventType, SlaAlertType, SlaAlertStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.customerSatisfaction.deleteMany();
  await prisma.slaAlert.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reply.deleteMany();
  await prisma.ticketCollaborator.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create Users (Supervisors, Agents, Customers)
  const supervisor = await prisma.user.create({
    data: {
      email: "supervisor@busy.com",
      passwordHash,
      name: "Suresh Menon (Supervisor)",
      role: Role.SUPERVISOR,
    },
  });

  const agentSarah = await prisma.user.create({
    data: {
      email: "sarah@busy.com",
      passwordHash,
      name: "Sarah Jenkins (Senior Agent)",
      role: Role.AGENT,
    },
  });

  const agentAlex = await prisma.user.create({
    data: {
      email: "alex@busy.com",
      passwordHash,
      name: "Alex Rivera (Support Agent)",
      role: Role.AGENT,
    },
  });

  const agentJordan = await prisma.user.create({
    data: {
      email: "jordan@busy.com",
      passwordHash,
      name: "Jordan Lee (Tier 1 Agent)",
      role: Role.AGENT,
    },
  });

  const customerAlice = await prisma.user.create({
    data: {
      email: "alice@customer.com",
      passwordHash,
      name: "Alice Henderson (ACME Corp)",
      role: Role.CUSTOMER,
    },
  });

  const customerBob = await prisma.user.create({
    data: {
      email: "bob@customer.com",
      passwordHash,
      name: "Bob Martinez (Globex Corp)",
      role: Role.CUSTOMER,
    },
  });

  console.log("Users created successfully (Supervisor, Agents, Customers).");

  const now = new Date();

  // Helper for SLA targets in minutes
  const SLA_TARGETS = {
    URGENT: 120, // 2h
    HIGH: 480,   // 8h
    MEDIUM: 1440, // 24h
    LOW: 4320,   // 72h
  };

  // 2. Create Historical Resolved Tickets for 8-Week Trend Chart & CSAT ratings
  console.log("Creating 8-week historical resolution data...");
  for (let w = 1; w <= 8; w++) {
    const daysAgo = w * 7 - 2;
    const resolvedDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const countThisWeek = 3 + (w % 4); // 3-6 tickets per week

    for (let i = 1; i <= countThisWeek; i++) {
      const assignee = i % 2 === 0 ? agentSarah : agentAlex;
      const customer = i % 2 === 0 ? customerAlice : customerBob;
      const createdDate = new Date(resolvedDate.getTime() - 12 * 60 * 60 * 1000);

      const ticket = await prisma.ticket.create({
        data: {
          subject: `Historical resolved ticket - Week -${w} Issue #${i}`,
          description: `Customer experienced an issue ${w} weeks ago and was successfully assisted.`,
          requesterId: customer.id,
          requesterName: customer.name,
          requesterEmail: customer.email,
          priority: i % 2 === 0 ? Priority.HIGH : Priority.MEDIUM,
          category: i % 3 === 0 ? Category.BUG : Category.QUESTION,
          status: Status.RESOLVED,
          createdById: supervisor.id,
          primaryAssigneeId: assignee.id,
          slaTargetMinutes: SLA_TARGETS.MEDIUM,
          slaDueAt: new Date(createdDate.getTime() + SLA_TARGETS.MEDIUM * 60 * 1000),
          slaCycle: 1,
          createdAt: createdDate,
          updatedAt: resolvedDate,
          resolvedAt: resolvedDate,
        },
      });

      await prisma.auditLog.create({
        data: {
          ticketId: ticket.id,
          actorId: supervisor.id,
          actorName: supervisor.name,
          eventType: AuditEventType.TICKET_CREATED,
          newValue: { status: Status.NEW, assigneeId: assignee.id },
          createdAt: createdDate,
        },
      });

      await prisma.auditLog.create({
        data: {
          ticketId: ticket.id,
          actorId: assignee.id,
          actorName: assignee.name,
          eventType: AuditEventType.STATUS_CHANGED,
          oldValue: { status: Status.OPEN },
          newValue: { status: Status.RESOLVED },
          createdAt: resolvedDate,
        },
      });

      // Add CSAT for some resolved tickets
      if (i % 2 === 1) {
        const rating = (i % 3 === 0) ? 4 : 5;
        await prisma.customerSatisfaction.create({
          data: {
            ticketId: ticket.id,
            userId: customer.id,
            rating,
            comment: rating === 5 ? "Excellent support, resolved quickly!" : "Good resolution time, thanks.",
            createdAt: new Date(resolvedDate.getTime() + 30 * 60 * 1000),
          },
        });
      }
    }
  }

  // 3. Create Active & Lifecycle Demonstration Tickets
  console.log("Creating active and edge-case demonstration tickets...");

  // Ticket 1: Urgent SLA Breached (Alice Requester, Sarah Assignee)
  const t1 = await prisma.ticket.create({
    data: {
      subject: "Critical: Production Payment Gateway 500 Errors during checkout",
      description: "Multiple enterprise customers report recurring 500 error when clicking 'Complete Purchase' on the Stripe integration.",
      requesterId: customerAlice.id,
      requesterName: customerAlice.name,
      requesterEmail: customerAlice.email,
      priority: Priority.URGENT,
      category: Category.BUG,
      status: Status.OPEN,
      createdById: supervisor.id,
      primaryAssigneeId: agentSarah.id,
      slaTargetMinutes: SLA_TARGETS.URGENT,
      slaDueAt: new Date(now.getTime() - 45 * 60 * 1000), // Breached 45 mins ago
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 165 * 60 * 1000),
      updatedAt: now,
    },
  });

  await prisma.slaAlert.create({
    data: {
      ticketId: t1.id,
      type: SlaAlertType.BREACHED,
      status: SlaAlertStatus.ACTIVE,
      breachCycle: 1,
      createdAt: new Date(now.getTime() - 45 * 60 * 1000),
    },
  });

  await prisma.reply.create({
    data: {
      ticketId: t1.id,
      authorId: agentSarah.id,
      authorType: AuthorType.AGENT,
      authorName: agentSarah.name,
      authorEmail: agentSarah.email,
      body: "Checking Stripe webhook error logs now. The signature validation seems to be rejecting certain payloads.",
      isInternal: true,
      createdAt: new Date(now.getTime() - 90 * 60 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: t1.id,
      actorId: supervisor.id,
      actorName: supervisor.name,
      eventType: AuditEventType.TICKET_CREATED,
      newValue: { priority: "URGENT", status: "OPEN" },
      createdAt: new Date(now.getTime() - 165 * 60 * 1000),
    },
  });

  // Ticket 2: High Priority - SLA Due Soon (Bob Requester, Alex Assignee, Sarah Collaborator)
  const t2 = await prisma.ticket.create({
    data: {
      subject: "Annual Subscription Invoice mismatch and VAT deduction error",
      description: "Our invoice #INV-2026-904 shows $1,400 instead of agreed contract price of $1,200, and VAT tax number was omitted.",
      requesterId: customerBob.id,
      requesterName: customerBob.name,
      requesterEmail: customerBob.email,
      priority: Priority.HIGH,
      category: Category.BILLING,
      status: Status.OPEN,
      createdById: agentAlex.id,
      primaryAssigneeId: agentAlex.id,
      slaTargetMinutes: SLA_TARGETS.HIGH,
      slaDueAt: new Date(now.getTime() + 35 * 60 * 1000), // Due in 35 mins!
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 445 * 60 * 1000),
      updatedAt: now,
    },
  });

  await prisma.slaAlert.create({
    data: {
      ticketId: t2.id,
      type: SlaAlertType.DUE_SOON,
      status: SlaAlertStatus.ACTIVE,
      breachCycle: 1,
      createdAt: new Date(now.getTime() - 25 * 60 * 1000),
    },
  });

  await prisma.ticketCollaborator.create({
    data: {
      ticketId: t2.id,
      userId: agentSarah.id,
      addedById: agentAlex.id,
    },
  });

  // Ticket 3: PENDING ticket awaiting customer reply (Alice Requester) -> Ready for real Customer Reply!
  const t3 = await prisma.ticket.create({
    data: {
      subject: "Need SAML 2.0 Single Sign-On metadata XML for Okta configuration",
      description: "We are setting up SSO for 250 users on Okta and need your Identity Provider ACS URL and Entity ID.",
      requesterId: customerAlice.id,
      requesterName: customerAlice.name,
      requesterEmail: customerAlice.email,
      priority: Priority.MEDIUM,
      category: Category.FEATURE,
      status: Status.PENDING,
      createdById: agentSarah.id,
      primaryAssigneeId: agentSarah.id,
      slaTargetMinutes: SLA_TARGETS.MEDIUM,
      slaDueAt: null, // Paused!
      slaPausedAt: new Date(now.getTime() - 120 * 60 * 1000),
      slaPausedRemainingSeconds: 18 * 60 * 60, // 18 hours remaining
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 360 * 60 * 1000),
      updatedAt: now,
    },
  });

  await prisma.reply.create({
    data: {
      ticketId: t3.id,
      authorId: agentSarah.id,
      authorType: AuthorType.AGENT,
      authorName: agentSarah.name,
      authorEmail: agentSarah.email,
      body: "Hi Alice, I have generated your tenant SSO endpoints. Could you please send over your Okta metadata XML file so we can complete certificate verification on our end?",
      isInternal: false,
      createdAt: new Date(now.getTime() - 125 * 60 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: t3.id,
      actorId: agentSarah.id,
      actorName: agentSarah.name,
      eventType: AuditEventType.STATUS_CHANGED,
      oldValue: { status: Status.OPEN },
      newValue: { status: Status.PENDING },
      metadata: { reason: "Waiting on customer metadata XML", pausedRemainingSeconds: 18 * 3600 },
      createdAt: new Date(now.getTime() - 120 * 60 * 1000),
    },
  });

  // Ticket 4: Closed Ticket ready for CSAT rating (Alice Requester)
  const t4 = await prisma.ticket.create({
    data: {
      subject: "How do I invite secondary accountants to view quarterly tax reports?",
      description: "We need our outside CPA firm to have read-only access to our ledger export.",
      requesterId: customerAlice.id,
      requesterName: customerAlice.name,
      requesterEmail: customerAlice.email,
      priority: Priority.LOW,
      category: Category.QUESTION,
      status: Status.RESOLVED,
      createdById: agentJordan.id,
      primaryAssigneeId: agentJordan.id,
      slaTargetMinutes: SLA_TARGETS.LOW,
      slaDueAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      slaCycle: 1,
      resolvedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 96 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  // Ticket 5: Closed Ticket PAST 7-Day Reopen Window (Bob Requester)
  const t5 = await prisma.ticket.create({
    data: {
      subject: "Archived payroll run discrepancy from previous fiscal quarter",
      description: "Discrepancy was investigated and closed last month.",
      requesterId: customerBob.id,
      requesterName: customerBob.name,
      requesterEmail: customerBob.email,
      priority: Priority.MEDIUM,
      category: Category.BILLING,
      status: Status.CLOSED,
      createdById: supervisor.id,
      primaryAssigneeId: agentAlex.id,
      slaTargetMinutes: SLA_TARGETS.MEDIUM,
      slaDueAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      slaCycle: 1,
      resolvedAt: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
      closedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
    },
  });

  // Ticket 6: Archived Ticket (Alice Requester)
  const t6 = await prisma.ticket.create({
    data: {
      subject: "Duplicate spam request regarding external SEO services",
      description: "Automated bot submission offering backlink packages. Archived to keep queue clean.",
      requesterId: customerAlice.id,
      requesterName: customerAlice.name,
      requesterEmail: customerAlice.email,
      priority: Priority.LOW,
      category: Category.QUESTION,
      status: Status.RESOLVED,
      createdById: supervisor.id,
      primaryAssigneeId: agentJordan.id,
      slaTargetMinutes: SLA_TARGETS.LOW,
      slaCycle: 1,
      archivedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  // Ticket 7: New Unassigned Ticket (Bob Requester)
  const t7 = await prisma.ticket.create({
    data: {
      subject: "API Rate limit exceeded on webhook dispatch workers",
      description: "Our batch processing pipeline received 429 Too Many Requests when syncing inventory items.",
      requesterId: customerBob.id,
      requesterName: customerBob.name,
      requesterEmail: customerBob.email,
      priority: Priority.HIGH,
      category: Category.BUG,
      status: Status.NEW,
      createdById: supervisor.id,
      primaryAssigneeId: null,
      slaTargetMinutes: SLA_TARGETS.HIGH,
      slaDueAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      updatedAt: now,
    },
  });

  // Ticket 8: Open Ticket assigned to Jordan with Alex collaborating (Bob Requester)
  const t8 = await prisma.ticket.create({
    data: {
      subject: "Request for customized CSV export with custom user metadata tags",
      description: "Customer wants an automated daily scheduled export containing customer tags and order frequencies.",
      requesterId: customerBob.id,
      requesterName: customerBob.name,
      requesterEmail: customerBob.email,
      priority: Priority.MEDIUM,
      category: Category.FEATURE,
      status: Status.OPEN,
      createdById: agentJordan.id,
      primaryAssigneeId: agentJordan.id,
      slaTargetMinutes: SLA_TARGETS.MEDIUM,
      slaDueAt: new Date(now.getTime() + 14 * 60 * 60 * 1000),
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 10 * 60 * 60 * 1000),
      updatedAt: now,
    },
  });

  await prisma.ticketCollaborator.create({
    data: {
      ticketId: t8.id,
      userId: agentAlex.id,
      addedById: agentJordan.id,
    },
  });

  console.log("Seed finished successfully! 6 users (Supervisor, 3 Agents, 2 Customers) and 35+ tickets created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
