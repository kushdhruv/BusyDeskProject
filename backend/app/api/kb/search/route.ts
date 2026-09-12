import { searchKnowledgeBaseRoute } from "@/routes/recommendation.routes";

export async function GET(req: Request) {
  return searchKnowledgeBaseRoute(req);
}
