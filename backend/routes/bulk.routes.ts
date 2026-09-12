import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { BulkController } from "@/controllers/bulk.controller";

export async function bulkActionRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ticketIds, action, targetAssigneeId, targetStatus, targetPriority } = body;

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json(
        { error: "ticketIds array is required and cannot be empty." },
        { status: 400 }
      );
    }

    const validActions = ["REASSIGN", "CLOSE", "CHANGE_STATUS", "CHANGE_PRIORITY", "ARCHIVE"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(", ")}.` },
        { status: 400 }
      );
    }

    const result = await BulkController.executeBulkAction(
      ticketIds,
      action,
      { targetAssigneeId, targetStatus, targetPriority },
      user
    );

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message.includes("Supervisors") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
