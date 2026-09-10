import { NextResponse } from "next/server";
import { AuthController } from "@/controllers/auth.controller";
import { setSessionCookie, clearSessionCookie, getSessionUser } from "@/middlewares/auth.middleware";

export async function loginRoute(req: Request): Promise<NextResponse> {
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

export async function logoutRoute(): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}

export async function meRoute(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function registerRoute(req: Request): Promise<NextResponse> {
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
