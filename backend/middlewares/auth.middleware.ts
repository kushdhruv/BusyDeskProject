/**
 * Authentication & Authorization Middleware
 * Manages JWT session tokens, cookie lifecycle, and role-based route guard helpers.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "../db/prisma.db";
import { SessionUser, Role } from "../models/types.model";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../utils/constants.util";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "default-secret-key-that-is-at-least-32-characters-long"
);

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (!payload || !payload.id || !payload.email || !payload.role) {
      return null;
    }
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: (payload.name as string) || "",
      role: payload.role as SessionUser["role"],
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const cookieStore = cookies();
  const isProd = process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Route Guard: Ensures a valid authenticated user session exists.
 */
export async function requireAuth(): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

/**
 * Route Guard: Ensures the authenticated user has one of the allowed roles.
 */
export async function requireRole(
  allowedRoles: Role[]
): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const auth = await requireAuth();
  if ("error" in auth) return auth;

  if (!allowedRoles.includes(auth.user.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden: Insufficient role permissions" }, { status: 403 }),
    };
  }

  return { user: auth.user };
}
