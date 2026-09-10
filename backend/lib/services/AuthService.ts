import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { SessionUser } from "../types";

export class AuthService {
  static async authenticate(email: string, password: string): Promise<SessionUser> {
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid email or password.");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  static async register(data: { email: string; password: string; name: string }): Promise<SessionUser> {
    const { email, password, name } = data;

    if (!email || !password || !name) {
      throw new Error("Full name, email address, and password are required.");
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("Please provide a valid email address.");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    if (cleanName.length < 2) {
      throw new Error("Name must be at least 2 characters long.");
    }

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      throw new Error("An account with this email address already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // SECURITY INVARIANT: Public registration strictly creates Role.CUSTOMER only
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: cleanName,
        passwordHash,
        role: Role.CUSTOMER,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  static async getAllUsers() {
    return prisma.user.findMany({
      where: { role: { in: [Role.SUPERVISOR, Role.AGENT] } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  }
}
