import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { AuthController } from "@/controllers/auth.controller";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await AuthController.getAllUsers();
  return NextResponse.json({ users });
}
