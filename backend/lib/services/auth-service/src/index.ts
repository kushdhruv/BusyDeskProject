import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { Role } from "@prisma/client";
import { SessionUser } from "../../../types";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-for-session-tokens";
const encodedKey = new TextEncoder().encode(JWT_SECRET);

export class AuthService {
  static async verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async signSessionToken(user: SessionUser): Promise<string> {
    return new SignJWT({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(encodedKey);
  }

  static async verifySessionToken(token: string): Promise<SessionUser | null> {
    try {
      const { payload } = await jwtVerify(token, encodedKey, {
        algorithms: ["HS256"],
      });

      return {
        id: payload.id as string,
        email: payload.email as string,
        name: payload.name as string,
        role: payload.role as Role,
      };
    } catch {
      return null;
    }
  }

  static isSupervisor(user: SessionUser): boolean {
    return user.role === Role.SUPERVISOR;
  }
}
