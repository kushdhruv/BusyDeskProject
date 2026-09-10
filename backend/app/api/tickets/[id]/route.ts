import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { TicketController } from "@/controllers/ticket.controller";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await TicketController.getTicketDetails(params.id, user);
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : error.message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const ticket = await TicketController.updateTicketDetails(params.id, body, user);
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
