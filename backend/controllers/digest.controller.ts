/**
 * Digest Controller
 * Handles user preferences, HTML previews, personal on-demand dispatches, and scheduled cron execution.
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
        digestTime: true,
        digestDayOfWeek: true,
        digestTimezone: true,
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
    data: {
      enabled?: boolean;
      frequency?: DigestFrequency;
      time?: string;
      dayOfWeek?: number;
      timezone?: string;
    }
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

    if (data.time !== undefined && typeof data.time === "string") {
      const cleanTime = data.time.trim();
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (timeRegex.test(cleanTime)) {
        updateData.digestTime = cleanTime;
      }
    }

    if (data.dayOfWeek !== undefined) {
      const dow = Number(data.dayOfWeek);
      if (dow >= 1 && dow <= 7) {
        updateData.digestDayOfWeek = dow;
      }
    }

    if (data.timezone !== undefined && typeof data.timezone === "string") {
      updateData.digestTimezone = data.timezone.trim().slice(0, 64);
    }

    return prisma.user.update({
      where: { id: actor.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        digestEnabled: true,
        digestFrequency: true,
        digestTime: true,
        digestDayOfWeek: true,
        digestTimezone: true,
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
   * Sends an immediate personalized digest to the authenticated staff member's email.
   */
  static async sendMyDigestNow(actor: SessionUser, baseUrl?: string) {
    if (actor.role === Role.CUSTOMER) {
      throw new Error("Customers do not receive staff email digests.");
    }

    return DigestService.sendUserDigestNow(actor.id, baseUrl);
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
