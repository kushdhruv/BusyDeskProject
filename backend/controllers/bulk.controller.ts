/**
 * Bulk Operations Controller
 * Handles bulk reassignment and bulk closure with independent per-ticket atomicity.
 */

import { Status, AuditEventType, Role } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser, BulkActionResponse, BulkActionResultItem } from "../models/types.model";
import { LifecycleController } from "./lifecycle.controller";
import { AuditController } from "./audit.controller";
import { SlaController } from "./sla.controller";

export class BulkController {
  /**
   * Performs bulk reassignments or bulk closures with per-ticket atomicity.
   */
  static async executeBulkAction(
    ticketIds: string[],
    action: "REASSIGN" | "CLOSE",
    params: { targetAssigneeId?: string | null },
    actor: SessionUser
  ): Promise<BulkActionResponse> {
    if (!ticketIds || ticketIds.length === 0) {
      return { totalRequested: 0, succeededCount: 0, failedCount: 0, results: [] };
    }

    const results: BulkActionResultItem[] = [];

    // Pre-resolve target assignee if reassigning
    let targetUser: { id: string; name: string } | null = null;
    if (action === "REASSIGN" && params.targetAssigneeId) {
      targetUser = await prisma.user.findUnique({
        where: { id: params.targetAssigneeId },
        select: { id: true, name: true },
      });
      if (!targetUser) {
        throw new Error("Target assignee user not found.");
      }
    }

    for (const id of ticketIds) {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { primaryAssignee: true },
      });

      if (!ticket) {
        results.push({
          ticketId: id,
          ticketNumber: 0,
          subject: "Unknown Ticket",
          status: "FAILED",
          reason: "Ticket not found in database.",
        });
        continue;
      }

      try {
        if (action === "REASSIGN") {
          // Check role permission: Supervisor only
          if (actor.role !== Role.SUPERVISOR) {
            throw new Error("Only Supervisors are authorized to bulk reassign tickets.");
          }

          if (ticket.status === Status.CLOSED) {
            throw new Error("Cannot reassign a CLOSED ticket.");
          }

          if (ticket.primaryAssigneeId === params.targetAssigneeId) {
            throw new Error("Ticket is already assigned to this agent.");
          }

          // Execute atomic per-ticket transaction
          await prisma.$transaction(async (tx) => {
            await tx.ticket.update({
              where: { id },
              data: { primaryAssigneeId: params.targetAssigneeId || null },
            });

            await AuditController.log(
              {
                ticketId: id,
                actorId: actor.id,
                actorName: actor.name,
                eventType: AuditEventType.REASSIGNED,
                oldValue: {
                  assigneeId: ticket.primaryAssigneeId,
                  assigneeName: ticket.primaryAssignee?.name || "Unassigned",
                },
                newValue: {
                  assigneeId: params.targetAssigneeId,
                  assigneeName: targetUser?.name || "Unassigned",
                },
                metadata: { context: "Bulk Reassignment" },
              },
              tx
            );
          });

          results.push({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            status: "SUCCESS",
          });
        } else if (action === "CLOSE") {
          // Check role permission: Supervisor only
          if (actor.role !== Role.SUPERVISOR) {
            throw new Error("Only Supervisors are authorized to bulk close tickets.");
          }

          const validation = LifecycleController.validateTransition(
            ticket.status,
            Status.CLOSED,
            actor,
            { closedAt: ticket.closedAt }
          );

          if (!validation.valid) {
            throw new Error(validation.reason || "Invalid status transition.");
          }

          const slaUpdates = SlaController.computeStateOnStatusChange(
            ticket,
            Status.CLOSED,
            new Date()
          );

          // Execute atomic per-ticket transaction
          await prisma.$transaction(async (tx) => {
            await tx.ticket.update({
              where: { id },
              data: slaUpdates,
            });

            await AuditController.log(
              {
                ticketId: id,
                actorId: actor.id,
                actorName: actor.name,
                eventType: AuditEventType.STATUS_CHANGED,
                oldValue: { status: ticket.status },
                newValue: { status: Status.CLOSED },
                metadata: { context: "Bulk Close" },
              },
              tx
            );

            await SlaController.syncAlertForTicket(id, tx);
          });

          results.push({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            status: "SUCCESS",
          });
        }
      } catch (err: any) {
        results.push({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          status: "FAILED",
          reason: err.message || "Operation failed.",
        });
      }
    }

    const succeededCount = results.filter((r) => r.status === "SUCCESS").length;
    const failedCount = results.filter((r) => r.status === "FAILED").length;

    return {
      totalRequested: ticketIds.length,
      succeededCount,
      failedCount,
      results,
    };
  }
}

export const BulkService = BulkController;
