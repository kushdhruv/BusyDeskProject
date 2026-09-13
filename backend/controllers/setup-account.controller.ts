/**
 * Setup Account Controller
 * Handles validation of one-time invitation tokens and atomic password setup.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser } from "../models/types.model";

export class SetupAccountController {
  /**
   * Validates a raw one-time invitation token without consuming it.
   * Compares the SHA-256 hash of the input token against stored database hashes.
   */
  static async validateInvitationToken(rawToken: string) {
    if (!rawToken || typeof rawToken !== "string") {
      return {
        valid: false,
        error: "An invitation token is required to set up your account.",
      };
    }

    // Hash the supplied token to look up the DB record
    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

    const invitation = await prisma.agentInvitation.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!invitation) {
      return {
        valid: false,
        error: "This invitation link is invalid or has been revoked.",
      };
    }

    if (invitation.usedAt) {
      return {
        valid: false,
        error: "This invitation has already been used to set up an account.",
      };
    }

    if (invitation.expiresAt < new Date()) {
      return {
        valid: false,
        error: "This invitation link has expired (24-hour limit exceeded). Please ask your supervisor to resend an invite.",
      };
    }

    if (invitation.user.status === UserStatus.ACTIVE) {
      return {
        valid: false,
        error: "Your account is already active. Please proceed directly to the login page.",
      };
    }

    return {
      valid: true,
      name: invitation.user.name,
      email: invitation.user.email,
      role: invitation.user.role,
    };
  }

  /**
   * Completes account setup by consuming the one-time token, setting the user's password,
   * activating the user status, and returning the session user payload.
   */
  static async completeAccountSetup(
    rawToken: string,
    password: string
  ): Promise<SessionUser> {
    if (!rawToken || typeof rawToken !== "string") {
      throw new Error("Invalid or missing invitation token.");
    }

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

    // Fetch invitation
    const invitation = await prisma.agentInvitation.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!invitation) {
      throw new Error("Invalid or unrecognized invitation token.");
    }

    if (invitation.usedAt) {
      throw new Error("This invitation has already been used. Please log in.");
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error("This invitation has expired. Please contact your supervisor.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    // Atomic transaction: update password, mark user active, consume token
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: invitation.userId },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      }),
      prisma.agentInvitation.update({
        where: { id: invitation.id },
        data: {
          usedAt: now,
        },
      }),
    ]);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    };
  }
}
