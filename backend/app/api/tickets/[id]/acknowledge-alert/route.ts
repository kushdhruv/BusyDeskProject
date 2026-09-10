import { acknowledgeAlertRoute } from "@/routes/sla.routes";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  return acknowledgeAlertRoute(req, params);
}
