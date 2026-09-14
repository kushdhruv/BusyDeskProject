/**
 * Email Digest Service
 * Generates high-signal daily & weekly queue digests for Agents and Supervisors,
 * implements smart suppression for empty queues, and renders responsive HTML email templates.
 */

import { Role, Status, Priority, DigestFrequency } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { EmailService } from "./email.service";

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
    requesterName?: string;
    customerCompany?: string;
    slaStatusLabel?: string;
  }[];
  awaitingReplies?: {
    id: string;
    ticketNumber: number;
    subject: string;
    priority: Priority;
    customerName: string;
    lastReplyTime?: Date;
  }[];
  recentResolvedHighlights?: {
    id: string;
    ticketNumber: number;
    subject: string;
    resolvedAt: Date | null;
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
    unassignedCount?: number;
  };
  agentWorkloads: {
    id: string;
    name: string;
    activeTicketsCount: number;
    breachedCount: number;
    resolvedCount: number;
    capacityStatus?: "Optimal" | "High Load" | "Over Capacity";
  }[];
  atRiskTickets: {
    id: string;
    ticketNumber: number;
    subject: string;
    priority: Priority;
    assigneeName: string;
    slaDueAt: Date | null;
    slaStatusLabel?: string;
  }[];
}

/**
 * Formats relative SLA deadline label for high-signal email display.
 */
function formatSlaLabel(slaDueAt: Date | null, now: Date): string {
  if (!slaDueAt) return "No SLA Target";
  const diffMs = new Date(slaDueAt).getTime() - now.getTime();
  const isOverdue = diffMs <= 0;
  const absMins = Math.round(Math.abs(diffMs) / (60 * 1000));
  const hours = Math.floor(absMins / 60);
  const mins = absMins % 60;

  if (isOverdue) {
    return `Overdue by ${hours > 0 ? `${hours}h ` : ""}${mins}m`;
  } else if (absMins <= 120) {
    return `Due in ${hours > 0 ? `${hours}h ` : ""}${mins}m`;
  } else if (hours < 24) {
    return `Due today (${new Date(slaDueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  } else {
    return `Due ${new Date(slaDueAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
  }
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
      include: {
        replies: {
          where: { authorType: "CUSTOMER" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 4,
    });
    const awaitingAgentReplyCount = openWithCustomerReplies.length;

    const awaitingReplies = openWithCustomerReplies.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      priority: t.priority,
      customerName: t.requesterName || "Customer",
      lastReplyTime: t.replies[0]?.createdAt,
    }));

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
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        priority: t.priority,
        status: t.status,
        slaDueAt: t.slaDueAt,
        requesterName: t.requesterName || "Customer",
        customerCompany: undefined,
        slaStatusLabel: formatSlaLabel(t.slaDueAt, now),
      }));

    // Highlights of recently resolved tickets
    const recentResolvedHighlights = await prisma.ticket.findMany({
      where: {
        primaryAssigneeId: agentId,
        status: { in: [Status.RESOLVED, Status.CLOSED] },
        resolvedAt: { gte: periodStart },
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        resolvedAt: true,
      },
      orderBy: { resolvedAt: "desc" },
      take: 3,
    });

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
      awaitingReplies,
      recentResolvedHighlights,
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
    const [totalOpenTickets, totalPendingTickets, newTicketsCount, resolvedTicketsCount, unassignedCount] =
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
        prisma.ticket.count({
          where: {
            archivedAt: null,
            primaryAssigneeId: null,
            status: { in: [Status.NEW, Status.OPEN] },
          },
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

        let capacityStatus: "Optimal" | "High Load" | "Over Capacity" = "Optimal";
        if (activeCount >= 10) capacityStatus = "Over Capacity";
        else if (activeCount >= 6) capacityStatus = "High Load";

        return {
          id: a.id,
          name: a.name,
          activeTicketsCount: activeCount,
          breachedCount: breached,
          resolvedCount: resolved,
          capacityStatus,
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
      slaStatusLabel: formatSlaLabel(t.slaDueAt, now),
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
        unassignedCount,
      },
      agentWorkloads,
      atRiskTickets,
    };
  }

  /**
   * Renders high-fidelity responsive HTML email template for an Agent.
   */
  static renderAgentDigestHtml(
    data: AgentDigestData,
    baseUrl: string = process.env.FRONTEND_URL || "https://busy-desk-project.vercel.app"
  ): string {
    const { agent, metrics, urgentTickets, awaitingReplies, recentResolvedHighlights, period } = data;
    const isDaily = period === "daily";

    // Clean normalized base URL
    const appUrl = baseUrl.replace(/\/+$/, "");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SupportDesk Queue Summary</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; -webkit-font-smoothing: antialiased; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 28px 24px; position: relative; }
    .brand-pill { display: inline-block; background: #1e293b; color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 9999px; margin-bottom: 12px; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; color: #ffffff; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.4; }
    .content { padding: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 8px; text-align: center; }
    .stat-val { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .stat-val.alert { color: #dc2626; }
    .stat-val.warning { color: #d97706; }
    .stat-val.success { color: #16a34a; }
    .stat-label { font-size: 10px; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.04em; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin: 24px 0 12px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #334155; }
    .ticket-row { display: block; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 10px; text-decoration: none; color: inherit; background: #ffffff; transition: border-color 0.15s; }
    .ticket-row:hover { border-color: #cbd5e1; background: #fafafa; }
    .ticket-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; gap: 8px; }
    .ticket-subject { font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.3; }
    .ticket-meta { font-size: 11px; color: #64748b; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
    .badge-urgent { background: #fee2e2; color: #991b1b; }
    .badge-high { background: #ffedd5; color: #9a3412; }
    .badge-medium { background: #e0f2fe; color: #0369a1; }
    .badge-sla-breach { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .badge-sla-due { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .badge-sla-ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff !important; padding: 11px 22px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; text-align: center; }
    .btn-secondary { display: inline-block; background: #f1f5f9; color: #0f172a !important; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; text-decoration: none; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5; }
    @media only screen and (max-width: 480px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .header h1 { font-size: 18px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="brand-pill">SupportDesk • ${isDaily ? "Daily Intelligence" : "Weekly Briefing"}</span>
      <h1>Good morning, ${agent.name}</h1>
      <p>Here is your personal queue briefing for ${data.generatedAt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}.</p>
    </div>

    <div class="content">
      <!-- High-Signal KPI Scorecard -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-val ${metrics.assignedOpenCount > 8 ? "warning" : ""}">${metrics.assignedOpenCount}</div>
          <div class="stat-label">Open Assigned</div>
        </div>
        <div class="stat-card">
          <div class="stat-val ${metrics.breachedCount > 0 ? "alert" : metrics.dueSoonCount > 0 ? "warning" : "success"}">${metrics.breachedCount > 0 ? `${metrics.breachedCount} Breached` : metrics.dueSoonCount > 0 ? `${metrics.dueSoonCount} Due Soon` : "On Track"}</div>
          <div class="stat-label">SLA Status</div>
        </div>
        <div class="stat-card">
          <div class="stat-val ${metrics.awaitingAgentReplyCount > 0 ? "warning" : ""}">${metrics.awaitingAgentReplyCount}</div>
          <div class="stat-label">Pending Reply</div>
        </div>
        <div class="stat-card">
          <div class="stat-val success">${metrics.recentCsatRating ? `${metrics.recentCsatRating} ★` : metrics.resolvedRecentCount}</div>
          <div class="stat-label">${metrics.recentCsatRating ? "Recent CSAT" : "Resolved"}</div>
        </div>
      </div>

      <!-- Action Required: Urgent & SLA Risk Tickets -->
      <div class="section-header">
        <span class="section-title">🚨 Action Required (Priority & SLA Watch)</span>
      </div>

      ${
        urgentTickets.length > 0
          ? `
        <div>
          ${urgentTickets
            .map(
              (t) => `
            <a href="${appUrl}/tickets/${t.id}" class="ticket-row">
              <div class="ticket-header">
                <span class="ticket-subject">#${t.ticketNumber} ${t.subject}</span>
                <span class="badge ${t.priority === Priority.URGENT ? "badge-urgent" : "badge-high"}">${t.priority}</span>
              </div>
              <div class="ticket-meta">
                <span>👤 ${t.requesterName || "Customer"} ${t.customerCompany ? `(${t.customerCompany})` : ""}</span>
                <span>•</span>
                <span class="badge ${
                  t.slaDueAt && new Date(t.slaDueAt) <= data.generatedAt
                    ? "badge-sla-breach"
                    : "badge-sla-due"
                }">${t.slaStatusLabel || (t.slaDueAt ? new Date(t.slaDueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A")}</span>
                <span>•</span>
                <span style="color: #0f172a; font-weight: 600;">Reply & Resolve &rarr;</span>
              </div>
            </a>
          `
            )
            .join("")}
        </div>
        `
          : `
        <div style="padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 13px; color: #166534; margin-bottom: 16px;">
          ✅ <strong>All clear on SLAs!</strong> You have no breaching or urgent tickets in your immediate queue.
        </div>
        `
      }

      <!-- Customer Responses Pending Follow-up -->
      ${
        awaitingReplies && awaitingReplies.length > 0
          ? `
        <div class="section-header" style="margin-top: 24px;">
          <span class="section-title">💬 Customer Follow-ups Awaiting Reply (${awaitingReplies.length})</span>
        </div>
        <div>
          ${awaitingReplies
            .map(
              (r) => `
            <a href="${appUrl}/tickets/${r.id}" class="ticket-row" style="background: #fafafa;">
              <div class="ticket-header">
                <span class="ticket-subject">#${r.ticketNumber} ${r.subject}</span>
                <span style="font-size: 11px; color: #0284c7; font-weight: 600;">Open &rarr;</span>
              </div>
              <div class="ticket-meta">
                <span>Customer: <strong>${r.customerName}</strong> responded recently</span>
              </div>
            </a>
          `
            )
            .join("")}
        </div>
        `
          : ""
      }

      <!-- Positive Reinforcement / Resolved Wins -->
      ${
        metrics.resolvedRecentCount > 0
          ? `
        <div style="margin-top: 20px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #334155; display: flex; align-items: center; justify-content: space-between;">
          <span>🎉 <strong>Momentum:</strong> You resolved <strong>${metrics.resolvedRecentCount} tickets</strong> in this ${period} period.</span>
          ${metrics.recentCsatRating ? `<span style="font-weight: 700; color: #16a34a;">${metrics.recentCsatRating} ★ CSAT</span>` : ""}
        </div>
        `
          : ""
      }

      <!-- Primary Workspace Call to Action -->
      <div style="text-align: center; margin-top: 28px;">
        <a href="${appUrl}/tickets?scope=assigned_to_me" class="btn">Open My Workspace &rarr;</a>
      </div>
    </div>

    <!-- Informative Footer with Preferences Deep-Link -->
    <div class="footer">
      SupportDesk Notification • Sent to ${agent.email}<br>
      You are receiving this ${isDaily ? "daily" : "weekly"} digest based on your notification preferences.<br>
      To adjust delivery time or frequency, visit <a href="${appUrl}/dashboard" style="color: #475569; text-decoration: underline;">Profile Settings</a>.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Renders responsive HTML email template for a Supervisor.
   */
  static renderSupervisorDigestHtml(
    data: SupervisorDigestData,
    baseUrl: string = process.env.FRONTEND_URL || "https://busy-desk-project.vercel.app"
  ): string {
    const { supervisor, metrics, agentWorkloads, atRiskTickets, period } = data;
    const appUrl = baseUrl.replace(/\/+$/, "");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Department Queue Overview</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; -webkit-font-smoothing: antialiased; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 28px 24px; }
    .brand-pill { display: inline-block; background: #1e293b; color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 9999px; margin-bottom: 12px; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 8px; text-align: center; }
    .stat-val { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .stat-val.alert { color: #dc2626; }
    .stat-label { font-size: 10px; text-transform: uppercase; font-weight: 600; color: #64748b; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #334155; margin: 24px 0 10px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
    th { background: #f8fafc; padding: 9px 10px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
    td { padding: 10px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff !important; padding: 11px 22px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; text-align: center; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; font-size: 11px; color: #94a3b8; text-align: center; }
    @media only screen and (max-width: 480px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="brand-pill">Operations Briefing • Supervisor Overview</span>
      <h1>Support Operations Briefing</h1>
      <p>Supervisor: ${supervisor.name} • ${data.generatedAt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
    </div>

    <div class="content">
      <!-- Department Scorecard -->
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

      <!-- Unassigned Queue Alert if present -->
      ${
        metrics.unassignedCount && metrics.unassignedCount > 0
          ? `
        <div style="padding: 12px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #92400e; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <span>⚠️ <strong>${metrics.unassignedCount} Unassigned Tickets</strong> currently awaiting agent assignment.</span>
          <a href="${appUrl}/tickets" style="color: #b45309; font-weight: 700; text-decoration: none;">Assign &rarr;</a>
        </div>
        `
          : ""
      }

      <!-- Team Workload Distribution Table -->
      <div class="section-title">Team Workload & Capacity Matrix</div>
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Active Queue</th>
            <th>Breached</th>
            <th>Resolved</th>
            <th>Status</th>
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
              <td><span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${w.capacityStatus === "Over Capacity" ? "#dc2626" : w.capacityStatus === "High Load" ? "#d97706" : "#16a34a"};">${w.capacityStatus || "Optimal"}</span></td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <!-- At-Risk & Breaching Tickets -->
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
              <td><a href="${appUrl}/tickets/${t.id}" style="color: #0f172a; text-decoration: none; font-weight: 600;">#${t.ticketNumber} ${t.subject}</a></td>
              <td>${t.assigneeName}</td>
              <td><span style="color: ${t.priority === Priority.URGENT ? "#dc2626" : "#d97706"}; font-weight: 600;">${t.priority}</span></td>
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
        <a href="${appUrl}/dashboard" class="btn">View Operational Dashboard &rarr;</a>
      </div>
    </div>

    <div class="footer">
      SupportDesk Department Summary • Sent to ${supervisor.email}<br>
      To adjust notification schedules, configure in <a href="${appUrl}/dashboard" style="color: #64748b;">System Settings</a>.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Dispatches a live, on-demand digest directly to a single staff member's email address.
   * Force-bypasses suppression so the user can verify their digest output immediately.
   */
  static async sendUserDigestNow(userId: string, baseUrl?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        digestFrequency: true,
        digestTime: true,
        digestTimezone: true,
      },
    });

    if (!user || user.role === Role.CUSTOMER) {
      throw new Error("Only staff members (Agents and Supervisors) can receive email digests.");
    }

    const appBaseUrl =
      baseUrl ||
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://busy-desk-project.vercel.app";

    const period = user.digestFrequency === DigestFrequency.WEEKLY ? "weekly" : "daily";

    if (user.role === Role.AGENT) {
      const data = await this.getAgentDigestData(user.id, period);
      const html = this.renderAgentDigestHtml(data, appBaseUrl);
      const result = await EmailService.sendDigestEmail({
        to: user.email,
        recipientName: user.name,
        role: user.role,
        subject: `Support Queue Digest (${period === "weekly" ? "Weekly" : "Daily"}): ${data.metrics.assignedOpenCount} Active Tickets`,
        htmlContent: html,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { digestLastSentAt: new Date() },
      });

      return result;
    } else {
      const data = await this.getSupervisorDigestData(user.id, period);
      const html = this.renderSupervisorDigestHtml(data, appBaseUrl);
      const result = await EmailService.sendDigestEmail({
        to: user.email,
        recipientName: user.name,
        role: user.role,
        subject: `Operations Queue Digest (${period === "weekly" ? "Weekly" : "Daily"}): ${data.metrics.totalOpenTickets} Total Open Tickets`,
        htmlContent: html,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { digestLastSentAt: new Date() },
      });

      return result;
    }
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
    const baseUrl =
      params.baseUrl ||
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://busy-desk-project.vercel.app";

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
          const dispatchResult = await EmailService.sendDigestEmail({
            to: user.email,
            recipientName: user.name,
            role: user.role,
            subject: `Support Queue Digest: ${data.metrics.assignedOpenCount} Active Tickets`,
            htmlContent: html,
          });

          await prisma.user.update({
            where: { id: user.id },
            data: { digestLastSentAt: new Date() },
          });

          if (dispatchResult.success) {
            results.sentCount++;
            results.deliveries.push({
              userId: user.id,
              userName: user.name,
              role: user.role,
              status: "SENT",
            });
          } else {
            results.failedCount++;
            results.deliveries.push({
              userId: user.id,
              userName: user.name,
              role: user.role,
              status: "FAILED",
              reason: dispatchResult.error || "Email provider rejected message",
            });
          }
        } else if (user.role === Role.SUPERVISOR) {
          const data = await this.getSupervisorDigestData(
            user.id,
            frequency === DigestFrequency.WEEKLY ? "weekly" : "daily"
          );

          const html = this.renderSupervisorDigestHtml(data, baseUrl);
          const dispatchResult = await EmailService.sendDigestEmail({
            to: user.email,
            recipientName: user.name,
            role: user.role,
            subject: `Operations Queue Digest: ${data.metrics.totalOpenTickets} Total Open Tickets`,
            htmlContent: html,
          });

          await prisma.user.update({
            where: { id: user.id },
            data: { digestLastSentAt: new Date() },
          });

          if (dispatchResult.success) {
            results.sentCount++;
            results.deliveries.push({
              userId: user.id,
              userName: user.name,
              role: user.role,
              status: "SENT",
            });
          } else {
            results.failedCount++;
            results.deliveries.push({
              userId: user.id,
              userName: user.name,
              role: user.role,
              status: "FAILED",
              reason: dispatchResult.error || "Email provider rejected message",
            });
          }
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
