import { getTicketRecommendationsRoute } from "@/routes/recommendation.routes";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: Request, { params }: RouteParams) {
  return getTicketRecommendationsRoute(req, params);
}
