import { logRecommendationFeedbackRoute } from "@/routes/recommendation.routes";

export async function POST(req: Request) {
  return logRecommendationFeedbackRoute(req);
}
