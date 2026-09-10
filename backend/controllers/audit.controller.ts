/**
 * Audit Controller
 * Manages immutable, tamper-proof audit trail logs for all ticket lifecycle and security events.
 */

import { AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.db";

export interface CreateAuditLogParams {
  ticketId: string;
  actorId?: string | null;
  actorName: string; // Deliberate historical denormalization
  eventType: AuditEventType;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  createdAt?: Date;
}

export class AuditController {
  /**
   * Append an immutable audit log entry.
   * No update or delete operations are provided.
   */
  static async log(
    params: CreateAuditLogParams,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.auditLog.create({
      data: {
        ticketId: params.ticketId,
        actorId: params.actorId || null,
        actorName: params.actorName,
        eventType: params.eventType,
        oldValue: params.oldValue ?? Prisma.DbNull,
        newValue: params.newValue ?? Prisma.DbNull,
        metadata: params.metadata ?? Prisma.DbNull,
        createdAt: params.createdAt || new Date(),
      },
    });
  }

  /**
   * Retrieves all audit logs for a given ticket.
   */
  static async getTicketLogs(ticketId: string) {
    return prisma.auditLog.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }
}

export const AuditService = AuditController;
