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
    data: { name: string; email: string },
    origin?: string
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

    // Build the frontend account setup URL (dynamically resolves the real frontend URL from the browser's request)
    const frontendUrl =
      origin && !origin.includes("localhost")
        ? origin
        : (process.env.FRONTEND_URL || origin || "http://localhost:3000");
    const setupUrl = `${frontendUrl}/setup-account?token=${rawToken}`;

    // Dispatch transactional email via SMTP, Vercel HTTPS Relay, or Resend
    const emailResult = await EmailService.sendAgentInvitation({
      to: cleanEmail,
      name: cleanName,
      role: "Agent",
      rawToken,
      setupUrl,
      frontendUrl,
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
      emailError: emailResult.error,
    };
  }

  /**
   * Resends an invitation link with a freshly rotated 24-hour token.
   * Security Invariant: Only SUPERVISOR can invoke this.
   */
  static async resendInvitation(
    supervisor: SessionUser,
    agentId: string,
    origin?: string
  ) {
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

    const frontendUrl =
      origin && !origin.includes("localhost")
        ? origin
        : (process.env.FRONTEND_URL || origin || "http://localhost:3000");
    const setupUrl = `${frontendUrl}/setup-account?token=${rawToken}`;

    const emailResult = await EmailService.sendAgentInvitation({
      to: user.email,
      name: user.name,
      role: user.role === Role.SUPERVISOR ? "Supervisor" : "Agent",
      rawToken,
      setupUrl,
      frontendUrl,
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
      emailError: emailResult.error,
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

  /**
   * Updates an agent's role (SUPERVISOR <-> AGENT) and/or account status (ACTIVE <-> SUSPENDED).
   * Supports atomic bulk reassignment of active tickets when suspending an agent.
   * Security Invariant: Only SUPERVISOR can invoke this.
   */
  static async updateAgent(
    supervisor: SessionUser,
    agentId: string,
    data: {
      role?: Role;
      status?: UserStatus;
      reassignTicketsToId?: string | null;
    }
  ) {
    if (supervisor.role !== Role.SUPERVISOR) {
      throw new Error("Forbidden: Only supervisors can update staff roles and account statuses.");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: agentId },
      include: {
        assignedTickets: {
          where: {
            archivedAt: null,
            status: { in: ["NEW", "OPEN", "PENDING"] },
          },
          select: { id: true, ticketNumber: true, subject: true },
        },
      },
    });

    if (!targetUser) {
      throw new Error("Agent record not found.");
    }

    if (targetUser.role === Role.CUSTOMER) {
      throw new Error("Invalid operation: Cannot manage customer accounts through staff administration.");
    }

    // Safeguard 1: Prevent self-suspension
    if (supervisor.id === agentId && data.status === UserStatus.SUSPENDED) {
      throw new Error("Security constraint: You cannot suspend your own supervisor account.");
    }

    // Safeguard 2: Prevent leaving zero active supervisors if demoting or suspending
    if (
      (data.role === Role.AGENT && targetUser.role === Role.SUPERVISOR) ||
      (data.status === UserStatus.SUSPENDED && targetUser.role === Role.SUPERVISOR)
    ) {
      const activeSupervisorCount = await prisma.user.count({
        where: {
          role: Role.SUPERVISOR,
          status: UserStatus.ACTIVE,
          id: { not: agentId },
        },
      });

      if (activeSupervisorCount === 0) {
        throw new Error("Cannot demote or suspend the sole active supervisor. Promote another supervisor first.");
      }
    }

    // Validate reassignment target if provided
    let reassignTargetUser: { id: string; name: string; email: string } | null = null;
    if (data.reassignTicketsToId && data.reassignTicketsToId !== "unassign") {
      const candidate = await prisma.user.findUnique({
        where: { id: data.reassignTicketsToId },
        select: { id: true, name: true, email: true, role: true, status: true },
      });

      if (!candidate || candidate.status !== UserStatus.ACTIVE || candidate.role === Role.CUSTOMER) {
        throw new Error("Selected reassignment agent is invalid or inactive.");
      }
      reassignTargetUser = candidate;
    }

    const updatePayload: any = {};
    if (data.role && (data.role === Role.SUPERVISOR || data.role === Role.AGENT)) {
      updatePayload.role = data.role;
    }
    if (data.status && (data.status === UserStatus.ACTIVE || data.status === UserStatus.SUSPENDED)) {
      updatePayload.status = data.status;
    }

    const reassignedCount = targetUser.assignedTickets.length;

    // Execute updates and ticket reassignments in a single ACID transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Update User record
      const user = await tx.user.update({
        where: { id: agentId },
        data: updatePayload,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          updatedAt: true,
        },
      });

      // 2. If suspending and reassignment specified, reassign active tickets
      if (
        data.status === UserStatus.SUSPENDED &&
        (data.reassignTicketsToId || data.reassignTicketsToId === "unassign") &&
        targetUser.assignedTickets.length > 0
      ) {
        const newAssigneeId = reassignTargetUser ? reassignTargetUser.id : null;
        const newAssigneeName = reassignTargetUser ? reassignTargetUser.name : "Unassigned";

        for (const ticket of targetUser.assignedTickets) {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { primaryAssigneeId: newAssigneeId },
          });

          // Record immutable audit log
          await tx.auditLog.create({
            data: {
              ticketId: ticket.id,
              actorId: supervisor.id,
              actorName: supervisor.name,
              eventType: "REASSIGNED" as any,
              oldValue: {
                assigneeId: targetUser.id,
                assigneeName: targetUser.name,
              },
              newValue: {
                assigneeId: newAssigneeId,
                assigneeName: newAssigneeName,
                reason: `Agent ${targetUser.name} suspended by ${supervisor.name}`,
              },
            },
          });
        }
      }

      return user;
    });

    return {
      success: true,
      user: updatedUser,
      reassignedTicketsCount:
        data.status === UserStatus.SUSPENDED && data.reassignTicketsToId !== undefined
          ? reassignedCount
          : 0,
      reassignedTo: reassignTargetUser ? reassignTargetUser.name : data.reassignTicketsToId === "unassign" ? "Unassigned" : null,
    };
  }

  /**
   * Cancels a pending agent invitation and deletes the unprovisioned user record.
   * Security Invariant: Only SUPERVISOR can invoke this, and only on PENDING_SETUP accounts.
   */
  static async cancelInvitation(supervisor: SessionUser, agentId: string) {
    if (supervisor.role !== Role.SUPERVISOR) {
      throw new Error("Forbidden: Only supervisors can cancel agent invitations.");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: agentId },
      include: {
        assignedTickets: true,
        invitations: true,
      },
    });

    if (!targetUser) {
      throw new Error("Agent record not found.");
    }

    if (targetUser.status !== UserStatus.PENDING_SETUP) {
      throw new Error("Only pending agent invitations can be cancelled. Use account suspension for active members.");
    }

    if (targetUser.assignedTickets.length > 0) {
      throw new Error("Cannot delete agent with assigned tickets.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.agentInvitation.deleteMany({
        where: { userId: agentId },
      });
      await tx.user.delete({
        where: { id: agentId },
      });
    });

    return {
      success: true,
      message: `Invitation for ${targetUser.email} has been revoked and removed.`,
    };
  }
}
