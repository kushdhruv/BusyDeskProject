import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { TicketController } from "@/controllers/ticket.controller";
import { Status } from "@prisma/client";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !Object.values(Status).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${Object.values(Status).join(", ")}` },
        { status: 400 }
      );
    }

    const ticket = await TicketController.changeStatus(params.id, status as Status, user);
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const isPermission = error.message.includes("permission") || error.message.includes("Supervisors are authorized");
    const status = isPermission ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
