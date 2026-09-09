import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { AuthService } from "@/lib/services/AuthService";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await AuthService.getAllUsers();
  return NextResponse.json({ users });
}
