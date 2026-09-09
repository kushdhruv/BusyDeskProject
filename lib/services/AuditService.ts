import { AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

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

export class AuditService {
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
