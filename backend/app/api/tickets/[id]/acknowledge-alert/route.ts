import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { SlaController } from "@/controllers/sla.controller";

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
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json({ error: "alertId is required in request body." }, { status: 400 });
    }

    const alert = await SlaController.acknowledgeAlert(params.id, alertId, user);
    return NextResponse.json({ alert });
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
