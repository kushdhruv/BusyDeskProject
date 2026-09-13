/**
 * Email Digest Service
 * Generates high-signal daily & weekly queue digests for Agents and Supervisors,
 * implements smart suppression for empty queues, and renders responsive HTML email templates.
 */

import { Role, Status, Priority, DigestFrequency } from "@prisma/client";
import { prisma } from "../db/prisma.db";

export interface AgentDigestData {
  agent: {
    id: string;
    name: string;
    email: string;
  };
  period: "daily" | "weekly";
  generatedAt: Date;
  metrics: {
    assignedOpenCount: number;
    assignedPendingCount: number;
    urgentCount: number;
    dueSoonCount: number;
    breachedCount: number;
    resolvedRecentCount: number;
    awaitingAgentReplyCount: number;
    recentCsatRating: number | null;
  };
  urgentTickets: {
    id: string;
    ticketNumber: number;
    subject: string;
    priority: Priority;
    status: Status;
    slaDueAt: Date | null;
  }[];
  shouldSuppress: boolean;
  suppressReason?: string;
}

export interface SupervisorDigestData {
  supervisor: {
    id: string;
    name: string;
    email: string;
  };
  period: "daily" | "weekly";
  generatedAt: Date;
  metrics: {
    totalOpenTickets: number;
    totalPendingTickets: number;
    newTicketsCount: number;
    resolvedTicketsCount: number;
    slaBreachedCount: number;
    slaComplianceRate: number;
    averageCsat: number | null;
    csatResponseCount: number;
  };
  agentWorkloads: {
    id: string;
    name: string;
    activeTicketsCount: number;
    breachedCount: number;
    resolvedCount: number;
  }[];
  atRiskTickets: {
    id: string;
    ticketNumber: number;
    subject: string;
    priority: Priority;
    assigneeName: string;
    slaDueAt: Date | null;
  }[];
}

export class DigestService {
  /**
   * Generates personal queue summary for an Agent.
   */
  static async getAgentDigestData(
    agentId: string,
    period: "daily" | "weekly" = "daily"
  ): Promise<AgentDigestData> {
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!agent) {
      throw new Error("Agent not found.");
    }

    const now = new Date();
    const periodHours = period === "daily" ? 24 : 168; // 24h or 7 days
    const periodStart = new Date(now.getTime() - periodHours * 60 * 60 * 1000);

    // Active assigned tickets
    const activeTickets = await prisma.ticket.findMany({
      where: {
        primaryAssigneeId: agentId,
        archivedAt: null,
        status: { in: [Status.NEW, Status.OPEN, Status.PENDING] },
      },
      orderBy: [{ priority: "desc" }, { slaDueAt: "asc" }],
    });

    const assignedOpenCount = activeTickets.filter(
      (t) => t.status === Status.NEW || t.status === Status.OPEN
    ).length;
    const assignedPendingCount = activeTickets.filter(
      (t) => t.status === Status.PENDING
    ).length;
    const urgentCount = activeTickets.filter(
      (t) => t.priority === Priority.URGENT
    ).length;

    // SLA Due soon (<= 2 hours) and Breached
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const dueSoonCount = activeTickets.filter(
      (t) =>
        t.status !== Status.PENDING &&
        t.slaDueAt &&
        new Date(t.slaDueAt) > now &&
        new Date(t.slaDueAt) <= twoHoursFromNow
    ).length;

    const breachedCount = activeTickets.filter(
      (t) =>
        t.status !== Status.PENDING &&
        t.slaDueAt &&
        new Date(t.slaDueAt) <= now
    ).length;

    // Tickets resolved in the period
    const resolvedRecentCount = await prisma.ticket.count({
      where: {
        primaryAssigneeId: agentId,
        status: { in: [Status.RESOLVED, Status.CLOSED] },
        resolvedAt: { gte: periodStart },
      },
    });

    // Customer replies waiting for response
    // Tickets assigned to this agent where the latest reply is by a customer
    const openWithCustomerReplies = await prisma.ticket.findMany({
      where: {
        primaryAssigneeId: agentId,
        status: Status.OPEN,
        replies: {
          some: {
            authorType: "CUSTOMER",
            createdAt: { gte: periodStart },
          },
        },
      },
      select: { id: true },
    });
    const awaitingAgentReplyCount = openWithCustomerReplies.length;

    // Recent CSAT received
    const csatRecords = await prisma.customerSatisfaction.findMany({
      where: {
        ticket: { primaryAssigneeId: agentId },
        createdAt: { gte: periodStart },
      },
      select: { rating: true },
    });
    const recentCsatRating =
      csatRecords.length > 0
        ? Number(
            (
              csatRecords.reduce((acc, c) => acc + c.rating, 0) /
              csatRecords.length
            ).toFixed(1)
          )
        : null;

    // Extract urgent / breached tickets for highlight list
    const urgentTickets = activeTickets
      .filter((t) => t.priority === Priority.URGENT || (t.slaDueAt && new Date(t.slaDueAt) <= now))
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        priority: t.priority,
        status: t.status,
        slaDueAt: t.slaDueAt,
      }));

    // Smart Suppression: suppress if agent has zero active tickets and zero customer replies
    const shouldSuppress =
      assignedOpenCount === 0 &&
      assignedPendingCount === 0 &&
      awaitingAgentReplyCount === 0 &&
      dueSoonCount === 0 &&
      breachedCount === 0;

    return {
      agent: { id: agent.id, name: agent.name, email: agent.email },
      period,
      generatedAt: now,
      metrics: {
        assignedOpenCount,
        assignedPendingCount,
        urgentCount,
        dueSoonCount,
        breachedCount,
        resolvedRecentCount,
        awaitingAgentReplyCount,
        recentCsatRating,
      },
      urgentTickets,
      shouldSuppress,
      suppressReason: shouldSuppress
        ? "No active tickets or pending customer replies assigned."
        : undefined,
    };
  }

  /**
   * Generates department-wide operational summary for a Supervisor.
   */
  static async getSupervisorDigestData(
    supervisorId: string,
    period: "daily" | "weekly" = "daily"
  ): Promise<SupervisorDigestData> {
    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!supervisor || supervisor.role !== Role.SUPERVISOR) {
      throw new Error("Supervisor not found or unauthorized.");
    }

    const now = new Date();
    const periodHours = period === "daily" ? 24 : 168;
    const periodStart = new Date(now.getTime() - periodHours * 60 * 60 * 1000);

    // Queue Totals
    const [totalOpenTickets, totalPendingTickets, newTicketsCount, resolvedTicketsCount] =
      await Promise.all([
        prisma.ticket.count({
          where: { archivedAt: null, status: { in: [Status.NEW, Status.OPEN] } },
        }),
        prisma.ticket.count({
          where: { archivedAt: null, status: Status.PENDING },
        }),
        prisma.ticket.count({
          where: { createdAt: { gte: periodStart } },
        }),
        prisma.ticket.count({
          where: { resolvedAt: { gte: periodStart } },
        }),
      ]);

    // Active SLA Breaches
    const slaBreachedCount = await prisma.ticket.count({
      where: {
        archivedAt: null,
        status: { in: [Status.NEW, Status.OPEN] },
        slaDueAt: { lte: now },
      },
    });

    // SLA Compliance Rate
    const resolvedInPeriod = await prisma.ticket.findMany({
      where: { resolvedAt: { gte: periodStart } },
      select: { slaDueAt: true, resolvedAt: true },
    });
    const compliantCount = resolvedInPeriod.filter(
      (t) => t.slaDueAt && t.resolvedAt && t.resolvedAt <= t.slaDueAt
    ).length;
    const slaComplianceRate =
      resolvedInPeriod.length > 0
        ? Math.round((compliantCount / resolvedInPeriod.length) * 100)
        : 100;

    // CSAT metrics
    const csats = await prisma.customerSatisfaction.findMany({
      where: { createdAt: { gte: periodStart } },
      select: { rating: true },
    });
    const averageCsat =
      csats.length > 0
        ? Number((csats.reduce((a, b) => a + b.rating, 0) / csats.length).toFixed(1))
        : null;

    // Team Workload Breakdown
    const agents = await prisma.user.findMany({
      where: { role: Role.AGENT },
      select: { id: true, name: true },
    });

    const agentWorkloads = await Promise.all(
      agents.map(async (a) => {
        const [activeCount, breached, resolved] = await Promise.all([
          prisma.ticket.count({
            where: {
              primaryAssigneeId: a.id,
              archivedAt: null,
              status: { in: [Status.NEW, Status.OPEN, Status.PENDING] },
            },
          }),
          prisma.ticket.count({
            where: {
              primaryAssigneeId: a.id,
              archivedAt: null,
              status: { in: [Status.NEW, Status.OPEN] },
              slaDueAt: { lte: now },
            },
          }),
          prisma.ticket.count({
            where: {
              primaryAssigneeId: a.id,
              status: { in: [Status.RESOLVED, Status.CLOSED] },
              resolvedAt: { gte: periodStart },
            },
          }),
        ]);

        return {
          id: a.id,
          name: a.name,
          activeTicketsCount: activeCount,
          breachedCount: breached,
          resolvedCount: resolved,
        };
      })
    );

    // At-Risk & Breached Tickets across the team
    const atRiskTicketsData = await prisma.ticket.findMany({
      where: {
        archivedAt: null,
        status: { in: [Status.NEW, Status.OPEN] },
        slaDueAt: { lte: new Date(now.getTime() + 60 * 60 * 1000) },
      },
      include: {
        primaryAssignee: { select: { name: true } },
      },
      orderBy: { slaDueAt: "asc" },
      take: 6,
    });

    const atRiskTickets = atRiskTicketsData.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      priority: t.priority,
      assigneeName: t.primaryAssignee?.name || "Unassigned",
      slaDueAt: t.slaDueAt,
    }));

    return {
      supervisor: { id: supervisor.id, name: supervisor.name, email: supervisor.email },
      period,
      generatedAt: now,
      metrics: {
        totalOpenTickets,
        totalPendingTickets,
        newTicketsCount,
        resolvedTicketsCount,
        slaBreachedCount,
        slaComplianceRate,
        averageCsat,
        csatResponseCount: csats.length,
      },
      agentWorkloads,
      atRiskTickets,
    };
  }

  /**
   * Renders high-fidelity responsive HTML email template for an Agent.
   */
  static renderAgentDigestHtml(data: AgentDigestData, baseUrl: string = "http://localhost:3000"): string {
    const { agent, metrics, urgentTickets, period } = data;
    const isDaily = period === "daily";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SupportDesk Queue Summary</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px; }
    .header h1 { margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: -0.025em; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
    .stat-val { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .stat-val.alert { color: #dc2626; }
    .stat-val.warning { color: #d97706; }
    .stat-val.success { color: #16a34a; }
    .stat-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.05em; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; margin: 24px 0 12px 0; }
    .ticket-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; text-decoration: none; color: inherit; }
    .ticket-row:hover { background: #f8fafc; }
    .ticket-subject { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
    .ticket-meta { font-size: 11px; color: #64748b; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge-urgent { background: #fee2e2; color: #991b1b; }
    .badge-high { background: #ffedd5; color: #9a3412; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; text-align: center; margin-top: 16px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Good morning, ${agent.name}</h1>
      <p>Here is your ${isDaily ? "daily" : "weekly"} SupportDesk queue briefing for ${data.generatedAt.toLocaleDateString()}</p>
    </div>

    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-val ${metrics.assignedOpenCount > 8 ? "warning" : ""}">${metrics.assignedOpenCount}</div>
          <div class="stat-label">Open Assigned</div>
        </div>
        <div class="stat-card">
          <div class="stat-val ${metrics.breachedCount > 0 ? "alert" : metrics.dueSoonCount > 0 ? "warning" : ""}">${metrics.breachedCount > 0 ? `${metrics.breachedCount} Breached` : metrics.dueSoonCount > 0 ? `${metrics.dueSoonCount} Due Soon` : "On Track"}</div>
          <div class="stat-label">SLA Status</div>
        </div>
        <div class="stat-card">
          <div class="stat-val success">${metrics.recentCsatRating ? `${metrics.recentCsatRating} ★` : metrics.resolvedRecentCount}</div>
          <div class="stat-label">${metrics.recentCsatRating ? "Recent CSAT" : "Resolved"}</div>
        </div>
      </div>

      ${
        urgentTickets.length > 0
          ? `
      <div class="section-title">🚨 Action Required (High Priority & Breaching)</div>
      ${urgentTickets
        .map(
          (t) => `
        <a href="${baseUrl}/tickets/${t.id}" class="ticket-row">
          <div>
            <div class="ticket-subject">#${t.ticketNumber} ${t.subject}</div>
            <div class="ticket-meta">Status: ${t.status} • Due: ${t.slaDueAt ? new Date(t.slaDueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}</div>
          </div>
          <span class="badge ${t.priority === Priority.URGENT ? "badge-urgent" : "badge-high"}">${t.priority}</span>
        </a>
      `
        )
        .join("")}
      `
          : `
      <div style="padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 13px; color: #166534;">
        ✅ <strong>All clear on SLAs!</strong> You have no breaching or urgent tickets in your immediate queue.
      </div>
      `
      }

      <div style="text-align: center; margin-top: 24px;">
        <a href="${baseUrl}/tickets?scope=assigned_to_me" class="btn">Open My Workspace &rarr;</a>
      </div>
    </div>

    <div class="footer">
      SupportDesk Notification • Sent to ${agent.email}<br>
      You can manage your digest preferences in <a href="${baseUrl}/dashboard" style="color: #64748b;">Profile Settings</a>.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Renders responsive HTML email template for a Supervisor.
   */
  static renderSupervisorDigestHtml(data: SupervisorDigestData, baseUrl: string = "http://localhost:3000"): string {
    const { supervisor, metrics, agentWorkloads, atRiskTickets, period } = data;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Department Queue Overview</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px; }
    .header h1 { margin: 0 0 4px 0; font-size: 18px; font-weight: 700; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
    .stat-val { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .stat-val.alert { color: #dc2626; }
    .stat-label { font-size: 10px; text-transform: uppercase; font-weight: 600; color: #64748b; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; margin: 24px 0 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
    th { background: #f8fafc; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; text-align: center; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Support Operations Briefing</h1>
      <p>Supervisor: ${supervisor.name} • ${data.generatedAt.toLocaleDateString()}</p>
    </div>

    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-val">${metrics.totalOpenTickets}</div>
          <div class="stat-label">Active Queue</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${metrics.resolvedTicketsCount}</div>
          <div class="stat-label">Resolved (${period})</div>
        </div>
        <div class="stat-card">
          <div class="stat-val ${metrics.slaComplianceRate < 90 ? "alert" : ""}">${metrics.slaComplianceRate}%</div>
          <div class="stat-label">SLA Compliance</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${metrics.averageCsat ? `${metrics.averageCsat} ★` : "N/A"}</div>
          <div class="stat-label">CSAT Rating</div>
        </div>
      </div>

      <div class="section-title">Team Workload Distribution</div>
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Active Queue</th>
            <th>Breached</th>
            <th>Resolved</th>
          </tr>
        </thead>
        <tbody>
          ${agentWorkloads
            .map(
              (w) => `
            <tr>
              <td><strong>${w.name}</strong></td>
              <td>${w.activeTicketsCount} tickets</td>
              <td style="color: ${w.breachedCount > 0 ? "#dc2626" : "#64748b"}; font-weight: ${w.breachedCount > 0 ? "700" : "normal"};">${w.breachedCount}</td>
              <td>${w.resolvedCount}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      ${
        atRiskTickets.length > 0
          ? `
      <div class="section-title">⚠️ At-Risk / Breaching Tickets</div>
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          ${atRiskTickets
            .map(
              (t) => `
            <tr>
              <td><a href="${baseUrl}/tickets/${t.id}" style="color: #0f172a; text-decoration: none; font-weight: 600;">#${t.ticketNumber} ${t.subject}</a></td>
              <td>${t.assigneeName}</td>
              <td><span style="color: ${t.priority === "URGENT" ? "#dc2626" : "#d97706"}; font-weight: 600;">${t.priority}</span></td>
              <td style="color: #64748b;">${t.slaDueAt ? new Date(t.slaDueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      `
          : ""
      }

      <div style="text-align: center; margin-top: 24px;">
        <a href="${baseUrl}/dashboard" class="btn">View Operational Dashboard &rarr;</a>
      </div>
    </div>

    <div class="footer">
      SupportDesk Department Summary • Sent to ${supervisor.email}<br>
      To adjust notification schedules, configure in <a href="${baseUrl}/settings/tags" style="color: #64748b;">System Settings</a>.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Executes scheduled batch dispatch of email digests with smart suppression.
   */
  static async sendScheduledDigests(params: {
    frequency?: DigestFrequency;
    forceAll?: boolean;
    baseUrl?: string;
  }) {
    const frequency = params.frequency || DigestFrequency.DAILY;
    const forceAll = !!params.forceAll;
    const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Query active staff users opting in to this frequency
    const users = await prisma.user.findMany({
      where: {
        role: { in: [Role.AGENT, Role.SUPERVISOR] },
        digestEnabled: true,
        digestFrequency: frequency,
      },
    });

    const results = {
      timestamp: new Date().toISOString(),
      frequency,
      totalEligible: users.length,
      sentCount: 0,
      suppressedCount: 0,
      failedCount: 0,
      deliveries: [] as {
        userId: string;
        userName: string;
        role: Role;
        status: "SENT" | "SUPPRESSED" | "FAILED";
        reason?: string;
      }[],
    };

    for (const user of users) {
      try {
        if (user.role === Role.AGENT) {
          const data = await this.getAgentDigestData(
            user.id,
            frequency === DigestFrequency.WEEKLY ? "weekly" : "daily"
          );

          if (data.shouldSuppress && !forceAll) {
            results.suppressedCount++;
            results.deliveries.push({
              userId: user.id,
              userName: user.name,
              role: user.role,
              status: "SUPPRESSED",
              reason: data.suppressReason,
            });
            continue;
          }

          const html = this.renderAgentDigestHtml(data, baseUrl);
          // In production: send via Nodemailer / Resend / SendGrid
          // In dev/test: log summary and record dispatch
          await prisma.user.update({
            where: { id: user.id },
            data: { digestLastSentAt: new Date() },
          });

          results.sentCount++;
          results.deliveries.push({
            userId: user.id,
            userName: user.name,
            role: user.role,
            status: "SENT",
          });
        } else if (user.role === Role.SUPERVISOR) {
          const data = await this.getSupervisorDigestData(
            user.id,
            frequency === DigestFrequency.WEEKLY ? "weekly" : "daily"
          );

          const html = this.renderSupervisorDigestHtml(data, baseUrl);
          await prisma.user.update({
            where: { id: user.id },
            data: { digestLastSentAt: new Date() },
          });

          results.sentCount++;
          results.deliveries.push({
            userId: user.id,
            userName: user.name,
            role: user.role,
            status: "SENT",
          });
        }
      } catch (err: any) {
        results.failedCount++;
        results.deliveries.push({
          userId: user.id,
          userName: user.name,
          role: user.role,
          status: "FAILED",
          reason: err.message,
        });
      }
    }

    return results;
  }
}
