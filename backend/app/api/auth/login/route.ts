import { NextResponse } from "next/server";
import { AuthController } from "@/controllers/auth.controller";
import { setSessionCookie } from "@/middlewares/auth.middleware";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await AuthController.authenticate(email, password);
    await setSessionCookie(user);

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Authentication failed." },
      { status: 401 }
    );
  }
}
