import { NextResponse } from "next/server";
import { AuthService } from "@/lib/services/AuthService";
import { setSessionCookie } from "@/lib/auth";

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

    const user = await AuthService.authenticate(email, password);
    await setSessionCookie(user);

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Authentication failed." },
      { status: 401 }
    );
  }
}
