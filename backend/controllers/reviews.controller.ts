/**
 * Reviews & Agent Performance Controller
 * Aggregates customer satisfaction ratings, individual agent scorecards, and review feeds.
 */

import { Role, Status } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser } from "../models/types.model";

export interface ReviewFilters {
  agentId?: string;
  rating?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export type AgentSortOption =
  | "rating_asc"
  | "rating_desc"
  | "reviews_desc"
  | "resolved_desc"
  | "name_asc";

export class ReviewsController {
  /**
   * Retrieves customer reviews with role-based scoping:
   * - Supervisor: Can view all reviews or filter by any agentId.
   * - Agent: Strictly restricted to their own reviews (where ticket.primaryAssigneeId === user.id).
   * - Customer: Strictly restricted to reviews they submitted (where userId === user.id).
   */
  static async getAllReviews(filters: ReviewFilters = {}, sessionUser?: SessionUser) {
    const { rating, search, limit = 50, offset = 0 } = filters;
    let agentId = filters.agentId;

    const whereClause: any = {};
    const summaryWhere: any = {};

    // Role-based privacy enforcement
    if (sessionUser?.role === Role.AGENT) {
      // Support agents can ONLY view reviews on tickets where they are primary assignee
      agentId = sessionUser.id;
      whereClause.ticket = {
        primaryAssigneeId: sessionUser.id,
      };
      summaryWhere.ticket = {
        primaryAssigneeId: sessionUser.id,
      };
    } else if (sessionUser?.role === Role.CUSTOMER) {
      // Customers can only view reviews they submitted
      whereClause.userId = sessionUser.id;
      summaryWhere.userId = sessionUser.id;
    } else {
      // Supervisor or system caller: can filter by specific agentId if provided
      if (agentId && agentId !== "all") {
        whereClause.ticket = {
          primaryAssigneeId: agentId,
        };
        summaryWhere.ticket = {
          primaryAssigneeId: agentId,
        };
      }
    }

    if (rating && rating >= 1 && rating <= 5) {
      whereClause.rating = rating;
    }

    if (search && search.trim().length > 0) {
      const cleanSearch = search.trim();
      whereClause.OR = [
        { comment: { contains: cleanSearch, mode: "insensitive" } },
        { user: { name: { contains: cleanSearch, mode: "insensitive" } } },
        { ticket: { subject: { contains: cleanSearch, mode: "insensitive" } } },
      ];
    }

    const [reviews, totalCount] = await Promise.all([
      prisma.customerSatisfaction.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
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
              status: true,
              primaryAssignee: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.customerSatisfaction.count({ where: whereClause }),
    ]);

    // Scoped summary metrics
    const allRatings = await prisma.customerSatisfaction.findMany({
      where: summaryWhere,
      select: { rating: true },
    });

    const totalRatingsCount = allRatings.length;
    const avgScore =
      totalRatingsCount > 0
        ? Number(
            (
              allRatings.reduce((acc, r) => acc + r.rating, 0) /
              totalRatingsCount
            ).toFixed(2)
          )
        : 0;

    const positiveCount = allRatings.filter((r) => r.rating >= 4).length;
    const satisfactionPercentage =
      totalRatingsCount > 0
        ? Math.round((positiveCount / totalRatingsCount) * 100)
        : 0;

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of allRatings) {
      if (r.rating in distribution) {
        distribution[r.rating as keyof typeof distribution]++;
      }
    }

    return {
      reviews,
      totalCount,
      summary: {
        totalReviews: totalRatingsCount,
        averageRating: avgScore,
        satisfactionRate: satisfactionPercentage,
        distribution,
      },
    };
  }

  /**
   * Generates a performance scorecard for every support agent with sorting capabilities.
   * Strictly restricted to SUPERVISOR role.
   */
  static async getAgentPerformanceSummary(
    sortBy: AgentSortOption = "rating_desc",
    sessionUser?: SessionUser
  ) {
    if (sessionUser && sessionUser.role !== Role.SUPERVISOR) {
      throw new Error("Forbidden: Only supervisors can view all agents' performance rankings.");
    }
    // 1. Fetch internal support agents & supervisors
    const agents = await prisma.user.findMany({
      where: { role: { in: [Role.SUPERVISOR, Role.AGENT] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // 2. Fetch all resolved tickets per agent
    const resolvedTickets = await prisma.ticket.groupBy({
      by: ["primaryAssigneeId"],
      _count: { id: true },
      where: {
        archivedAt: null,
        status: { in: [Status.RESOLVED, Status.CLOSED] },
        primaryAssigneeId: { not: null },
      },
    });

    const resolvedMap = new Map<string, number>();
    for (const item of resolvedTickets) {
      if (item.primaryAssigneeId) {
        resolvedMap.set(item.primaryAssigneeId, item._count.id);
      }
    }

    // 3. Fetch all reviews grouped by ticket primary assignee
    const reviewsWithAssignee = await prisma.customerSatisfaction.findMany({
      select: {
        rating: true,
        ticket: {
          select: {
            primaryAssigneeId: true,
          },
        },
      },
    });

    // Bucket ratings by agent ID
    const agentReviewsMap = new Map<string, number[]>();
    for (const rev of reviewsWithAssignee) {
      const assigneeId = rev.ticket.primaryAssigneeId;
      if (assigneeId) {
        if (!agentReviewsMap.has(assigneeId)) {
          agentReviewsMap.set(assigneeId, []);
        }
        agentReviewsMap.get(assigneeId)!.push(rev.rating);
      }
    }

    // 4. Compute metrics per agent
    const performanceList = agents.map((agent) => {
      const ratings = agentReviewsMap.get(agent.id) || [];
      const totalReviews = ratings.length;
      const totalScore = ratings.reduce((a, b) => a + b, 0);
      const averageRating =
        totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(2)) : 0;

      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      for (const r of ratings) {
        if (r in distribution) {
          distribution[r as keyof typeof distribution]++;
        }
      }

      const positiveCount = distribution[5] + distribution[4];
      const satisfactionRate =
        totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0;

      const totalResolved = resolvedMap.get(agent.id) || 0;

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        status: agent.status,
        totalResolvedTickets: totalResolved,
        totalReviews,
        averageRating,
        satisfactionRate,
        distribution,
      };
    });

    // 5. Apply requested sorting
    performanceList.sort((a, b) => {
      switch (sortBy) {
        case "rating_asc":
          // Agents with reviews sorted ascending (lowest first), followed by 0-review agents
          if (a.totalReviews === 0 && b.totalReviews > 0) return 1;
          if (b.totalReviews === 0 && a.totalReviews > 0) return -1;
          if (a.averageRating !== b.averageRating) {
            return a.averageRating - b.averageRating;
          }
          return b.totalReviews - a.totalReviews;

        case "rating_desc":
          // Highest average first
          if (a.averageRating !== b.averageRating) {
            return b.averageRating - a.averageRating;
          }
          return b.totalReviews - a.totalReviews;

        case "reviews_desc":
          return b.totalReviews - a.totalReviews;

        case "resolved_desc":
          return b.totalResolvedTickets - a.totalResolvedTickets;

        case "name_asc":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return performanceList;
  }
}
