import { submitCsatRoute } from "@/routes/csat.routes";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  return submitCsatRoute(req, params);
}
