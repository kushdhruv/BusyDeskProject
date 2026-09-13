/**
 * Email Digest API Routes
 * HTTP route handlers for digest preferences, live preview, and Vercel Cron dispatch.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { DigestController } from "@/controllers/digest.controller";
import { DigestFrequency } from "@prisma/client";

export async function getDigestPreferencesRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await DigestController.getMyPreferences(user);
    return NextResponse.json({ preferences });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve digest preferences." },
      { status: 400 }
    );
  }
}

export async function updateDigestPreferencesRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const preferences = await DigestController.updateMyPreferences(user, body);
    return NextResponse.json({ preferences });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update digest preferences." },
      { status: 400 }
    );
  }
}

export async function previewDigestRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "agent";
    const agentId = searchParams.get("agentId") || undefined;
    const period = (searchParams.get("period") as "daily" | "weekly") || "daily";

    if (type === "supervisor") {
      const result = await DigestController.previewSupervisorDigest(user, period);
      return NextResponse.json(result);
    } else {
      const result = await DigestController.previewAgentDigest(user, agentId, period);
      return NextResponse.json(result);
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate digest preview." },
      { status: 400 }
    );
  }
}

export async function triggerCronDigestRoute(req: Request): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getSessionUser();

    const { searchParams } = new URL(req.url);
    const frequencyParam = searchParams.get("frequency")?.toUpperCase();
    const frequency =
      frequencyParam === "WEEKLY" ? DigestFrequency.WEEKLY : DigestFrequency.DAILY;
    const forceAll = searchParams.get("force") === "true";

    const results = await DigestController.triggerCron(
      authHeader,
      user,
      frequency,
      forceAll
    );

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to trigger cron digest." },
      { status: 401 }
    );
  }
}
