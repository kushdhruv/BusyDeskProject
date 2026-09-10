/**
 * Reply Controller
 * Handles conversation replies, internal notes, author attribution, and customer status/SLA triggers.
 */

import { AuthorType, AuditEventType, Status, Role } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser } from "../models/types.model";
import { ReplyPolicy } from "../models/policies/reply.policy";
import { AuditController } from "./audit.controller";
import { SlaController } from "./sla.controller";

export class ReplyController {
  /**
   * Adds a public reply or internal note to a ticket with role and collaborator permissions.
   */
  static async addReply(
    ticketId: string,
    data: { body: string; isInternal?: boolean },
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

    const isInternal = !!data.isInternal;

    if (actor.role === Role.CUSTOMER) {
      if (isInternal) {
        throw new Error("Customers are not permitted to submit internal notes.");
      }
      if (ticket.requesterId !== actor.id) {
        throw new Error("You do not have permission to reply to this ticket.");
      }
    } else {
      if (isInternal) {
        if (!ReplyPolicy.canAddInternalNote(actor, ticket)) {
          throw new Error("You do not have permission to add internal notes to this ticket.");
        }
      } else {
        if (!ReplyPolicy.canReply(actor, ticket)) {
          throw new Error("You do not have permission to reply to this ticket.");
        }
      }
    }

    const authorType = actor.role === Role.CUSTOMER ? AuthorType.CUSTOMER : AuthorType.AGENT;

    return prisma.$transaction(async (tx) => {
      const reply = await tx.reply.create({
        data: {
          ticketId,
          authorId: actor.id,
          authorType,
          authorName: actor.name,
          authorEmail: actor.email,
          body: data.body.trim(),
          isInternal,
        },
      });

      await AuditController.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.REPLY_ADDED,
          metadata: {
            replyId: reply.id,
            isInternal,
            authorType,
          },
        },
        tx
      );

      // Customer Reply Invariant: ONLY if ticket is in PENDING status, transition to OPEN and resume SLA
      if (authorType === AuthorType.CUSTOMER) {
        if (ticket.status === Status.PENDING) {
          const slaUpdate = SlaController.computeStateOnStatusChange(
            ticket,
            Status.OPEN,
            new Date()
          );

          await tx.ticket.update({
            where: { id: ticketId },
            data: slaUpdate,
          });

          await AuditController.log(
            {
              ticketId,
              actorId: actor.id,
              actorName: actor.name,
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
      } else {
        // If ticket is in NEW status, moving to OPEN on first agent reply
        if (ticket.status === Status.NEW) {
          await tx.ticket.update({
            where: { id: ticketId },
            data: { status: Status.OPEN },
          });

          await AuditController.log(
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
      }

      await SlaController.syncAlertForTicket(ticketId, tx);

      return reply;
    });
  }

  // Backward-compatible alias for agent reply
  static async addAgentReply(
    ticketId: string,
    data: { body: string; isInternal: boolean },
    actor: SessionUser
  ) {
    return this.addReply(ticketId, data, actor);
  }

  // Helper for inbound customer replies
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
          authorId: ticket.requesterId || null,
          authorType: AuthorType.CUSTOMER,
          authorName: customerName,
          authorEmail: customerEmail,
          body: data.body.trim(),
          isInternal: false,
        },
      });

      await AuditController.log(
        {
          ticketId,
          actorId: ticket.requesterId || null,
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

      if (ticket.status === Status.PENDING) {
        const slaUpdate = SlaController.computeStateOnStatusChange(
          ticket,
          Status.OPEN,
          new Date()
        );

        await tx.ticket.update({
          where: { id: ticketId },
          data: slaUpdate,
        });

        await AuditController.log(
          {
            ticketId,
            actorId: ticket.requesterId || null,
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

      await SlaController.syncAlertForTicket(ticketId, tx);

      return reply;
    });
  }
}

export const ReplyService = ReplyController;
