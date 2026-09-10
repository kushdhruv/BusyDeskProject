import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { TicketController } from "@/controllers/ticket.controller";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await TicketController.archive(params.id, user);
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
