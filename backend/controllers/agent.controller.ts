/**
 * Agent Controller
 * Manages supervisor provisioning of agents, one-time invitation tokens, and team directory.
 */

import crypto from "crypto";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser } from "../models/types.model";
import { EmailService } from "../services/email.service";

export class AgentController {
  /**
   * Invites a new support agent by generating a secure 24-hour one-time setup token
   * and emailing them an activation link.
   * Security Invariant: Only SUPERVISOR can invoke this.
   */
  static async inviteAgent(
    supervisor: SessionUser,
    data: { name: string; email: string }
  ) {
    if (supervisor.role !== Role.SUPERVISOR) {
      throw new Error("Forbidden: Only supervisors can invite new agents.");
    }

    const { name, email } = data;
    if (!name || !email) {
      throw new Error("Agent name and work email are required.");
    }

    const cleanName = name.trim();
    const cleanEmail = email.toLowerCase().trim();

    if (cleanName.length < 2) {
      throw new Error("Agent name must be at least 2 characters long.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("Please provide a valid work email address.");
    }

    // Check if user exists
    let existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        invitations: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (existingUser && existingUser.status === UserStatus.ACTIVE) {
      throw new Error("An active account already exists with this email address.");
    }

    // Generate high-entropy 32-byte random one-time token
    const rawToken = crypto.randomBytes(32).toString("hex");
    // Hash token with SHA-256 for persistent database storage
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let user = existingUser;

    if (!user) {
      // Create user in PENDING_SETUP state with unmatchable sentinel passwordHash
      const sentinelHash = `!PENDING_SETUP_${Date.now()}_${crypto.randomBytes(8).toString("hex")}!`;
      user = await prisma.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          role: Role.AGENT,
          status: UserStatus.PENDING_SETUP,
          passwordHash: sentinelHash,
        },
        include: { invitations: true },
      });
    } else {
      // Invalidate any prior unused invitations
      await prisma.agentInvitation.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    }

    // Record the new cryptographically hashed invitation
    const invitation = await prisma.agentInvitation.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Build the frontend account setup URL
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const setupUrl = `${frontendUrl}/setup-account?token=${rawToken}`;

    // Dispatch transactional email via Resend or Dev Fallback
    const emailResult = await EmailService.sendAgentInvitation({
      to: cleanEmail,
      name: cleanName,
      role: "Agent",
      rawToken,
      setupUrl,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      invitation: {
        id: invitation.id,
        expiresAt: invitation.expiresAt,
      },
      setupUrl,
      deliveryMode: emailResult.mode,
      emailSent: emailResult.success,
    };
  }

  /**
   * Resends an invitation link with a freshly rotated 24-hour token.
   * Security Invariant: Only SUPERVISOR can invoke this.
   */
  static async resendInvitation(supervisor: SessionUser, agentId: string) {
    if (supervisor.role !== Role.SUPERVISOR) {
      throw new Error("Forbidden: Only supervisors can resend invitations.");
    }

    const user = await prisma.user.findUnique({
      where: { id: agentId },
    });

    if (!user) {
      throw new Error("Agent record not found.");
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new Error("This agent has already activated their account.");
    }

    // Invalidate existing unused invitations
    await prisma.agentInvitation.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate fresh token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const invitation = await prisma.agentInvitation.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const setupUrl = `${frontendUrl}/setup-account?token=${rawToken}`;

    const emailResult = await EmailService.sendAgentInvitation({
      to: user.email,
      name: user.name,
      role: user.role === Role.SUPERVISOR ? "Supervisor" : "Agent",
      rawToken,
      setupUrl,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      invitation: {
        id: invitation.id,
        expiresAt: invitation.expiresAt,
      },
      setupUrl,
      deliveryMode: emailResult.mode,
      emailSent: emailResult.success,
    };
  }

  /**
   * Retrieves the full internal staff directory with live workload metrics and invitation status.
   */
  static async getTeamDirectory(currentUser: SessionUser) {
    if (currentUser.role !== Role.SUPERVISOR && currentUser.role !== Role.AGENT) {
      throw new Error("Forbidden: Only internal staff can view the team directory.");
    }

    const users = await prisma.user.findMany({
      where: {
        role: { in: [Role.SUPERVISOR, Role.AGENT] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        assignedTickets: {
          where: {
            archivedAt: null,
            status: { in: ["NEW", "OPEN", "PENDING"] },
          },
          select: { id: true },
        },
        invitations: {
          where: { usedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            expiresAt: true,
          },
        },
      },
      orderBy: [
        { role: "asc" },
        { status: "asc" },
        { name: "asc" },
      ],
    });

    const now = new Date();

    return users.map((u) => {
      const activeInvitation = u.invitations[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        activeTicketCount: u.assignedTickets.length,
        pendingInvitation: activeInvitation
          ? {
              id: activeInvitation.id,
              expiresAt: activeInvitation.expiresAt,
              isExpired: activeInvitation.expiresAt < now,
            }
          : null,
      };
    });
  }
}
