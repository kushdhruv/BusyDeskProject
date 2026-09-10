import { NextResponse } from "next/server";
import { AuthController } from "@/controllers/auth.controller";
import { setSessionCookie } from "@/middlewares/auth.middleware";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    const user = await AuthController.register({ email, password, name });
    await setSessionCookie(user);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Registration failed." },
      { status: 400 }
    );
  }
}
