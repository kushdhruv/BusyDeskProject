import { PrismaClient, Role, Priority, Category, Status, AuthorType, AuditEventType, SlaAlertType, SlaAlertStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.agentInvitation.deleteMany();
  await prisma.ticketTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.tagGroup.deleteMany();
  await prisma.recommendationFeedback.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
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
    const countThisWeek = 2; // 2 tickets per week = 16 historical tickets (sufficient for 8-week trend)

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

  // 9. Seed Knowledge Base Articles for Semantic Copilot & Deflection
  await prisma.knowledgeArticle.createMany({
    data: [
      {
        title: "Resolving OAuth 2.0 Invalid Grant and Token Refresh Errors",
        slug: "oauth-invalid-grant-troubleshooting",
        category: Category.BUG,
        content: `When encountering 'invalid_grant' during OAuth 2.0 token refresh, perform the following verification checklist:
1. Verify system clock synchronization: Ensure the client server clock is synchronized with NTP (maximum allowed drift is 5 minutes).
2. Check Refresh Token Expiration: Refresh tokens expire automatically after 30 days of inactivity or upon password reset.
3. Validate Redirect URI: The callback URL must match character-for-character with the registered URI in the Developer Portal (including trailing slashes and https).
4. Re-issue Authorization Code: Authorization codes are strictly single-use and expire within 10 minutes.`,
        isPublished: true,
      },
      {
        title: "Billing Reconciliation, Prorated Upgrades and Invoice Adjustments",
        slug: "billing-reconciliation-guide",
        category: Category.BILLING,
        content: `Prorated billing adjustments are calculated mathematically based on remaining seconds in the billing cycle:
1. Mid-cycle upgrades are credited automatically for unused subscription tier days.
2. Invoices are generated on the 1st of each calendar month and charged to the default payment method.
3. If a double-charge is detected due to webhook retries, refund the duplicate transaction in Stripe and apply a billing credit note.`,
        isPublished: true,
      },
      {
        title: "SSO / SAML 2.0 Identity Provider Setup & X.509 Certificate Renewal",
        slug: "sso-saml-setup-guide",
        category: Category.QUESTION,
        content: `To configure enterprise Single Sign-On (SSO) with Okta, Azure AD, or Google Workspace:
1. Download the SAML Metadata XML from your Identity Provider.
2. Paste the Identity Provider Issuer URL and Single Sign-On Service URL into Security Settings.
3. Upload the current X.509 Certificate. When renewing certificates, ensure the new certificate is uploaded at least 24 hours prior to expiration to avoid agent lockouts.`,
        isPublished: true,
      },
      {
        title: "API Rate Limiting (HTTP 429) & Exponential Backoff Implementation",
        slug: "api-rate-limiting-best-practices",
        category: Category.FEATURE,
        content: `BusyDesk enforces a tiered token bucket rate limiter:
- Standard Tier: 100 requests per minute
- Enterprise Tier: 1,000 requests per minute
When receiving HTTP 429 Too Many Requests, inspect the 'Retry-After' response header and implement exponential backoff with randomized jitter (wait = base * 2^attempt + jitter).`,
        isPublished: true,
      },
      {
        title: "Custom CSV Export Scheduling & RFC-4180 Format Guide",
        slug: "csv-export-guide",
        category: Category.FEATURE,
        content: `Bulk exports are streamed directly in RFC-4180 compliant CSV format:
- All fields containing commas, quotes, or newlines are wrapped in double quotes.
- Leading characters ('=', '+', '-', '@') are prepended with an apostrophe to prevent CSV formula injection in spreadsheet software.
- Supervisors can trigger bulk exports from the Ticket Queue by clicking 'Export CSV'.`,
        isPublished: true,
      },
    ],
  });

  // 6. Seed Tag Groups & Tags
  console.log("Seeding tag groups and tags...");
  const platformGroup = await prisma.tagGroup.create({
    data: {
      name: "Platform",
      description: "Client platform or device running the application",
      color: "#8B5CF6",
      isExclusive: false,
      displayOrder: 1,
    },
  });

  const envGroup = await prisma.tagGroup.create({
    data: {
      name: "Environment",
      description: "Deployment environment where issue was encountered",
      color: "#F59E0B",
      isExclusive: true,
      displayOrder: 2,
    },
  });

  const componentGroup = await prisma.tagGroup.create({
    data: {
      name: "Component",
      description: "System architecture subsystem or feature area",
      color: "#3B82F6",
      isExclusive: false,
      displayOrder: 3,
    },
  });

  const impactGroup = await prisma.tagGroup.create({
    data: {
      name: "Impact",
      description: "Blast radius and severity of incident",
      color: "#EF4444",
      isExclusive: true,
      displayOrder: 4,
    },
  });

  const workflowGroup = await prisma.tagGroup.create({
    data: {
      name: "Workflow",
      description: "Operational lifecycle state and triage handling",
      color: "#10B981",
      isExclusive: false,
      displayOrder: 5,
    },
  });

  // Create tags
  const seededTags = [
    // Platform
    { name: "iOS", slug: "ios", color: "#A78BFA", groupId: platformGroup.id },
    { name: "Android", slug: "android", color: "#34D399", groupId: platformGroup.id },
    { name: "Web", slug: "web", color: "#60A5FA", groupId: platformGroup.id },
    { name: "API", slug: "api", color: "#FBBF24", groupId: platformGroup.id },
    // Environment
    { name: "Production", slug: "production", color: "#EF4444", groupId: envGroup.id },
    { name: "Staging", slug: "staging", color: "#F59E0B", groupId: envGroup.id },
    { name: "Development", slug: "development", color: "#10B981", groupId: envGroup.id },
    // Component
    { name: "Authentication", slug: "authentication", color: "#818CF8", groupId: componentGroup.id },
    { name: "Billing", slug: "billing-tag", color: "#34D399", groupId: componentGroup.id },
    { name: "Dashboard", slug: "dashboard", color: "#60A5FA", groupId: componentGroup.id },
    { name: "Notifications", slug: "notifications", color: "#FB923C", groupId: componentGroup.id },
    { name: "Integrations", slug: "integrations", color: "#C084FC", groupId: componentGroup.id },
    // Impact
    { name: "Service Down", slug: "service-down", color: "#DC2626", groupId: impactGroup.id },
    { name: "Degraded", slug: "degraded", color: "#F59E0B", groupId: impactGroup.id },
    { name: "Cosmetic", slug: "cosmetic", color: "#9CA3AF", groupId: impactGroup.id },
    // Workflow
    { name: "Escalated", slug: "escalated", color: "#EF4444", groupId: workflowGroup.id },
    { name: "Needs Deploy", slug: "needs-deploy", color: "#F59E0B", groupId: workflowGroup.id },
    { name: "Customer VIP", slug: "customer-vip", color: "#8B5CF6", groupId: workflowGroup.id },
    { name: "Waiting 3rd Party", slug: "waiting-3rd-party", color: "#6B7280", groupId: workflowGroup.id },
    // Ungrouped
    { name: "security-audit", slug: "security-audit", color: "#EF4444", groupId: null },
    { name: "regression", slug: "regression", color: "#DC2626", groupId: null },
    { name: "documentation", slug: "documentation", color: "#6B7280", groupId: null },
  ];

  const tagMap = new Map<string, any>();
  for (const t of seededTags) {
    const createdTag = await prisma.tag.create({
      data: t,
    });
    tagMap.set(t.name, createdTag);
  }

  // Associate tags to existing tickets
  const allTickets = await prisma.ticket.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const tagUsageCounts = new Map<string, number>();

  for (let idx = 0; idx < allTickets.length; idx++) {
    const t = allTickets[idx];
    const tagsToAssign: any[] = [];

    // Assign based on ticket attributes
    if (idx % 2 === 0) tagsToAssign.push(tagMap.get("Web"));
    if (idx % 3 === 0) tagsToAssign.push(tagMap.get("iOS"));
    if (idx % 5 === 0) tagsToAssign.push(tagMap.get("API"));

    if (t.priority === Priority.URGENT) {
      tagsToAssign.push(tagMap.get("Production"));
      tagsToAssign.push(tagMap.get("Service Down"));
      tagsToAssign.push(tagMap.get("Escalated"));
    } else if (t.priority === Priority.HIGH) {
      tagsToAssign.push(tagMap.get("Degraded"));
      if (idx % 2 === 0) tagsToAssign.push(tagMap.get("Customer VIP"));
    } else {
      tagsToAssign.push(tagMap.get("Cosmetic"));
    }

    if (t.category === Category.BUG) {
      tagsToAssign.push(tagMap.get("regression"));
    } else if (t.category === Category.BILLING) {
      tagsToAssign.push(tagMap.get("Billing"));
    }

    for (const tag of tagsToAssign) {
      if (!tag) continue;
      try {
        await prisma.ticketTag.create({
          data: {
            ticketId: t.id,
            tagId: tag.id,
            addedById: supervisor.id,
          },
        });
        tagUsageCounts.set(tag.id, (tagUsageCounts.get(tag.id) || 0) + 1);

        await prisma.auditLog.create({
          data: {
            ticketId: t.id,
            actorId: supervisor.id,
            actorName: supervisor.name,
            eventType: AuditEventType.TAG_ADDED,
            newValue: { tagId: tag.id, tagName: tag.name },
            metadata: { group: tag.groupId ? "Grouped" : "Ungrouped" },
          },
        });
      } catch (err) {
        // Ignore duplicate composite key if any
      }
    }
  }

  // Update tag usageCounts
  for (const [tagId, count] of tagUsageCounts.entries()) {
    await prisma.tag.update({
      where: { id: tagId },
      data: { usageCount: count },
    });
  }

  // ────────────────────────────────────────────────────────
  // Knowledge Base Articles (for Smart Assist recommendations)
  // ────────────────────────────────────────────────────────
  const kbArticles = [
    {
      title: "How to Reset Your Password",
      slug: "reset-password",
      content: "If you've forgotten your password or need to reset it, follow these steps:\n\n1. Navigate to the login page and click 'Forgot Password'\n2. Enter your registered email address\n3. Check your inbox for the password reset link (also check spam/junk folders)\n4. Click the link within 24 hours and set a new password\n5. Use a strong password with at least 8 characters, including uppercase, lowercase, numbers, and symbols\n\nIf you don't receive the reset email within 5 minutes, contact our support team. For security reasons, we cannot manually change passwords — the reset link is the only method.",
      category: "ACCOUNT" as Category,
    },
    {
      title: "Understanding Your Invoice and Billing Cycle",
      slug: "billing-cycle-invoices",
      content: "Your billing cycle runs on a monthly basis from the date of your first subscription. Here's what you need to know:\n\n• Invoices are generated on the anniversary of your sign-up date\n• Payment is attempted automatically via your saved payment method\n• If payment fails, we retry 3 times over 7 days before suspending the account\n• You can download invoices from Settings → Billing → Invoice History\n• Tax is calculated based on your billing address jurisdiction\n• To update your payment method, go to Settings → Billing → Payment Methods\n\nFor refund requests, contact billing support within 14 days of the charge. Prorated refunds are available for annual plans cancelled mid-term.",
      category: "BILLING" as Category,
    },
    {
      title: "Troubleshooting Slow Dashboard Loading",
      slug: "slow-dashboard-performance",
      content: "If your dashboard is loading slowly, try these troubleshooting steps:\n\n1. Clear your browser cache and cookies (Ctrl+Shift+Delete)\n2. Disable browser extensions temporarily — ad blockers can interfere with API calls\n3. Check your internet connection speed at speedtest.net (minimum 5 Mbps recommended)\n4. Try a different browser (Chrome, Firefox, or Edge recommended)\n5. If using VPN, try disconnecting it temporarily\n6. Check our status page at status.busyinfotech.com for any ongoing incidents\n\nIf the issue persists, open DevTools (F12) → Network tab, reproduce the issue, and share the HAR file with our support team. This helps us identify if specific API calls are timing out.\n\nKnown issue: Dashboards with 10,000+ tickets may take 3-5 seconds on initial load. We recommend using date filters to reduce the dataset.",
      category: "PERFORMANCE" as Category,
    },
    {
      title: "Setting Up Slack and Webhook Integrations",
      slug: "slack-webhook-integration",
      content: "Connect BusyDesk to Slack or custom webhooks to receive real-time ticket notifications:\n\n**Slack Integration:**\n1. Go to Settings → Integrations → Slack\n2. Click 'Connect to Slack' and authorize the BusyDesk app\n3. Select the Slack channel for notifications\n4. Configure which events trigger notifications (new ticket, status change, SLA breach)\n\n**Custom Webhooks:**\n1. Go to Settings → Integrations → Webhooks\n2. Click 'Add Webhook URL'\n3. Enter your endpoint URL (must accept POST requests)\n4. Select events to subscribe to\n5. Use the 'Test' button to verify connectivity\n\nWebhook payloads are sent as JSON with HMAC-SHA256 signature in the X-BusyDesk-Signature header. Retry policy: 3 attempts with exponential backoff (1s, 5s, 30s).\n\nCommon issue: If Slack notifications stop working, re-authorize the app — Slack tokens expire after 90 days of inactivity.",
      category: "INTEGRATION" as Category,
    },
    {
      title: "Two-Factor Authentication (2FA) Setup Guide",
      slug: "2fa-setup-guide",
      content: "Enable Two-Factor Authentication to add an extra layer of security to your account:\n\n**Setup Steps:**\n1. Go to Settings → Security → Two-Factor Authentication\n2. Click 'Enable 2FA'\n3. Scan the QR code with an authenticator app (Google Authenticator, Authy, or 1Password)\n4. Enter the 6-digit code from your authenticator app to verify\n5. Save your backup recovery codes in a secure location\n\n**Important Notes:**\n• Recovery codes are one-time use — each code works only once\n• If you lose access to your authenticator app, use a recovery code to log in\n• Supervisors can enforce 2FA for all team members via Settings → Security → Team Policies\n• If locked out with no recovery codes, contact support with government-issued photo ID for identity verification (takes 24-48 hours)\n\n**Supported authenticator apps:** Google Authenticator, Authy, Microsoft Authenticator, 1Password, Duo Mobile",
      category: "SECURITY" as Category,
    },
    {
      title: "Getting Started: New User Onboarding Guide",
      slug: "new-user-onboarding",
      content: "Welcome to BusyDesk! Here's how to get started:\n\n**Step 1: Complete Your Profile**\nGo to Settings → Profile and add your name, avatar, and contact preferences.\n\n**Step 2: Understand the Dashboard**\n• The left sidebar shows your ticket queue, SLA alerts, and navigation\n• The main area shows your active tickets and key metrics\n• Use filters to sort tickets by status, priority, category, or assignee\n\n**Step 3: Handle Your First Ticket**\n1. Click on any ticket in your queue to open the workspace view\n2. Read the customer's issue and any internal notes from colleagues\n3. Type your response in the Reply composer at the bottom\n4. Use 'Public Reply' for customer-facing responses and 'Internal Note' for team-only comments\n5. Update the ticket status: Open → Pending → Resolved\n\n**Step 4: Collaborate with Your Team**\nAdd collaborators to a ticket for cross-team visibility. Use @mentions in internal notes to notify specific teammates.\n\n**Pro Tips:**\n• Keyboard shortcut: Ctrl+Enter to send a reply\n• Use the Smart Assist panel above the reply composer for AI-suggested solutions from past tickets",
      category: "ONBOARDING" as Category,
    },
    {
      title: "How to Report a Bug or Application Error",
      slug: "report-bug-application-error",
      content: "If you encounter a bug or application error, follow these steps to submit an effective bug report:\n\n**Required Information:**\n1. Steps to reproduce — exact sequence of actions that trigger the bug\n2. Expected behavior — what should have happened\n3. Actual behavior — what actually happened (include error messages)\n4. Browser and OS version (e.g., Chrome 120 on Windows 11)\n5. Screenshots or screen recordings (use Ctrl+Shift+S for browser screenshots)\n\n**How to Submit:**\n• Create a new ticket with Category: Bug and Priority based on impact:\n  - URGENT: System is down, data loss, or security vulnerability\n  - HIGH: Major feature broken, no workaround available\n  - MEDIUM: Feature broken but workaround exists\n  - LOW: Minor visual issue or cosmetic bug\n\n**Common Quick Fixes:**\n• 'Page not loading' — Clear cache, try incognito mode\n• 'Button not responding' — Disable ad-blocker extensions\n• 'Data not saving' — Check for browser autofill conflicts\n• '500 Internal Server Error' — Wait 2 minutes and retry; if persistent, report it",
      category: "BUG" as Category,
    },
    {
      title: "Requesting a New Feature or Product Enhancement",
      slug: "feature-request-guide",
      content: "We love hearing from our users! Here's how to submit a feature request:\n\n**How to Submit:**\n1. Create a new ticket with Category: Feature Request\n2. Set Priority to LOW or MEDIUM (feature requests are triaged by our product team)\n3. Include the following in your description:\n   • What problem does this feature solve?\n   • Who would benefit from this feature? (your role, team size)\n   • Are there any workarounds you currently use?\n   • Any examples from other tools that implement this well?\n\n**What Happens Next:**\n• Our product team reviews feature requests weekly\n• Requests are scored by impact (users affected × frequency) and effort\n• High-impact requests are added to our public roadmap\n• You'll receive a status update within 2 weeks: Planned, Under Review, or Declined (with reasoning)\n\n**Tip:** Vote on existing feature requests in our community forum — higher-voted features get prioritized faster.\n\n**SLA for Feature Requests:** Unlike bugs, feature requests don't have a resolution SLA. However, we guarantee a triage response within 10 business days.",
      category: "FEATURE" as Category,
    },
  ];

  for (const article of kbArticles) {
    await prisma.knowledgeArticle.create({ data: article });
  }

  console.log("Seed finished successfully! 6 users, 35+ tickets, 5 tag groups, 22 tags, and 8 Knowledge Base articles created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
