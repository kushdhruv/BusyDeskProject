/**
 * Export Controller
 * Generates RFC-4180 compliant CSV dumps matching live search/queue query filters.
 */

import { Prisma, Status, Role } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser } from "../models/types.model";
import { GetQueueParams } from "./ticket.controller";

export class ExportController {
  /**
   * Generates an RFC-4180 compliant CSV export based on current server-side active query filters.
   */
  static async exportToCsv(params: GetQueueParams, user: SessionUser): Promise<string> {
    const where: Prisma.TicketWhereInput = {};

    if (params.scope === "archived") {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

    if (user.role === Role.AGENT) {
      if (params.scope === "collaborating") {
        where.collaborators = { some: { userId: user.id } };
      } else if (params.scope === "assigned_to_me") {
        where.primaryAssigneeId = user.id;
      } else {
        where.OR = [
          { primaryAssigneeId: user.id },
          { collaborators: { some: { userId: user.id } } },
        ];
      }
    } else if (params.scope === "assigned_to_me") {
      where.primaryAssigneeId = user.id;
    }

    const now = new Date();
    if (params.scope === "awaiting_customer") {
      where.status = Status.PENDING;
    } else if (params.scope === "due_soon") {
      where.status = { in: [Status.NEW, Status.OPEN] };
      where.slaDueAt = {
        gt: now,
        lte: new Date(now.getTime() + 60 * 60 * 1000),
      };
    } else if (params.scope === "breached") {
      where.status = { in: [Status.NEW, Status.OPEN] };
      where.slaDueAt = { lte: now };
    }

    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.category) where.category = params.category;
    if (params.assigneeId) where.primaryAssigneeId = params.assigneeId;

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { subject: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { requesterName: { contains: q, mode: "insensitive" } },
            { requesterEmail: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        primaryAssignee: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000, // Safe upper ceiling for CSV export
    });

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      "Ticket Number",
      "Subject",
      "Requester Name",
      "Requester Email",
      "Priority",
      "Category",
      "Status",
      "Primary Assignee",
      "Created At",
      "Updated At",
      "SLA Due At",
      "SLA Status",
    ];

    const rows = tickets.map((t) => {
      let slaStatus = "Healthy";
      if (t.status === Status.PENDING) {
        slaStatus = "Paused (Waiting on Customer)";
      } else if (t.status === Status.RESOLVED || t.status === Status.CLOSED) {
        slaStatus = "Completed";
      } else if (t.slaDueAt) {
        if (new Date(t.slaDueAt).getTime() <= now.getTime()) {
          slaStatus = "Breached";
        } else if (new Date(t.slaDueAt).getTime() <= now.getTime() + 60 * 60 * 1000) {
          slaStatus = "Due Soon";
        }
      }

      return [
        t.ticketNumber,
        t.subject,
        t.requesterName,
        t.requesterEmail,
        t.priority,
        t.category,
        t.status,
        t.primaryAssignee?.name || "Unassigned",
        t.createdAt.toISOString(),
        t.updatedAt.toISOString(),
        t.slaDueAt ? t.slaDueAt.toISOString() : "",
        slaStatus,
      ]
        .map(escapeCsv)
        .join(",");
    });

    return [headers.join(","), ...rows].join("\r\n");
  }
}

export const ExportService = ExportController;
