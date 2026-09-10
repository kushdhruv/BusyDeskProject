import { getTicketByIdRoute, updateTicketRoute } from "@/routes/ticket.routes";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: Request, { params }: RouteParams) {
  return getTicketByIdRoute(req, params);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  return updateTicketRoute(req, params);
}
