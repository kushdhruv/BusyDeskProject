import { AuthorType, AuditEventType, Status, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { SessionUser } from "../types";
import { ReplyPolicy } from "../policies/ReplyPolicy";
import { AuditService } from "./AuditService";
import { SlaService } from "./SlaService";

export class ReplyService {
  static async addAgentReply(
    ticketId: string,
    data: { body: string; isInternal: boolean },
    actor: SessionUser
  ) {
    if (!data.body || data.body.trim().length === 0) {
      throw new Error("Reply body cannot be empty.");
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { collaborators: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (data.isInternal) {
      if (!ReplyPolicy.canAddInternalNote(actor, ticket)) {
        throw new Error("You do not have permission to add internal notes to this ticket.");
      }
    } else {
      if (!ReplyPolicy.canReply(actor, ticket)) {
        throw new Error("You do not have permission to reply to this ticket.");
      }
    }

    return prisma.$transaction(async (tx) => {
      const reply = await tx.reply.create({
        data: {
          ticketId,
          authorId: actor.id,
          authorType: AuthorType.AGENT,
          authorName: actor.name,
          authorEmail: actor.email,
          body: data.body.trim(),
          isInternal: data.isInternal,
        },
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.REPLY_ADDED,
          metadata: {
            replyId: reply.id,
            isInternal: data.isInternal,
            authorType: AuthorType.AGENT,
          },
        },
        tx
      );

      // If ticket is in NEW status, moving to OPEN on first agent reply
      if (ticket.status === Status.NEW) {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: Status.OPEN },
        });

        await AuditService.log(
          {
            ticketId,
            actorId: actor.id,
            actorName: actor.name,
            eventType: AuditEventType.STATUS_CHANGED,
            oldValue: { status: Status.NEW },
            newValue: { status: Status.OPEN },
            metadata: { reason: "Moved to OPEN on agent reply" },
          },
          tx
        );
      }

      await SlaService.syncAlertForTicket(ticketId, tx);

      return reply;
    });
  }

  static async addCustomerReply(
    ticketId: string,
    data: { body: string; customerName?: string; customerEmail?: string }
  ) {
    if (!data.body || data.body.trim().length === 0) {
      throw new Error("Customer reply body cannot be empty.");
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    const customerName = data.customerName || ticket.requesterName;
    const customerEmail = data.customerEmail || ticket.requesterEmail;

    return prisma.$transaction(async (tx) => {
      const reply = await tx.reply.create({
        data: {
          ticketId,
          authorId: null,
          authorType: AuthorType.CUSTOMER,
          authorName: customerName,
          authorEmail: customerEmail,
          body: data.body.trim(),
          isInternal: false,
        },
      });

      await AuditService.log(
        {
          ticketId,
          actorId: null,
          actorName: customerName,
          eventType: AuditEventType.REPLY_ADDED,
          metadata: {
            replyId: reply.id,
            isInternal: false,
            authorType: AuthorType.CUSTOMER,
          },
        },
        tx
      );

      // Requirement 4: When customer replies, Pending -> Open and resumes SLA clock
      if (ticket.status === Status.PENDING) {
        const slaUpdate = SlaService.computeStateOnStatusChange(
          ticket,
          Status.OPEN,
          new Date()
        );

        await tx.ticket.update({
          where: { id: ticketId },
          data: slaUpdate,
        });

        await AuditService.log(
          {
            ticketId,
            actorId: null,
            actorName: customerName,
            eventType: AuditEventType.STATUS_CHANGED,
            oldValue: { status: Status.PENDING },
            newValue: { status: Status.OPEN },
            metadata: {
              reason: "Customer replied to ticket; SLA clock resumed",
              resumedSlaDueAt: slaUpdate.slaDueAt,
            },
          },
          tx
        );
      }

      await SlaService.syncAlertForTicket(ticketId, tx);

      return reply;
    });
  }
}
