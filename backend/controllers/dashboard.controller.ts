/**
 * Dashboard Controller
 * Computes performance analytics, operational counts, SLA health, and customer CSAT metrics.
 */

import { Status, Role } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { DashboardMetrics, CustomerDashboardMetrics, SessionUser } from "../models/types.model";

export class DashboardController {
  /**
   * Aggregates live system metrics with role-specific privacy views.
   */
  static async getMetrics(user?: SessionUser): Promise<DashboardMetrics | CustomerDashboardMetrics> {
    const now = new Date();

    // 1. Customer Scoped Metrics
    if (user && user.role === Role.CUSTOMER) {
      const [totalCount, openCount, pendingCount, resolvedCount] = await Promise.all([
        prisma.ticket.count({
          where: { requesterId: user.id, archivedAt: null },
        }),
        prisma.ticket.count({
          where: { requesterId: user.id, archivedAt: null, status: { in: [Status.NEW, Status.OPEN] } },
        }),
        prisma.ticket.count({
          where: { requesterId: user.id, archivedAt: null, status: Status.PENDING },
        }),
        prisma.ticket.count({
          where: { requesterId: user.id, archivedAt: null, status: { in: [Status.RESOLVED, Status.CLOSED] } },
        }),
      ]);

      return {
        totalTicketsCount: totalCount,
        openTicketsCount: openCount,
        pendingOnCustomerCount: pendingCount,
        resolvedTicketsCount: resolvedCount,
      };
    }

    // 2. Internal Staff (Agent / Supervisor) Metrics
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    eightWeeksAgo.setHours(0, 0, 0, 0);

    const [
      openCount,
      pendingCount,
      resolvedThisWeekCount,
      breachedCount,
      statusGroups,
      agents,
      resolvedTickets8Weeks,
      csatAggregate,
      csatGroups,
    ] = await Promise.all([
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: { in: [Status.NEW, Status.OPEN] },
        },
      }),
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: Status.PENDING,
        },
      }),
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: { in: [Status.RESOLVED, Status.CLOSED] },
          resolvedAt: { gte: startOfWeek },
        },
      }),
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: { in: [Status.NEW, Status.OPEN] },
          slaDueAt: { lte: now },
        },
      }),
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { archivedAt: null },
      }),
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
      prisma.ticket.findMany({
        where: {
          archivedAt: null,
          resolvedAt: { gte: eightWeeksAgo },
        },
        select: {
          resolvedAt: true,
        },
      }),
      prisma.customerSatisfaction.aggregate({
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.customerSatisfaction.groupBy({
        by: ["rating"],
        _count: { id: true },
      }),
    ]);

    const allStatuses = [Status.NEW, Status.OPEN, Status.PENDING, Status.RESOLVED, Status.CLOSED];
    const statusMap = new Map(statusGroups.map((g) => [g.status, g._count.id]));
    const statusBreakdown = allStatuses.map((s) => ({
      status: s,
      count: statusMap.get(s) || 0,
    }));

    const agentBreakdown = agents.map((a) => ({
      agentId: a.id,
      agentName: a.name,
      agentEmail: a.email,
      activeTicketsCount: a.assignedTickets.length,
    }));

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

    const csatDistMap = new Map(csatGroups.map((g) => [g.rating, g._count.id]));
    const csatRatingDistribution = [5, 4, 3, 2, 1].map((r) => ({
      rating: r,
      count: csatDistMap.get(r) || 0,
    }));

    const averageCsatRating = csatAggregate._avg.rating
      ? Number(csatAggregate._avg.rating.toFixed(1))
      : 0;
    const csatResponseCount = csatAggregate._count.id || 0;

    return {
      openTicketsCount: openCount,
      pendingOnCustomerCount: pendingCount,
      resolvedThisWeekCount,
      breachingSlaCount: breachedCount,
      statusBreakdown,
      agentBreakdown,
      weeklyResolutionTrend,
      averageCsatRating,
      csatResponseCount,
      csatRatingDistribution,
    };
  }
}

export const DashboardService = DashboardController;
