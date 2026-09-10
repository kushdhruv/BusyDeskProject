import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { BulkService } from "@/lib/services/BulkService";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ticketIds, action, targetAssigneeId } = body;

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json(
        { error: "ticketIds array is required and cannot be empty." },
        { status: 400 }
      );
    }

    if (action !== "REASSIGN" && action !== "CLOSE") {
      return NextResponse.json(
        { error: "action must be either 'REASSIGN' or 'CLOSE'." },
        { status: 400 }
      );
    }

    const result = await BulkService.executeBulkAction(
      ticketIds,
      action,
      { targetAssigneeId },
      user
    );

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message.includes("Supervisors") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
