import { addAgentReplyRoute } from "@/routes/reply.routes";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  return addAgentReplyRoute(req, params);
}
