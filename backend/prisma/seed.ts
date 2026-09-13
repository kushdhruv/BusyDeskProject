import {
  PrismaClient,
  Role,
  Priority,
  Category,
  Status,
  AuthorType,
  AuditEventType,
  SlaAlertType,
  SlaAlertStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database as Senior Database Analyst & AI Systems Architect...");

  // Clean existing data in reverse foreign-key order
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

  // ────────────────────────────────────────────────────────
  // 1. Create Users: Supervisor, Specialized Agents & Customers
  // ────────────────────────────────────────────────────────
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
      name: "Sarah Jenkins (Senior Incident & Security Lead)",
      role: Role.AGENT,
    },
  });

  const agentAlex = await prisma.user.create({
    data: {
      email: "alex@busy.com",
      passwordHash,
      name: "Alex Rivera (Integrations & API Specialist)",
      role: Role.AGENT,
    },
  });

  const agentJordan = await prisma.user.create({
    data: {
      email: "jordan@busy.com",
      passwordHash,
      name: "Jordan Lee (Billing & Account Operations)",
      role: Role.AGENT,
    },
  });

  const agentPriya = await prisma.user.create({
    data: {
      email: "priya@busy.com",
      passwordHash,
      name: "Priya Sharma (Database & Performance Engineer)",
      role: Role.AGENT,
    },
  });

  const agentMarcus = await prisma.user.create({
    data: {
      email: "marcus@busy.com",
      passwordHash,
      name: "Marcus Vance (Onboarding & Customer Success)",
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

  const customerCarol = await prisma.user.create({
    data: {
      email: "carol@startup.io",
      passwordHash,
      name: "Carol Danvers (Apex Technologies)",
      role: Role.CUSTOMER,
    },
  });

  const customerDavid = await prisma.user.create({
    data: {
      email: "david@fintech.co",
      passwordHash,
      name: "David Chen (FinTech Global)",
      role: Role.CUSTOMER,
    },
  });

  console.log("Users created: 1 Supervisor, 5 Specialized Agents, 4 Customers.");

  const now = new Date();

  // Standard SLA targets in minutes
  const SLA_TARGETS = {
    URGENT: 120,  // 2h
    HIGH: 480,    // 8h
    MEDIUM: 1440, // 24h
    LOW: 4320,    // 72h
  };

  // ────────────────────────────────────────────────────────
  // 2. Knowledge Base Articles (10 Articles - 1 per Category)
  // Provides rich context for semantic knowledge retrieval
  // ────────────────────────────────────────────────────────
  const kbArticlesData = [
    {
      title: "How to Reset Your Password, Unlock Suspended Accounts & Recover Access",
      slug: "reset-password-unlock-account",
      content: `If you have forgotten your password or are locked out of your account, follow this procedure:

1. Self-Service Password Reset:
   • Navigate to the login page and click "Forgot Password".
   • Enter your registered work email address.
   • A password reset token will be dispatched within 60 seconds (valid for 24 hours).
   • Check your spam or corporate quarantine folder if not received promptly.

2. Account Lockout Protection:
   • Accounts are temporarily locked after 5 consecutive failed login attempts to protect against brute-force attacks.
   • Account lockouts automatically clear after 30 minutes.
   • For immediate emergency unlocking, your team's designated Workspace Supervisor can clear the lock flag from Settings → Team Members.

3. Password Complexity Requirements:
   • Minimum 8 characters length.
   • At least one uppercase letter, one lowercase letter, one number, and one special symbol.
   • Passwords cannot match your previous 3 historical passwords.`,
      category: Category.ACCOUNT,
      isPublished: true,
    },
    {
      title: "Understanding Invoices, Mid-Cycle Prorated Charges, VAT & Refund Policy",
      slug: "billing-invoices-vat-proration",
      content: `Comprehensive guide to billing cycles, prorations, and tax compliance:

1. Invoice Generation & Billing Cycles:
   • Invoices generate automatically on your monthly or annual subscription renewal anniversary date.
   • Invoices in PDF format with line-item breakdowns are available in Settings → Billing → Invoices.
   • Automatic credit card charges are processed via Stripe with 3 retry attempts over 7 calendar days before any grace period suspension.

2. Prorated Charges & Seat Adjustments:
   • Adding user seats mid-billing cycle generates a prorated invoice for the remainder of the active period.
   • Downgrading seats applies an immediate prorated credit balance towards your next renewal cycle.

3. EU VAT & International Tax Deductions:
   • To apply VAT exemption or reverse-charge mechanisms, enter your valid VIES VAT ID under Billing Settings.
   • If an invoice was issued without your VAT number, submit a ticket within 30 days and our finance team will issue a corrected credit note.

4. Refund Policy:
   • Full refunds are available within 14 calendar days of initial plan purchase. Mid-cycle cancellations receive prorated account credits.`,
      category: Category.BILLING,
      isPublished: true,
    },
    {
      title: "Troubleshooting Application 500 Errors, Unhandled Exceptions & Submitting Bug Reports",
      slug: "troubleshoot-500-errors-bugs",
      content: `Steps to isolate, diagnose, and report critical application bugs:

1. Immediate Triage for HTTP 500 Internal Server Errors:
   • HTTP 500 responses indicate an unhandled server-side exception or downstream microservice failure.
   • For payment gateway 500 errors during checkout: Verify that your Stripe webhook signing secret matches your environment variable and that raw request bodies are passed without JSON parse alteration.
   • Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R) to bypass stale service worker caches.

2. Capturing Reproduction Diagnostics:
   • Open Chrome DevTools (F12) → Network tab.
   • Reproduce the failing action and export the network trace as a .HAR file.
   • Note the Request ID returned in the error modal or the 'x-request-id' response header.

3. Submitting High-Priority Bug Reports:
   • When creating a bug ticket, provide: (1) Exact URL, (2) User account email, (3) Expected vs actual behavior, (4) Reproduction steps, (5) Console errors or HAR files.
   • Urgent priority is reserved for system-wide outages, data loss risks, or complete transaction blocking.`,
      category: Category.BUG,
      isPublished: true,
    },
    {
      title: "Submitting Product Feature Requests, Roadmap Voting & Workflow Enhancements",
      slug: "feature-requests-roadmap-guide",
      content: `How product enhancement requests are reviewed and prioritized:

1. Submitting a Feature Request:
   • Categorize your ticket as "Feature Request" with priority LOW or MEDIUM.
   • Detail the specific business use-case: What workflow does this unblock? How many team members are affected?
   • Include mockups, UI screenshots, or examples of how alternative platforms solve the problem.

2. Product Evaluation Criteria (RICE Framework):
   • Reach: Number of customer organizations impacted.
   • Impact: Depth of user productivity gain (Massive, High, Medium, Low).
   • Confidence: Technical feasibility and architectural alignment.
   • Effort: Engineering sprint weeks required.

3. Status Updates & Releases:
   • Requests are reviewed weekly by Product Management. You will receive an initial triage assessment within 10 business days.
   • Accepted features are published to our interactive public roadmap where customers can subscribe to release notifications.`,
      category: Category.FEATURE,
      isPublished: true,
    },
    {
      title: "Configuring Webhooks, Stripe Connect, Slack Notifications & HMAC Signatures",
      slug: "webhooks-stripe-slack-integration",
      content: `Setup instructions and best practices for third-party developer integrations:

1. Webhook Configuration & Signature Verification:
   • Register your HTTPS endpoint under Settings → Integrations → Webhooks.
   • All webhook payloads include an 'X-BusyDesk-Signature' header containing an HMAC-SHA256 hash computed with your webhook secret.
   • Always verify signatures prior to processing payloads to prevent replay and spoofing attacks.

2. Handling Webhook Rate Limits (HTTP 429) & Retries:
   • Our webhook delivery system enforces an exponential backoff retry policy (1s, 5s, 30s, 5m, 1h) up to 5 total attempts.
   • If your consumer server responds with HTTP 429 (Too Many Requests), ensure your endpoint returns a 'Retry-After' header.
   • Ensure worker endpoints perform asynchronous queueing and return HTTP 200/202 within 3 seconds.

3. Slack App Re-Authentication:
   • If Slack notifications fail to deliver, navigate to Integrations → Slack and click 'Re-Authorize Workspace'. OAuth tokens expire if inactive for 90 days.`,
      category: Category.INTEGRATION,
      isPublished: true,
    },
    {
      title: "Diagnosing Slow Dashboard Loading, Database Query Latency & Network Timeouts",
      slug: "performance-slow-dashboard-latency",
      content: `Troubleshooting guide for slow queue loading, latency spikes, and query timeouts:

1. Common Causes of Dashboard Latency:
   • Large Ticket Queues: Workspaces with >10,000 tickets experience degraded loading if querying without date or status filters.
   • Missing Database Indexes: Unindexed joins across ticket tags, collaborators, or audit logs cause sequential table scans.
   • Browser Extension Overhead: Ad-blockers or DOM-inspecting extensions can delay rendering by 500ms–2000ms.

2. Diagnostic Steps:
   • Check the live status page at status.busyinfotech.com for any reported database replication lag or infrastructure maintenance.
   • Apply date range filters (e.g. "Past 30 Days") to reduce client-side payload sizes.
   • In your browser, test loading in an Incognito window with extensions disabled.

3. Resolution Recommendations for Engineering Teams:
   • Ensure composite indexes exist on (status, priority, createdAt) and (requesterId, createdAt).
   • Paginate queue queries with keyset/cursor pagination rather than high-offset LIMIT queries.`,
      category: Category.PERFORMANCE,
      isPublished: true,
    },
    {
      title: "Configuring SAML 2.0 Single Sign-On (SSO) with Okta/Azure AD & 2FA Setup",
      slug: "saml-sso-okta-azure-2fa",
      content: `Enterprise security configuration for Identity Providers and Two-Factor Authentication:

1. SAML 2.0 Identity Provider Setup:
   • Supported IdPs: Okta, Microsoft Entra ID (Azure AD), Google Workspace, PingIdentity, OneLogin.
   • ACS URL (Assertion Consumer Service): https://app.busydesk.com/api/auth/saml/callback
   • Entity ID / Audience URI: https://app.busydesk.com/saml/metadata
   • NameID Format: EmailAddress (urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress)
   • Download your IdP Metadata XML file and upload it under Settings → Security → SAML SSO.

2. Enforcing Two-Factor Authentication (2FA):
   • Supervisors can enforce mandatory 2FA workspace-wide via Settings → Security → Policies.
   • Supported TOTP authenticators: Google Authenticator, 1Password, Authy, Microsoft Authenticator.
   • During setup, users are provided five 16-character single-use emergency backup recovery codes.

3. Emergency 2FA Account Recovery:
   • If a user loses their authenticator device and has exhausted recovery codes, identity verification via corporate domain email and supervisor authorization is required.`,
      category: Category.SECURITY,
      isPublished: true,
    },
    {
      title: "New Workspace Quickstart: Agent Invitations, Roles & Queue Workflows",
      slug: "workspace-onboarding-agent-invitations",
      content: `Best practices for setting up your team and establishing triage operations:

1. Inviting Support Agents:
   • Supervisors can invite agents via Settings → Team Members → "Invite Agent".
   • An automated invitation email containing a secure 7-day registration token is dispatched to the agent.
   • If the agent does not receive the email, supervisors can copy the invitation link directly from the invitation table.

2. Understanding Role Permissions:
   • SUPERVISOR: Full access to team member management, SLA policies, tag management, analytics, and all queues.
   • AGENT: Access to assign tickets, reply publicly, post internal notes, set collaborators, and view CSAT metrics.
   • CUSTOMER: Limited to submitting tickets, replying to own tickets, and completing CSAT rating surveys.

3. Efficient Triage Workflows:
   • Triage unassigned tickets in the "Unassigned" queue within the first 15 minutes.
   • Use internal notes with @mentions for team collaboration without notifying the customer.
   • Use keyboard shortcut Ctrl+Enter to submit replies rapidly.`,
      category: Category.ONBOARDING,
      isPublished: true,
    },
    {
      title: "Platform API Rate Limits, Fair Usage Quotas & Concurrency Limits",
      slug: "api-rate-limits-quotas-faq",
      content: `Technical specifications on API rate limits and concurrency controls:

1. Standard Rate Limit Tiers:
   • Free / Starter Tier: 60 requests per minute per IP.
   • Professional Tier: 300 requests per minute per API key.
   • Enterprise Tier: 1,200 requests per minute with burst capacity up to 50 concurrent connections.

2. Response Headers for Rate Limit Tracking:
   • 'X-RateLimit-Limit': Maximum requests permitted in the current 60-second window.
   • 'X-RateLimit-Remaining': Number of requests remaining in the active window.
   • 'X-RateLimit-Reset': UTC epoch timestamp indicating when the quota resets.

3. Mitigating HTTP 429 Responses:
   • Implement client-side token bucket or leaky bucket rate limiters.
   • Use bulk API endpoints (e.g. /api/tickets/bulk) rather than single-ticket sequential POST calls.`,
      category: Category.QUESTION,
      isPublished: true,
    },
    {
      title: "GDPR Data Portability, Complete Account Deletion & Audit Trail Retention",
      slug: "gdpr-compliance-data-export-retention",
      content: `Compliance procedures for data exports, privacy regulations, and audit archives:

1. Requesting a Complete Ticket Data Export:
   • Account Administrators can request a full workspace export via Settings → Compliance → Data Export.
   • Exports are generated asynchronously as standard RFC-4180 CSV files containing ticket metadata, replies, and timestamps.
   • A signed secure download URL valid for 24 hours is generated once the export completes.

2. GDPR "Right to be Forgotten" & Erasure:
   • Upon receiving an official GDPR erasure request, submit an "OTHER / Privacy" ticket.
   • Customer personal data (name, email, avatar, IP logs) is permanently anonymized within 30 days while preserving anonymized numerical metrics for regulatory reporting.

3. Audit Trail Retention Policy:
   • System audit logs (status changes, assignments, security policy modifications) are immutably retained for 90 days.`,
      category: Category.OTHER,
      isPublished: true,
    },
  ];

  for (const article of kbArticlesData) {
    await prisma.knowledgeArticle.create({ data: article });
  }
  console.log("Created 10 Comprehensive Knowledge Base Articles (1 per category).");

  // ────────────────────────────────────────────────────────
  // 3. Historical Resolved Tickets (20 High-Quality Tickets)
  // Distributed over past 8 weeks with realistic CSAT ratings (1-5 stars)
  // ────────────────────────────────────────────────────────
  const historicalTicketsData = [
    {
      subject: "Stripe Webhook Signature Verification Failed on Checkout 500 error",
      description: "Our checkout page threw 500 errors when customers attempted credit card payments. Stripe webhook dashboard showed 400 bad request and unhandled signature exceptions.",
      category: Category.BUG,
      priority: Priority.URGENT,
      customer: customerAlice,
      assignee: agentSarah,
      weeksAgo: 1,
      csat: {
        rating: 5,
        comment: "Sarah identified the Stripe webhook signature validation issue within 10 minutes. Stellar investigation and immediate fix!",
      },
      resolution: `We identified that the middleware was pre-parsing the JSON body before the Stripe SDK could verify the raw binary signature in the 'stripe-signature' header.

Solution applied:
1. Updated endpoint configuration to disable automatic body parsing on '/api/webhooks/stripe'.
2. Configured 'buffer(req)' to pass the exact raw binary payload to stripe.webhooks.constructEvent.
3. Verified all pending webhook events in Stripe CLI; all test payments now return 200 OK.`,
    },
    {
      subject: "Annual subscription invoice mismatch and VAT deduction error",
      description: "Our invoice #INV-2026-880 shows $1,400 instead of our agreed enterprise tier rate of $1,200, and our EU VAT ID was omitted.",
      category: Category.BILLING,
      priority: Priority.HIGH,
      customer: customerBob,
      assignee: agentJordan,
      weeksAgo: 2,
      csat: {
        rating: 4,
        comment: "Jordan adjusted the credit note and fixed our EU VAT ID on the invoice. Good guidance, took a few hours during peak times.",
      },
      resolution: `I have reviewed your contract terms and corrected the discrepancy:
1. Issued Credit Note #CN-2026-104 for the $200 variance.
2. Updated your billing profile with EU VAT ID (IE6388047V) to ensure zero-rated reverse charge on future invoices.
3. Re-generated invoice #INV-2026-880-REV for your accounting records.`,
    },
    {
      subject: "Need SAML 2.0 Single Sign-On metadata XML for Okta configuration",
      description: "We are configuring Okta SSO for 250 enterprise employees and require your SP Entity ID, ACS URL, and signing certificate.",
      category: Category.FEATURE,
      priority: Priority.MEDIUM,
      customer: customerCarol,
      assignee: agentAlex,
      weeksAgo: 2,
      csat: {
        rating: 5,
        comment: "Alex provided the exact ACS URL and Okta configuration checklist. SSO was live in under an hour!",
      },
      resolution: `Here are your tenant-specific SAML 2.0 Service Provider endpoints:
• ACS URL: https://app.busydesk.com/api/auth/saml/callback?tenant=apex
• Entity ID: https://app.busydesk.com/saml/metadata/apex
• NameID Format: EmailAddress
• Certificate: Downloaded and verified your IdP metadata XML; SAML login is now active on your subdomain.`,
    },
    {
      subject: "User locked out after multiple password attempts and reset email not arriving",
      description: "Our VP of Operations is locked out of the dashboard. Clicked 'Forgot Password' multiple times but no email arrived.",
      category: Category.ACCOUNT,
      priority: Priority.HIGH,
      customer: customerDavid,
      assignee: agentMarcus,
      weeksAgo: 3,
      csat: {
        rating: 4,
        comment: "Marcus verified my corporate domain and manually released the lock flag. Password reset link arrived promptly.",
      },
      resolution: `I investigated the delivery logs and found that your corporate mail filter was quarantining emails with password reset tokens.

Resolution steps completed:
1. Manually cleared the failed-login lockout flag on the user profile.
2. Whitelisted your domain in our transactional email relay.
3. Dispatched a direct secure reset link to the user; confirmed successful login.`,
    },
    {
      subject: "Webhook dispatch worker throwing HTTP 429 Too Many Requests on batch sync",
      description: "When our inventory sync pushes 500 records at once, your webhook worker rejects calls with HTTP 429 Too Many Requests.",
      category: Category.INTEGRATION,
      priority: Priority.MEDIUM,
      customer: customerCarol,
      assignee: agentAlex,
      weeksAgo: 3,
      csat: {
        rating: 3,
        comment: "Issue was resolved eventually, but had to explain our webhook payload twice before the team understood the reproduction steps.",
      },
      resolution: `Our individual webhook endpoint enforces a burst concurrency limit of 50 requests per second.

Recommended architecture resolution:
1. Switch to our bulk ingestion endpoint '/api/v1/inventory/bulk' which accepts up to 1,000 records in a single payload.
2. In your worker script, implement exponential backoff retry when receiving HTTP 429, honoring the 'Retry-After' header.`,
    },
    {
      subject: "Dashboard ticket queue taking 6+ seconds to load for accounts with 5,000+ tickets",
      description: "Our support agents notice severe latency when opening the main ticket queue. The page spins for 6 to 8 seconds before rendering.",
      category: Category.PERFORMANCE,
      priority: Priority.URGENT,
      customer: customerAlice,
      assignee: agentPriya,
      weeksAgo: 4,
      csat: {
        rating: 5,
        comment: "Priya solved our database query latency by providing the exact composite index definition. Our dashboard loads in under 200ms now!",
      },
      resolution: `Identified a missing composite index on the PostgreSQL Ticket table for multi-tenant queue queries.

Engineering fix deployed:
1. Created composite index: CREATE INDEX idx_tickets_tenant_status_created ON "Ticket"("tenantId", "status", "createdAt" DESC);
2. Added cursor-based keyset pagination to limit initial page payload to 25 records.
3. Query execution time dropped from 6,400ms to 42ms.`,
    },
    {
      subject: "Emergency 2FA recovery code lost after phone upgrade and authenticator wipe",
      description: "Upgraded to a new mobile phone and lost access to Google Authenticator. Do not have backup recovery codes available.",
      category: Category.SECURITY,
      priority: Priority.HIGH,
      customer: customerBob,
      assignee: agentSarah,
      weeksAgo: 4,
      csat: {
        rating: 3,
        comment: "Took a bit of back and forth for identity verification with photo ID, but account access was restored safely.",
      },
      resolution: `Completed rigorous identity verification protocol in accordance with SOC2 compliance:
1. Verified requester identity via video confirmation and corporate domain administrative contact.
2. Reset the 2FA secret on the account and generated a temporary 1-time emergency login token.
3. User successfully logged in and re-enrolled new authenticator app with fresh backup codes.`,
    },
    {
      subject: "Agent invitation email link expired after 7 days for new hire",
      description: "Our new hire could not accept the invitation link because it says 'Token expired'. Need a fresh invitation link.",
      category: Category.ONBOARDING,
      priority: Priority.LOW,
      customer: customerCarol,
      assignee: agentMarcus,
      weeksAgo: 5,
      csat: {
        rating: 4,
        comment: "Marcus re-issued a fresh invitation token with extended validity. Our new hire is onboarded.",
      },
      resolution: `Invitation tokens have a security expiry of 7 days.
1. Revoked expired token for candidate.
2. Generated and dispatched a fresh invitation link directly from the Supervisor console.
3. Confirmed the agent accepted the invitation and created their account successfully.`,
    },
    {
      subject: "Clarification on API rate limits and webhook retry backoff schedule",
      description: "We are writing an integration against your REST API. What are the burst limits and how do webhooks retry upon failure?",
      category: Category.QUESTION,
      priority: Priority.LOW,
      customer: customerDavid,
      assignee: agentAlex,
      weeksAgo: 5,
      csat: {
        rating: 5,
        comment: "Clear documentation provided on exponential backoff and burst limits. Exactly what our dev team needed.",
      },
      resolution: `Provided detailed API rate limit specifications:
• Rate Limit: 300 req/min for your Professional subscription tier.
• Concurrency: Max 20 simultaneous HTTP connections.
• Webhook Retry Policy: Exponential backoff schedule at 1s, 5s, 30s, 5m, 1h (up to 5 attempts).
• Sent Postman collection and SDK retry wrapper example.`,
    },
    {
      subject: "Request for complete GDPR data export of archived tickets in CSV format",
      description: "Our legal counsel requires a full data export of all closed tickets from Q3 and Q4 2025 in CSV format for compliance audit.",
      category: Category.OTHER,
      priority: Priority.MEDIUM,
      customer: customerAlice,
      assignee: agentJordan,
      weeksAgo: 6,
      csat: {
        rating: 2,
        comment: "Took almost 2 days to get our data export script run, though the resulting CSV was complete.",
      },
      resolution: `Generated full compliance export per GDPR Article 20:
1. Extracted 1,420 ticket records with associated replies, timestamps, and audit events.
2. Formatted as RFC-4180 compliant CSV archive.
3. Encrypted export with AES-256 and shared secure download link with legal contact.`,
    },
    {
      subject: "File attachment upload fails with 413 Payload Too Large on PDFs larger than 10MB",
      description: "Customer attempted to attach a 14MB system log PDF to their ticket and received an immediate 'Upload Failed' error.",
      category: Category.BUG,
      priority: Priority.MEDIUM,
      customer: customerDavid,
      assignee: agentSarah,
      weeksAgo: 6,
      csat: {
        rating: 1,
        comment: "Initial response misunderstood our outage. We lost hours of checkout traffic before the bug fix deployed.",
      },
      resolution: `The reverse proxy NGINX client_max_body_size was defaulted to 10MB.
1. Increased proxy client_max_body_size to 25MB.
2. Configured direct-to-S3 pre-signed upload URLs for large attachments to avoid buffering on application servers.
3. Customer re-uploaded the 14MB diagnostics file successfully.`,
    },
    {
      subject: "Double charge on monthly renewal invoice after plan change",
      description: "We switched from Growth to Pro on Feb 1st and noticed two separate charges of $199 and $349 on our credit card statement.",
      category: Category.BILLING,
      priority: Priority.HIGH,
      customer: customerBob,
      assignee: agentJordan,
      weeksAgo: 7,
      csat: {
        rating: 2,
        comment: "Took over 36 hours to get our invoice prorated after downgrading seats. Support was polite but process felt bureaucratic.",
      },
      resolution: `Investigated the billing timeline:
1. The automated billing cycle charged the standard renewal for Growth on the 1st, while the manual Pro upgrade processed concurrently.
2. Issued an immediate refund of $199 back to your credit card (ARN: 745920381029).
3. Applied a $50 credit to your billing balance as a courtesy for the billing confusion.`,
    },
    {
      subject: "CSV Customer Data Export format truncated Japanese UTF-8 characters",
      description: "When downloading our customer list CSV export, Japanese kanji and hiragana characters render as corrupted gibberish symbols.",
      category: Category.OTHER,
      priority: Priority.MEDIUM,
      customer: customerCarol,
      assignee: agentPriya,
      weeksAgo: 7,
      csat: {
        rating: 4,
        comment: "Priya correctly diagnosed the missing UTF-8 BOM in Excel and provided an updated export script immediately.",
      },
      resolution: `Identified that Microsoft Excel requires a UTF-8 Byte Order Mark (BOM) to recognize non-ASCII multi-byte characters:
1. Updated export generator to prepend '\\uFEFF' (UTF-8 BOM) to all CSV file streams.
2. Verified Japanese, Korean, and accented European characters render correctly in Excel, Google Sheets, and LibreOffice.`,
    },
    {
      subject: "Dark Mode theme toggle request and high-contrast UI option",
      description: "Our agents work evening shifts and requested a dark theme mode or reduced eye-strain color palette for the ticket workspace.",
      category: Category.FEATURE,
      priority: Priority.LOW,
      customer: customerAlice,
      assignee: agentMarcus,
      weeksAgo: 8,
      csat: {
        rating: 5,
        comment: "Marcus added this to the design sprint and shared Figma preview. Fantastic engagement with customer ideas!",
      },
      resolution: `Logged feature enhancement ticket #FEAT-402 with our UI design team.
1. Shared Figma tokens preview with ACME design systems team for feedback.
2. Added to Q2 release roadmap under theme customization milestone.`,
    },
    {
      subject: "Database connection pool exhaustion during peak morning ticket submission spike",
      description: "Between 9:00 AM and 9:15 AM EST, our agents received 'Connection timeout: pool exhausted' errors when refreshing ticket views.",
      category: Category.PERFORMANCE,
      priority: Priority.URGENT,
      customer: customerDavid,
      assignee: agentPriya,
      weeksAgo: 8,
      csat: {
        rating: 4,
        comment: "Very solid technical resolution. Priya tuned our Prisma connection pool and PgBouncer limits.",
      },
      resolution: `Prisma ORM connection pool size was set to default 10 connections while serverless functions scaled to 40 concurrent workers.
1. Implemented PgBouncer connection pooling in transaction mode.
2. Configured 'connection_limit=25' with statement timeout of 10s.
3. Peak morning traffic now handles 250 requests/sec with zero pool exhaustion errors.`,
    },
    {
      subject: "Inquiry regarding data residency and SOC2 Type II compliance reports",
      description: "Our security compliance audit requires your SOC2 Type II report, ISO 27001 certificate, and confirmation of EU data storage location.",
      category: Category.QUESTION,
      priority: Priority.MEDIUM,
      customer: customerCarol,
      assignee: agentSarah,
      weeksAgo: 8,
      csat: {
        rating: 5,
        comment: "Sarah sent our complete security packet with NDA in less than 2 hours. Approved by our CISO without friction.",
      },
      resolution: `Provided complete enterprise security assurance package:
1. Executed mutual NDA and shared current SOC2 Type II audit report (conducted by Ernst & Young).
2. Confirmed your tenant data is pinned to AWS eu-west-1 (Dublin, Ireland) with AES-256 encryption at rest.
3. Provided ISO 27001 certificate and Data Processing Agreement (DPA) incorporating standard contractual clauses.`,
    },
  ];

  console.log("Creating 16 historical resolved tickets with realistic resolutions and dynamic CSAT...");

  for (let i = 0; i < historicalTicketsData.length; i++) {
    const item = historicalTicketsData[i];
    const resolvedDate = new Date(now.getTime() - item.weeksAgo * 7 * 24 * 60 * 60 * 1000 + i * 45 * 60 * 1000);
    const createdDate = new Date(resolvedDate.getTime() - 4 * 60 * 60 * 1000); // 4 hours to resolve

    const ticket = await prisma.ticket.create({
      data: {
        subject: item.subject,
        description: item.description,
        requesterId: item.customer.id,
        requesterName: item.customer.name,
        requesterEmail: item.customer.email,
        priority: item.priority,
        category: item.category,
        status: Status.RESOLVED,
        createdById: supervisor.id,
        primaryAssigneeId: item.assignee.id,
        slaTargetMinutes: SLA_TARGETS[item.priority],
        slaDueAt: new Date(createdDate.getTime() + SLA_TARGETS[item.priority] * 60 * 1000),
        slaCycle: 1,
        createdAt: createdDate,
        updatedAt: resolvedDate,
        resolvedAt: resolvedDate,
      },
    });

    // Public Resolution Reply from Agent
    await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        authorId: item.assignee.id,
        authorType: AuthorType.AGENT,
        authorName: item.assignee.name,
        authorEmail: item.assignee.email,
        body: item.resolution,
        isInternal: false,
        createdAt: resolvedDate,
      },
    });

    // Audit logs
    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        actorId: supervisor.id,
        actorName: supervisor.name,
        eventType: AuditEventType.TICKET_CREATED,
        newValue: { status: Status.NEW, priority: item.priority, category: item.category },
        createdAt: createdDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        actorId: item.assignee.id,
        actorName: item.assignee.name,
        eventType: AuditEventType.STATUS_CHANGED,
        oldValue: { status: Status.OPEN },
        newValue: { status: Status.RESOLVED },
        createdAt: resolvedDate,
      },
    });

    // Dynamic Customer Satisfaction rating (covering 1 to 5 stars)
    if (item.csat) {
      await prisma.customerSatisfaction.create({
        data: {
          ticketId: ticket.id,
          userId: item.customer.id,
          rating: item.csat.rating,
          comment: item.csat.comment,
          createdAt: new Date(resolvedDate.getTime() + 20 * 60 * 1000),
        },
      });
    }
  }

  // ────────────────────────────────────────────────────────
  // 4. Active & Lifecycle Demonstration Tickets
  // Demonstrates various states, SLAs, alerts, collaborations
  // ────────────────────────────────────────────────────────
  console.log("Creating active lifecycle demonstration tickets...");

  // Active Ticket 1: Urgent SLA Breached (Alice Requester, Sarah Assignee) - Stripe 500 error
  const t1 = await prisma.ticket.create({
    data: {
      subject: "Critical: Production Payment Gateway 500 Errors during checkout",
      description: "Multiple enterprise customers report recurring 500 error when clicking 'Complete Purchase' on the Stripe integration. Checkout is failing completely.",
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
      body: "Checking Stripe webhook error logs now. The signature validation seems to be rejecting certain payloads due to body-parser middleware alterations.",
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

  // Active Ticket 2: High Priority - SLA Due Soon (Bob Requester, Jordan Assignee, Alex Collaborator)
  const t2 = await prisma.ticket.create({
    data: {
      subject: "Annual Subscription Invoice mismatch and VAT deduction error",
      description: "Our invoice #INV-2026-904 shows $1,400 instead of agreed contract price of $1,200, and VAT tax number was omitted from the header.",
      requesterId: customerBob.id,
      requesterName: customerBob.name,
      requesterEmail: customerBob.email,
      priority: Priority.HIGH,
      category: Category.BILLING,
      status: Status.OPEN,
      createdById: agentJordan.id,
      primaryAssigneeId: agentJordan.id,
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
      userId: agentAlex.id,
      addedById: agentJordan.id,
    },
  });

  // Active Ticket 3: PENDING ticket awaiting customer reply (Carol Requester)
  const t3 = await prisma.ticket.create({
    data: {
      subject: "Need SAML 2.0 Single Sign-On metadata XML for Okta configuration",
      description: "We are setting up SSO for 250 users on Okta and need your Identity Provider ACS URL, Entity ID, and certificates.",
      requesterId: customerCarol.id,
      requesterName: customerCarol.name,
      requesterEmail: customerCarol.email,
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
      body: "Hi Carol, I have generated your tenant SSO endpoints. Could you please send over your Okta metadata XML file so we can complete certificate verification on our end?",
      isInternal: false,
      createdAt: new Date(now.getTime() - 125 * 60 * 1000),
    },
  });

  // Active Ticket 4: NEW unassigned ticket in Triage (David Requester)
  const t4 = await prisma.ticket.create({
    data: {
      subject: "Slow Database Ledger Query causing HTTP 504 Gateway Timeouts",
      description: "Executing report generation on the transaction ledger times out after 30 seconds with 504 Gateway Timeout. Seems to be missing an index.",
      requesterId: customerDavid.id,
      requesterName: customerDavid.name,
      requesterEmail: customerDavid.email,
      priority: Priority.URGENT,
      category: Category.PERFORMANCE,
      status: Status.NEW,
      createdById: customerDavid.id,
      primaryAssigneeId: null, // Unassigned triage!
      slaTargetMinutes: SLA_TARGETS.URGENT,
      slaDueAt: new Date(now.getTime() + 90 * 60 * 1000),
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000),
      updatedAt: now,
    },
  });

  // Active Ticket 5: OPEN ticket for Webhook Rate Limit (Carol Requester, Alex Assignee)
  const t5 = await prisma.ticket.create({
    data: {
      subject: "Webhook dispatch worker throwing HTTP 429 Too Many Requests on batch sync",
      description: "Our server is receiving HTTP 429 errors when sending batch webhook requests. How can we configure exponential backoff and burst limits?",
      requesterId: customerCarol.id,
      requesterName: customerCarol.name,
      requesterEmail: customerCarol.email,
      priority: Priority.MEDIUM,
      category: Category.INTEGRATION,
      status: Status.OPEN,
      createdById: customerCarol.id,
      primaryAssigneeId: agentAlex.id,
      slaTargetMinutes: SLA_TARGETS.MEDIUM,
      slaDueAt: new Date(now.getTime() + 18 * 60 * 60 * 1000),
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 240 * 60 * 1000),
      updatedAt: now,
    },
  });

  // Active Ticket 6: OPEN ticket for 2FA Account Recovery (Bob Requester, Sarah Assignee)
  const t6 = await prisma.ticket.create({
    data: {
      subject: "Emergency 2FA recovery code lost after phone upgrade",
      description: "I lost my phone and cannot retrieve my 2FA code. Need assistance recovering access to our corporate account.",
      requesterId: customerBob.id,
      requesterName: customerBob.name,
      requesterEmail: customerBob.email,
      priority: Priority.HIGH,
      category: Category.SECURITY,
      status: Status.OPEN,
      createdById: customerBob.id,
      primaryAssigneeId: agentSarah.id,
      slaTargetMinutes: SLA_TARGETS.HIGH,
      slaDueAt: new Date(now.getTime() + 5 * 60 * 60 * 1000),
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 180 * 60 * 1000),
      updatedAt: now,
    },
  });

  // Active Ticket 7: OPEN ticket for Password Reset (David Requester, Marcus Assignee)
  const t7 = await prisma.ticket.create({
    data: {
      subject: "User locked out after multiple password attempts and reset email not arriving",
      description: "I am locked out of my account after typing an old password. Clicked forgot password but reset link has not arrived.",
      requesterId: customerDavid.id,
      requesterName: customerDavid.name,
      requesterEmail: customerDavid.email,
      priority: Priority.MEDIUM,
      category: Category.ACCOUNT,
      status: Status.OPEN,
      createdById: customerDavid.id,
      primaryAssigneeId: agentMarcus.id,
      slaTargetMinutes: SLA_TARGETS.MEDIUM,
      slaDueAt: new Date(now.getTime() + 14 * 60 * 60 * 1000),
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 120 * 60 * 1000),
      updatedAt: now,
    },
  });

  // Active Ticket 8: OPEN ticket for GDPR Data Export (Alice Requester, Priya Assignee)
  const t8 = await prisma.ticket.create({
    data: {
      subject: "Request for complete GDPR data export of archived tickets in CSV format",
      description: "We are undergoing our annual SOC2 and GDPR compliance audit and need a full CSV export of our archived support records.",
      requesterId: customerAlice.id,
      requesterName: customerAlice.name,
      requesterEmail: customerAlice.email,
      priority: Priority.LOW,
      category: Category.OTHER,
      status: Status.OPEN,
      createdById: customerAlice.id,
      primaryAssigneeId: agentPriya.id,
      slaTargetMinutes: SLA_TARGETS.LOW,
      slaDueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      slaCycle: 1,
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      updatedAt: now,
    },
  });

  // ────────────────────────────────────────────────────────
  // 5. Tag Groups & Multi-Dimensional Hierarchical Tags
  // ────────────────────────────────────────────────────────
  console.log("Seeding tag groups and tags...");

  const platformGroup = await prisma.tagGroup.create({
    data: {
      name: "Platform",
      description: "Client surface or execution runtime",
      color: "#8B5CF6",
      isExclusive: false,
      displayOrder: 1,
    },
  });

  const envGroup = await prisma.tagGroup.create({
    data: {
      name: "Environment",
      description: "Target deployment tier",
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

  const seededTags = [
    // Platform
    { name: "Web", slug: "web", color: "#60A5FA", groupId: platformGroup.id },
    { name: "API", slug: "api", color: "#FBBF24", groupId: platformGroup.id },
    { name: "iOS", slug: "ios", color: "#A78BFA", groupId: platformGroup.id },
    { name: "Android", slug: "android", color: "#34D399", groupId: platformGroup.id },
    // Environment
    { name: "Production", slug: "production", color: "#EF4444", groupId: envGroup.id },
    { name: "Staging", slug: "staging", color: "#F59E0B", groupId: envGroup.id },
    { name: "Development", slug: "development", color: "#10B981", groupId: envGroup.id },
    // Component
    { name: "Authentication", slug: "authentication", color: "#818CF8", groupId: componentGroup.id },
    { name: "Billing", slug: "billing-tag", color: "#34D399", groupId: componentGroup.id },
    { name: "Database", slug: "database", color: "#60A5FA", groupId: componentGroup.id },
    { name: "Integrations", slug: "integrations", color: "#C084FC", groupId: componentGroup.id },
    { name: "Notifications", slug: "notifications", color: "#FB923C", groupId: componentGroup.id },
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
    const created = await prisma.tag.create({ data: t });
    tagMap.set(t.name, created);
  }

  // Associate tags to active tickets
  const activeTickets = [t1, t2, t3, t4, t5, t6, t7, t8];
  const tagUsageCounts = new Map<string, number>();

  for (const t of activeTickets) {
    const tagsToAdd: any[] = [];
    if (t.priority === Priority.URGENT) {
      tagsToAdd.push(tagMap.get("Production"), tagMap.get("Service Down"), tagMap.get("Escalated"));
    } else if (t.priority === Priority.HIGH) {
      tagsToAdd.push(tagMap.get("Degraded"), tagMap.get("Customer VIP"));
    } else {
      tagsToAdd.push(tagMap.get("Web"));
    }

    if (t.category === Category.BUG) tagsToAdd.push(tagMap.get("regression"));
    if (t.category === Category.BILLING) tagsToAdd.push(tagMap.get("Billing"));
    if (t.category === Category.SECURITY || t.category === Category.ACCOUNT) tagsToAdd.push(tagMap.get("Authentication"));
    if (t.category === Category.INTEGRATION) tagsToAdd.push(tagMap.get("Integrations"), tagMap.get("API"));
    if (t.category === Category.PERFORMANCE) tagsToAdd.push(tagMap.get("Database"));

    for (const tag of tagsToAdd) {
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
      } catch {
        // Ignore duplicate tag assignments
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

  console.log("Database Seed completed successfully!");
  console.log("✓ 10 Users: 1 Supervisor, 5 Specialized Agents, 4 Customers");
  console.log("✓ 10 Knowledge Base Articles covering ALL 10 categories");
  console.log("✓ 16 Resolved Historical Tickets with dynamic 1-5 star CSAT feedback & rich solutions");
  console.log("✓ 8 Active Demonstration Tickets covering all lifecycle states (SLA Breached, Due Soon, Paused, Triage)");
  console.log("✓ 5 Tag Groups & 22 Hierarchical Tags");
}

main()
  .catch((e) => {
    console.error("Seed execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
