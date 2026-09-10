import { AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { SessionUser } from "../types";
import { CollaboratorPolicy } from "../policies/CollaboratorPolicy";
import { AuditService } from "./AuditService";

export class CollaborationService {
  static async addCollaborator(
    ticketId: string,
    targetUserId: string,
    actor: SessionUser
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        collaborators: true,
      },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!CollaboratorPolicy.canManage(actor, ticket)) {
      throw new Error("Only the primary assignee or a Supervisor can add collaborators to this ticket.");
    }

    if (ticket.primaryAssigneeId === targetUserId) {
      throw new Error("User is already the primary assignee of this ticket.");
    }

    if (ticket.collaborators.some((c) => c.userId === targetUserId)) {
      throw new Error("User is already a collaborator on this ticket.");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true },
    });

    if (!targetUser) {
      throw new Error("Target agent user not found.");
    }

    return prisma.$transaction(async (tx) => {
      const collab = await tx.ticketCollaborator.create({
        data: {
          ticketId,
          userId: targetUserId,
          addedById: actor.id,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.COLLABORATOR_ADDED,
          newValue: { userId: targetUser.id, userName: targetUser.name },
          metadata: { action: "Added collaborator" },
        },
        tx
      );

      return collab;
    });
  }

  static async removeCollaborator(
    ticketId: string,
    targetUserId: string,
    actor: SessionUser
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        collaborators: true,
      },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!CollaboratorPolicy.canManage(actor, ticket)) {
      throw new Error("Only the primary assignee or a Supervisor can remove collaborators from this ticket.");
    }

    const existing = ticket.collaborators.find((c) => c.userId === targetUserId);
    if (!existing) {
      throw new Error("User is not a collaborator on this ticket.");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true },
    });

    return prisma.$transaction(async (tx) => {
      await tx.ticketCollaborator.delete({
        where: { id: existing.id },
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.COLLABORATOR_REMOVED,
          oldValue: { userId: targetUserId, userName: targetUser?.name || targetUserId },
          metadata: { action: "Removed collaborator" },
        },
        tx
      );

      return { success: true };
    });
  }
}
