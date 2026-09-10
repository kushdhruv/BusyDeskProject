import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/middlewares/auth.middleware";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
