import { Role, Status } from "@prisma/client";
import { SessionUser } from "../types";
import { REOPEN_WINDOW_DAYS, REOPEN_WINDOW_MS } from "../constants";

export interface LifecycleValidationResult {
  valid: boolean;
  reason?: string;
}

export class LifecycleService {
  static validateTransition(
    currentStatus: Status,
    newStatus: Status,
    user: SessionUser,
    ticketContext: { closedAt?: Date | null }
  ): LifecycleValidationResult {
    if (currentStatus === newStatus) {
      return { valid: false, reason: `Ticket is already in ${currentStatus} status.` };
    }

    // 1. From NEW
    if (currentStatus === Status.NEW) {
      if (newStatus === Status.OPEN) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `A NEW ticket must be moved to OPEN before transitioning to ${newStatus}.`,
      };
    }

    // 2. From OPEN
    if (currentStatus === Status.OPEN) {
      if (newStatus === Status.PENDING || newStatus === Status.RESOLVED) {
        return { valid: true };
      }
      if (newStatus === Status.CLOSED) {
        return {
          valid: false,
          reason: "Tickets must be marked as RESOLVED before they can be CLOSED.",
        };
      }
      return {
        valid: false,
        reason: `Cannot transition directly from OPEN to ${newStatus}.`,
      };
    }

    // 3. From PENDING
    if (currentStatus === Status.PENDING) {
      if (newStatus === Status.OPEN) {
        return { valid: true };
      }
      if (newStatus === Status.RESOLVED) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `A PENDING ticket must return to OPEN or RESOLVED, not ${newStatus}.`,
      };
    }

    // 4. From RESOLVED
    if (currentStatus === Status.RESOLVED) {
      if (newStatus === Status.OPEN) {
        return { valid: true };
      }
      if (newStatus === Status.CLOSED) {
        if (user.role !== Role.SUPERVISOR) {
          return {
            valid: false,
            reason: "Only Supervisors are authorized to permanently close resolved tickets.",
          };
        }
        return { valid: true };
      }
      return {
        valid: false,
        reason: `A RESOLVED ticket can only be reopened to OPEN or closed to CLOSED, not ${newStatus}.`,
      };
    }

    // 5. From CLOSED
    if (currentStatus === Status.CLOSED) {
      if (newStatus === Status.OPEN) {
        if (user.role !== Role.SUPERVISOR) {
          return {
            valid: false,
            reason: "Only Supervisors are authorized to reopen a CLOSED ticket.",
          };
        }
        if (!ticketContext.closedAt) {
          return {
            valid: false,
            reason: "Ticket closed timestamp is missing; cannot verify reopen window.",
          };
        }
        const elapsed = Date.now() - new Date(ticketContext.closedAt).getTime();
        if (elapsed > REOPEN_WINDOW_MS) {
          const closedDateStr = new Date(ticketContext.closedAt).toISOString().split("T")[0];
          return {
            valid: false,
            reason: `Cannot reopen ticket: the ${REOPEN_WINDOW_DAYS}-day reopen window expired (ticket was closed on ${closedDateStr}). Once closed past ${REOPEN_WINDOW_DAYS} days, a ticket remains permanently closed.`,
          };
        }
        return { valid: true };
      }
      return {
        valid: false,
        reason: `A CLOSED ticket can only be reopened to OPEN within ${REOPEN_WINDOW_DAYS} days; invalid target status ${newStatus}.`,
      };
    }

    return { valid: false, reason: `Invalid status transition from ${currentStatus} to ${newStatus}.` };
  }
}
