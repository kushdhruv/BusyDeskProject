import { Priority, Status, SlaAlertType, SlaAlertStatus, Role, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { SLA_TARGETS_MINUTES, SLA_WARNING_THRESHOLD_MINUTES } from "../constants";
import { SessionUser } from "../types";
import { AlertPolicy } from "../policies/AlertPolicy";

export class SlaService {
  static getTargetMinutes(priority: Priority): number {
    return SLA_TARGETS_MINUTES[priority] || SLA_TARGETS_MINUTES.MEDIUM;
  }

  static computeStateOnStatusChange(
    ticket: {
      priority: Priority;
      status: Status;
      slaTargetMinutes: number;
      slaDueAt: Date | null;
      slaPausedAt: Date | null;
      slaPausedRemainingSeconds: number | null;
      slaCycle: number;
    },
    newStatus: Status,
    now: Date = new Date()
  ) {
    const updateData: {
      status: Status;
      slaDueAt?: Date | null;
      slaPausedAt?: Date | null;
      slaPausedRemainingSeconds?: number | null;
      slaCycle?: number;
      resolvedAt?: Date | null;
      closedAt?: Date | null;
    } = {
      status: newStatus,
    };

    // 1. Entering PENDING: pause SLA clock and freeze remaining seconds
    if (newStatus === Status.PENDING && ticket.status !== Status.PENDING) {
      let remainingSeconds = 0;
      if (ticket.slaDueAt) {
        remainingSeconds = Math.max(
          0,
          Math.floor((new Date(ticket.slaDueAt).getTime() - now.getTime()) / 1000)
        );
      } else if (ticket.slaPausedRemainingSeconds) {
        remainingSeconds = ticket.slaPausedRemainingSeconds;
      }
      updateData.slaPausedAt = now;
      updateData.slaPausedRemainingSeconds = remainingSeconds;
      updateData.slaDueAt = null; // Paused
    }

    // 2. Resuming from PENDING to OPEN (e.g. customer reply or agent action)
    else if (ticket.status === Status.PENDING && newStatus === Status.OPEN) {
      const remainingSeconds = ticket.slaPausedRemainingSeconds ?? ticket.slaTargetMinutes * 60;
      updateData.slaDueAt = new Date(now.getTime() + remainingSeconds * 1000);
      updateData.slaPausedAt = null;
      updateData.slaPausedRemainingSeconds = null;
    }

    // 3. Reopening from RESOLVED or CLOSED to OPEN -> start new SLA cycle
    else if (
      (ticket.status === Status.RESOLVED || ticket.status === Status.CLOSED) &&
      newStatus === Status.OPEN
    ) {
      updateData.slaCycle = ticket.slaCycle + 1;
      updateData.slaDueAt = new Date(now.getTime() + ticket.slaTargetMinutes * 60 * 1000);
      updateData.slaPausedAt = null;
      updateData.slaPausedRemainingSeconds = null;
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    // 4. Moving to RESOLVED
    else if (newStatus === Status.RESOLVED) {
      updateData.resolvedAt = now;
    }

    // 5. Moving to CLOSED
    else if (newStatus === Status.CLOSED) {
      updateData.closedAt = now;
    }

    return updateData;
  }

  static async syncAlertForTicket(
    ticketId: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: {
        slaAlerts: {
          where: { status: { in: [SlaAlertStatus.ACTIVE, SlaAlertStatus.ACKNOWLEDGED] } },
        },
      },
    });

    if (!ticket || ticket.archivedAt || !ticket.slaDueAt) {
      // If ticket is archived, resolved, closed, or pending, resolve active alerts
      if (ticket && ticket.slaAlerts.length > 0) {
        await tx.slaAlert.updateMany({
          where: { ticketId, status: SlaAlertStatus.ACTIVE },
          data: { status: SlaAlertStatus.RESOLVED },
        });
      }
      return;
    }

    if (ticket.status !== Status.NEW && ticket.status !== Status.OPEN) {
      return;
    }

    const now = new Date();
    const dueTime = new Date(ticket.slaDueAt).getTime();
    const nowTime = now.getTime();
    const isBreached = dueTime <= nowTime;
    const isDueSoon =
      !isBreached && dueTime <= nowTime + SLA_WARNING_THRESHOLD_MINUTES * 60 * 1000;

    const existingAlert = ticket.slaAlerts.find(
      (a) => a.breachCycle === ticket.slaCycle
    );

    if (isBreached) {
      if (!existingAlert) {
        await tx.slaAlert.create({
          data: {
            ticketId: ticket.id,
            type: SlaAlertType.BREACHED,
            status: SlaAlertStatus.ACTIVE,
            breachCycle: ticket.slaCycle,
          },
        });
      } else if (
        existingAlert.type !== SlaAlertType.BREACHED &&
        existingAlert.status === SlaAlertStatus.ACTIVE
      ) {
        await tx.slaAlert.update({
          where: { id: existingAlert.id },
          data: { type: SlaAlertType.BREACHED },
        });
      }
    } else if (isDueSoon) {
      if (!existingAlert) {
        await tx.slaAlert.create({
          data: {
            ticketId: ticket.id,
            type: SlaAlertType.DUE_SOON,
            status: SlaAlertStatus.ACTIVE,
            breachCycle: ticket.slaCycle,
          },
        });
      }
    }
  }

  static async getActiveAlerts(user: SessionUser) {
    const whereClause: Prisma.SlaAlertWhereInput = {
      status: SlaAlertStatus.ACTIVE,
      ticket: {
        archivedAt: null,
        status: { in: [Status.NEW, Status.OPEN] },
      },
    };

    if (user.role !== Role.SUPERVISOR) {
      whereClause.ticket = {
        ...whereClause.ticket,
        primaryAssigneeId: user.id,
      };
    }

    const alerts = await prisma.slaAlert.findMany({
      where: whereClause,
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            priority: true,
            status: true,
            primaryAssigneeId: true,
            primaryAssignee: {
              select: { id: true, name: true, email: true },
            },
            slaDueAt: true,
            slaCycle: true,
          },
        },
      },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });

    return {
      alerts,
      count: alerts.length,
    };
  }

  static async acknowledgeAlert(alertId: string, user: SessionUser) {
    const alert = await prisma.slaAlert.findUnique({
      where: { id: alertId },
      include: {
        ticket: {
          select: { id: true, primaryAssigneeId: true, status: true },
        },
      },
    });

    if (!alert) {
      throw new Error("SLA alert not found.");
    }

    if (!AlertPolicy.canAcknowledge(user, alert.ticket)) {
      throw new Error("You do not have permission to acknowledge this SLA alert.");
    }

    const updated = await prisma.slaAlert.update({
      where: { id: alertId },
      data: {
        status: SlaAlertStatus.ACKNOWLEDGED,
        acknowledgedById: user.id,
        acknowledgedAt: new Date(),
      },
    });

    return updated;
  }
}
