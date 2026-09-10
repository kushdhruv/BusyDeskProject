import { archiveTicketRoute } from "@/routes/ticket.routes";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  return archiveTicketRoute(req, params);
}
