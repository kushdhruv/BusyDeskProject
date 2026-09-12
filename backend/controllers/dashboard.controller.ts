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

    // Check in-memory cache to eliminate repetitive 9-query database storms
    const cacheKey = user ? `${user.id}_${user.role}` : "anonymous";
    const cached = metricsCache.get(cacheKey);
    if (cached && now.getTime() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // 2. Internal Staff (Agent / Supervisor) Metrics
    // Align start of current week to UTC Monday 00:00:00 (ISO 8601 standard)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getUTCDay();
    const diff = startOfWeek.getUTCDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setUTCDate(diff);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    eightWeeksAgo.setUTCHours(0, 0, 0, 0);

    const isAgent = user && user.role === Role.AGENT;
    const openTicketsWhere: any = {
      archivedAt: null,
      status: { in: [Status.NEW, Status.OPEN] },
    };

    if (isAgent) {
      openTicketsWhere.OR = [
        { primaryAssigneeId: user.id },
        { collaborators: { some: { userId: user.id } } },
      ];
    }

    const [
      openCount,
      pendingCount,
      resolvedThisWeekCount,
      breachedCount,
      statusGroups,
      agentBreakdown,
      sqlWeeklyTrend,
      csatAggregate,
      csatGroups,
      rawRecentReviews,
    ] = await Promise.all([
      prisma.ticket.count({
        where: openTicketsWhere,
      }),
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: Status.PENDING,
          ...(isAgent
            ? {
                OR: [
                  { primaryAssigneeId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              }
            : {}),
        },
      }),
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: { in: [Status.RESOLVED, Status.CLOSED] },
          resolvedAt: { gte: startOfWeek },
          ...(isAgent
            ? {
                OR: [
                  { primaryAssigneeId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              }
            : {}),
        },
      }),
      prisma.ticket.count({
        where: {
          archivedAt: null,
          status: { in: [Status.NEW, Status.OPEN] },
          slaDueAt: { lte: now },
          ...(isAgent
            ? {
                OR: [
                  { primaryAssigneeId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              }
            : {}),
        },
      }),
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { archivedAt: null },
      }),
      // Set-based Agent Workload: eliminates loading nested ticket ID relations into Node heap
      prisma.$queryRaw<
        Array<{ agentId: string; agentName: string; agentEmail: string; activeTicketsCount: number }>
      >`
        SELECT 
          u.id AS "agentId", 
          u.name AS "agentName", 
          u.email AS "agentEmail", 
          COUNT(t.id)::int AS "activeTicketsCount"
        FROM users u
        LEFT JOIN tickets t ON t."primaryAssigneeId" = u.id
          AND t."archivedAt" IS NULL
          AND t.status IN ('NEW', 'OPEN', 'PENDING')
        WHERE u.role = 'AGENT'
        GROUP BY u.id, u.name, u.email
        ORDER BY "activeTicketsCount" DESC;
      `,
      // Set-based 8-Week Trend: date_trunc('week', ...) executed directly in PostgreSQL
      prisma.$queryRaw<Array<{ week_start: string; count: number }>>`
        SELECT 
          to_char(date_trunc('week', "resolvedAt"), 'YYYY-MM-DD') AS week_start,
          COUNT(*)::int AS count
        FROM tickets
        WHERE "archivedAt" IS NULL
          AND "resolvedAt" >= ${eightWeeksAgo}
        GROUP BY 1
        ORDER BY 1 ASC;
      `,
      prisma.customerSatisfaction.aggregate({
        where: isAgent
          ? {
              ticket: {
                OR: [
                  { primaryAssigneeId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              },
            }
          : {},
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.customerSatisfaction.groupBy({
        where: isAgent
          ? {
              ticket: {
                OR: [
                  { primaryAssigneeId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              },
            }
          : {},
        by: ["rating"],
        _count: { id: true },
      }),
      prisma.customerSatisfaction.findMany({
        where: isAgent
          ? {
              ticket: {
                OR: [
                  { primaryAssigneeId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              },
            }
          : {},
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          ticket: {
            select: {
              id: true,
              ticketNumber: true,
              subject: true,
              primaryAssignee: {
                select: { id: true, name: true },
              },
            },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    const allStatuses = [Status.NEW, Status.OPEN, Status.PENDING, Status.RESOLVED, Status.CLOSED];
    const statusMap = new Map(statusGroups.map((g) => [g.status, g._count.id]));
    const statusBreakdown = allStatuses.map((s) => ({
      status: s,
      count: statusMap.get(s) || 0,
    }));

    // Build 8 continuous Monday-aligned weekly buckets
    const weeklyBuckets: { [weekKey: string]: { label: string; start: string; count: number } } = {};
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const wDay = weekStart.getUTCDay();
      const wDiff = weekStart.getUTCDate() - wDay + (wDay === 0 ? -6 : 1);
      weekStart.setUTCDate(wDiff);
      weekStart.setUTCHours(0, 0, 0, 0);

      const monthName = weekStart.toLocaleString("default", { month: "short", timeZone: "UTC" });
      const dayNum = weekStart.getUTCDate();
      const weekKey = weekStart.toISOString().split("T")[0];
      weeklyBuckets[weekKey] = {
        label: `${monthName} ${dayNum < 10 ? "0" + dayNum : dayNum}`,
        start: weekKey,
        count: 0,
      };
    }

    // Merge SQL date_trunc counts into the continuous weekly buckets
    for (const row of sqlWeeklyTrend) {
      if (weeklyBuckets[row.week_start]) {
        weeklyBuckets[row.week_start].count = row.count;
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

    // True active SLA compliance rate
    const activeTicketsTotal = openCount + pendingCount;
    const slaComplianceRate =
      activeTicketsTotal > 0
        ? Math.max(0, Math.min(100, Math.round(((activeTicketsTotal - breachedCount) / activeTicketsTotal) * 100)))
        : 100;

    const recentReviews = rawRecentReviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      ticket: {
        id: r.ticket.id,
        ticketNumber: r.ticket.ticketNumber,
        subject: r.ticket.subject,
        primaryAssignee: r.ticket.primaryAssignee
          ? { id: r.ticket.primaryAssignee.id, name: r.ticket.primaryAssignee.name }
          : null,
      },
      user: {
        id: r.user?.id || "",
        name: r.user?.name || "Customer",
        email: r.user?.email || "",
      },
    }));

    const result: DashboardMetrics = {
      openTicketsCount: openCount,
      pendingOnCustomerCount: pendingCount,
      resolvedThisWeekCount,
      breachingSlaCount: breachedCount,
      slaComplianceRate,
      statusBreakdown,
      agentBreakdown,
      weeklyResolutionTrend,
      averageCsatRating,
      csatResponseCount,
      csatRatingDistribution,
      recentReviews,
    };

    metricsCache.set(cacheKey, { data: result, timestamp: now.getTime() });
    return result;
  }
}

// Global in-memory cache for dashboard metrics (15-second TTL)
const metricsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 15000;

export function invalidateMetricsCache() {
  metricsCache.clear();
}

export const DashboardService = DashboardController;
