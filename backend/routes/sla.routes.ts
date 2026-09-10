import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { SlaController } from "@/controllers/sla.controller";

export async function getSlaAlertsRoute(): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await SlaController.getActiveAlerts(user);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch SLA alerts." },
      { status: 500 }
    );
  }
}

export async function acknowledgeAlertRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: "alertId is required in request body." },
        { status: 400 }
      );
    }

    const alert = await SlaController.acknowledgeAlert(params.id, alertId, user);
    return NextResponse.json({ alert });
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
