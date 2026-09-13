/**
 * Reviews API Routes
 * Handlers for customer reviews retrieval and agent CSAT scorecards.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { Role } from "@prisma/client";
import { ReviewsController, AgentSortOption } from "@/controllers/reviews.controller";

/**
 * GET /api/reviews
 * Fetch paginated customer satisfaction reviews with role-based scoping:
 * - Supervisors can view all reviews or filter by any agent.
 * - Agents can only view their own reviews.
 */
export async function getAllReviewsRoute(req: Request): Promise<NextResponse> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") || undefined;
    const ratingStr = url.searchParams.get("rating");
    const rating = ratingStr ? parseInt(ratingStr, 10) : undefined;
    const search = url.searchParams.get("search") || undefined;
    const limitStr = url.searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offsetStr = url.searchParams.get("offset");
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    const data = await ReviewsController.getAllReviews(
      {
        agentId,
        rating,
        search,
        limit,
        offset,
      },
      sessionUser
    );

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve reviews." },
      { status: 400 }
    );
  }
}

/**
 * GET /api/reviews/agents
 * Fetch team-wide agent CSAT performance scorecards sorted by highest/lowest ratings.
 * STRICTLY restricted to supervisors.
 */
export async function getAgentPerformanceRoute(req: Request): Promise<NextResponse> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== Role.SUPERVISOR) {
      return NextResponse.json(
        { error: "Forbidden: Only supervisors can access team-wide agent performance rankings." },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const sortBy = (url.searchParams.get("sortBy") as AgentSortOption) || "rating_desc";

    const agents = await ReviewsController.getAgentPerformanceSummary(sortBy, sessionUser);
    return NextResponse.json({ agents });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve agent performance." },
      { status: 400 }
    );
  }
}

