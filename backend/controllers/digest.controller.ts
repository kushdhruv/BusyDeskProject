/**
 * Digest Controller
 * Handles user preferences, HTML previews, and scheduled cron execution.
 */

import { Role, DigestFrequency } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser } from "../models/types.model";
import { DigestService } from "../services/digest.service";

export class DigestController {
  /**
   * Retrieves the authenticated user's email digest settings.
   */
  static async getMyPreferences(actor: SessionUser) {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        digestEnabled: true,
        digestFrequency: true,
        digestLastSentAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found.");
    }

    return user;
  }

  /**
   * Updates the authenticated user's email digest preferences.
   */
  static async updateMyPreferences(
    actor: SessionUser,
    data: { enabled?: boolean; frequency?: DigestFrequency }
  ) {
    const updateData: any = {};
    if (data.enabled !== undefined) updateData.digestEnabled = Boolean(data.enabled);
    if (data.frequency !== undefined) {
      if (!Object.values(DigestFrequency).includes(data.frequency)) {
        throw new Error("Invalid digest frequency. Choose DAILY, WEEKLY, or NEVER.");
      }
      updateData.digestFrequency = data.frequency;
      if (data.frequency === DigestFrequency.NEVER) {
        updateData.digestEnabled = false;
      }
    }

    return prisma.user.update({
      where: { id: actor.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        digestEnabled: true,
        digestFrequency: true,
        digestLastSentAt: true,
      },
    });
  }

  /**
   * Generates live preview for an Agent Digest.
   */
  static async previewAgentDigest(
    actor: SessionUser,
    agentId?: string,
    period: "daily" | "weekly" = "daily"
  ) {
    let targetAgentId = actor.id;
    if (actor.role === Role.SUPERVISOR && agentId) {
      targetAgentId = agentId;
    } else if (actor.role === Role.CUSTOMER) {
      throw new Error("Customers do not receive staff email digests.");
    }

    const data = await DigestService.getAgentDigestData(targetAgentId, period);
    const html = DigestService.renderAgentDigestHtml(data);

    return { data, html };
  }

  /**
   * Generates live preview for a Supervisor Digest.
   */
  static async previewSupervisorDigest(
    actor: SessionUser,
    period: "daily" | "weekly" = "daily"
  ) {
    if (actor.role !== Role.SUPERVISOR) {
      throw new Error("Only Supervisors can view the team operational digest.");
    }

    const data = await DigestService.getSupervisorDigestData(actor.id, period);
    const html = DigestService.renderSupervisorDigestHtml(data);

    return { data, html };
  }

  /**
   * Handles cron trigger (e.g. from Vercel Cron or manual supervisor test).
   */
  static async triggerCron(
    authHeader?: string | null,
    actor?: SessionUser | null,
    frequency: DigestFrequency = DigestFrequency.DAILY,
    forceAll: boolean = false
  ) {
    const cronSecret = process.env.CRON_SECRET || "dev-cron-secret-key-123";

    // Verify bearer token or active supervisor session
    let isAuthorized = false;
    if (authHeader && authHeader.replace(/^Bearer\s+/i, "") === cronSecret) {
      isAuthorized = true;
    } else if (actor && actor.role === Role.SUPERVISOR) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      throw new Error("Unauthorized cron execution.");
    }

    return DigestService.sendScheduledDigests({
      frequency,
      forceAll,
    });
  }
}
