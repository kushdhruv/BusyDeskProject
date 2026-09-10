import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { DashboardController } from "@/controllers/dashboard.controller";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metrics = await DashboardController.getMetrics(user);
    return NextResponse.json(metrics);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard metrics." },
      { status: 500 }
    );
  }
}
