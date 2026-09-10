import { Role, Status, AuditEventType } from "@prisma/client";
import { prisma } from "../prisma";
import { SessionUser } from "../types";
import { TicketPolicy } from "../policies/TicketPolicy";
import { AuditService } from "./AuditService";

export interface SubmitCsatDTO {
  rating: number;
  comment?: string;
}

export class CsatService {
  static async submitCsat(ticketId: string, data: SubmitCsatDTO, actor: SessionUser) {
    if (typeof data.rating !== "number" || !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
      throw new Error("Rating must be an integer between 1 and 5.");
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { satisfaction: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!TicketPolicy.canRateCsat(actor, ticket)) {
      if (actor.role !== Role.CUSTOMER || ticket.requesterId !== actor.id) {
        throw new Error("You do not have permission to rate this ticket.");
      }
      if (ticket.status !== Status.RESOLVED && ticket.status !== Status.CLOSED) {
        throw new Error("CSAT ratings can only be submitted for resolved or closed tickets.");
      }
      if (ticket.satisfaction) {
        throw new Error("A satisfaction rating has already been submitted for this ticket.");
      }
      throw new Error("Cannot submit satisfaction rating for this ticket.");
    }

    const comment = data.comment?.trim() || null;

    // Atomic transaction: Insert CustomerSatisfaction + CSAT_SUBMITTED audit log
    return prisma.$transaction(async (tx) => {
      const satisfaction = await tx.customerSatisfaction.create({
        data: {
          ticketId,
          userId: actor.id,
          rating: data.rating,
          comment,
        },
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.CSAT_SUBMITTED,
          newValue: {
            rating: data.rating,
            comment,
          },
          metadata: {
            satisfactionId: satisfaction.id,
          },
        },
        tx
      );

      return satisfaction;
    });
  }
}
