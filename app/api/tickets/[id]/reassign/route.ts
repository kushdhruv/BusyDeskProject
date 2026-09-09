import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { TicketService } from "@/lib/services/TicketService";

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
    const { primaryAssigneeId } = body;

    const ticket = await TicketService.reassign(params.id, primaryAssigneeId || null, user);
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const status = error.message.includes("Supervisors") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
