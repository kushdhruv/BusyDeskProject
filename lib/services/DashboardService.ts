import { Status, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { DashboardMetrics } from "../types";

export class DashboardService {
  static async getMetrics(): Promise<DashboardMetrics> {
    const now = new Date();

    // Calculate start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // 8 Weeks ago timestamp
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    eightWeeksAgo.setHours(0, 0, 0, 0);

    // Execute parallel aggregation queries
    const [
      openCount,
      pendingCount,
      resolvedThisWeekCount,
      breachedCount,
      statusGroups,
      agents,
      resolvedTickets8Weeks,
    ] = await Promise.all([
      // 1. Open tickets (NEW or OPEN, active)
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: { in: [Status.NEW, Status.OPEN] },
        },
      }),

      // 2. Pending on customer
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: Status.PENDING,
        },
      }),

      // 3. Resolved this week
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: { in: [Status.RESOLVED, Status.CLOSED] },
          resolvedAt: { gte: startOfWeek },
        },
      }),

      // 4. Breaching SLA
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: { in: [Status.NEW, Status.OPEN] },
          slaDueAt: { lte: now },
        },
      }),

      // 5. Status breakdown
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { archivedAt: null },
      }),

      // 6. Agents with their active ticket counts
      prisma.user.findMany({
        where: { role: Role.AGENT },
        select: {
          id: true,
          name: true,
          email: true,
          assignedTickets: {
            where: {
              archivedAt: null,
              status: { in: [Status.NEW, Status.OPEN, Status.PENDING] },
            },
            select: { id: true },
          },
        },
      }),

      // 7. 8-Week historical resolutions for trend chart
      prisma.ticket.findMany({
        where: {
          archivedAt: null,
          resolvedAt: { gte: eightWeeksAgo },
        },
        select: {
          resolvedAt: true,
        },
      }),
    ]);

    // Format status breakdown
    const allStatuses = [Status.NEW, Status.OPEN, Status.PENDING, Status.RESOLVED, Status.CLOSED];
    const statusMap = new Map(statusGroups.map((g) => [g.status, g._count.id]));
    const statusBreakdown = allStatuses.map((s) => ({
      status: s,
      count: statusMap.get(s) || 0,
    }));

    // Format agent breakdown
    const agentBreakdown = agents.map((a) => ({
      agentId: a.id,
      agentName: a.name,
      agentEmail: a.email,
      activeTicketsCount: a.assignedTickets.length,
    }));

    // Build 8 continuous weekly buckets
    const weeklyBuckets: { [weekKey: string]: { label: string; start: string; count: number } } = {};
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const wDay = weekStart.getDay();
      const wDiff = weekStart.getDate() - wDay + (wDay === 0 ? -6 : 1);
      weekStart.setDate(wDiff);
      weekStart.setHours(0, 0, 0, 0);

      const monthName = weekStart.toLocaleString("default", { month: "short" });
      const dayNum = weekStart.getDate();
      const weekKey = weekStart.toISOString().split("T")[0];
      weeklyBuckets[weekKey] = {
        label: `${monthName} ${dayNum < 10 ? "0" + dayNum : dayNum}`,
        start: weekKey,
        count: 0,
      };
    }

    // Populate counts into buckets
    for (const t of resolvedTickets8Weeks) {
      if (!t.resolvedAt) continue;
      const rDate = new Date(t.resolvedAt);
      const rDay = rDate.getDay();
      const rDiff = rDate.getDate() - rDay + (rDay === 0 ? -6 : 1);
      const bucketStart = new Date(rDate);
      bucketStart.setDate(rDiff);
      bucketStart.setHours(0, 0, 0, 0);
      const bucketKey = bucketStart.toISOString().split("T")[0];

      if (weeklyBuckets[bucketKey]) {
        weeklyBuckets[bucketKey].count++;
      }
    }

    const weeklyResolutionTrend = Object.values(weeklyBuckets).map((b) => ({
      weekLabel: b.label,
      weekStart: b.start,
      resolvedCount: b.count,
    }));

    return {
      openTicketsCount: openCount,
      pendingOnCustomerCount: pendingCount,
      resolvedThisWeekCount,
      breachingSlaCount: breachedCount,
      statusBreakdown,
      agentBreakdown,
      weeklyResolutionTrend,
    };
  }
}
