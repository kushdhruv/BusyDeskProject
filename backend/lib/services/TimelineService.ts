import { prisma } from "../prisma";
import { TimelineItem } from "../types";

export class TimelineService {
  /**
   * Fetches replies and audit logs for a ticket and merges them chronologically.
   * This provides a single unified activity feed while maintaining separate normalized tables in PostgreSQL.
   */
  static async getUnifiedTimeline(ticketId: string): Promise<TimelineItem[]> {
    const [replies, auditLogs] = await Promise.all([
      prisma.reply.findMany({
        where: { ticketId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.auditLog.findMany({
        where: { ticketId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const items: TimelineItem[] = [];

    for (const r of replies) {
      items.push({
        id: `reply-${r.id}`,
        type: "REPLY",
        createdAt: r.createdAt.toISOString(),
        reply: {
          id: r.id,
          authorId: r.authorId,
          authorType: r.authorType,
          authorName: r.authorName,
          authorEmail: r.authorEmail,
          body: r.body,
          isInternal: r.isInternal,
        },
      });
    }

    for (const a of auditLogs) {
      items.push({
        id: `audit-${a.id}`,
        type: "AUDIT",
        createdAt: a.createdAt.toISOString(),
        audit: {
          id: a.id,
          actorId: a.actorId,
          actorName: a.actorName,
          eventType: a.eventType,
          oldValue: a.oldValue,
          newValue: a.newValue,
          metadata: a.metadata,
        },
      });
    }

    // Sort chronologically ascending
    items.sort(
      (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
    );

    return items;
  }
}
