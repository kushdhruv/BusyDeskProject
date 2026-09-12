import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { RecommendationController } from "@/controllers/recommendation.controller";

/**
 * GET /api/tickets/[id]/recommendations
 * Retrieves semantic solution recommendations for an active ticket.
 */
export async function getTicketRecommendationsRoute(
  _req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recommendations = await RecommendationController.getTicketRecommendations(
      params.id,
      user
    );

    return NextResponse.json(recommendations, { status: 200 });
  } catch (error: any) {
    const status =
      error.message.includes("Forbidden") || error.message.includes("permission")
        ? 403
        : error.message.includes("not found")
        ? 404
        : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

/**
 * GET /api/kb/search
 * Public semantic search over Knowledge Base articles.
 */
export async function searchKnowledgeBaseRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";

    const results = await RecommendationController.searchKnowledgeBase(query, user);
    return NextResponse.json({ results }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/recommendations/feedback
 * Logs agent interaction telemetry for ranking optimization.
 */
export async function logRecommendationFeedbackRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await RecommendationController.logFeedback(body, user);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    const status = error.message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
