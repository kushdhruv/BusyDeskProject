import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { SlaService } from "@/lib/services/SlaService";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await SlaService.getActiveAlerts(user);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch SLA alerts." },
      { status: 500 }
    );
  }
}
