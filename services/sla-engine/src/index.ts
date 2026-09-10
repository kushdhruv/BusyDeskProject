import { Priority, Status } from "../../../packages/contracts/src";

export class SlaEngine {
  /**
   * Target response duration in minutes based on priority
   */
  static getTargetMinutes(priority: Priority): number {
    switch (priority) {
      case Priority.URGENT:
        return 120; // 2 hours
      case Priority.HIGH:
        return 480; // 8 hours
      case Priority.MEDIUM:
        return 1440; // 24 hours
      case Priority.LOW:
        return 4320; // 72 hours (3 days)
      default:
        return 1440;
    }
  }

  /**
   * Validates state machine transitions according to SLA lifecycle rules
   */
  static validateTransition(
    currentStatus: Status,
    newStatus: Status,
    closedAt?: Date | string | null
  ): void {
    if (currentStatus === newStatus) return;

    // Check 7-day reopen window guard for CLOSED tickets
    if (currentStatus === Status.CLOSED) {
      if (newStatus !== Status.OPEN) {
        throw new Error(`Closed tickets can only transition to OPEN.`);
      }
      if (closedAt) {
        const closedTime = new Date(closedAt).getTime();
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (now - closedTime > sevenDaysMs) {
          throw new Error("Tickets closed more than 7 days ago cannot be reopened.");
        }
      }
      return;
    }

    // State machine transition matrix
    const allowedTransitions: Record<Status, Status[]> = {
      [Status.NEW]: [Status.OPEN],
      [Status.OPEN]: [Status.PENDING, Status.RESOLVED],
      [Status.PENDING]: [Status.OPEN, Status.RESOLVED],
      [Status.RESOLVED]: [Status.OPEN, Status.CLOSED],
      [Status.CLOSED]: [Status.OPEN],
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}.`);
    }
  }

  /**
   * Computes SLA state values upon status transitions (Zero DB polling writes model)
   */
  static computeStateOnStatusChange(
    currentTicket: {
      status: Status;
      slaDueAt?: Date | string | null;
      slaPausedAt?: Date | string | null;
      slaPausedRemainingSeconds?: number | null;
      slaCycle?: number;
    },
    newStatus: Status,
    now: Date = new Date()
  ) {
    let slaDueAt: Date | null = currentTicket.slaDueAt ? new Date(currentTicket.slaDueAt) : null;
    let slaPausedAt: Date | null = currentTicket.slaPausedAt ? new Date(currentTicket.slaPausedAt) : null;
    let slaPausedRemainingSeconds: number | null = currentTicket.slaPausedRemainingSeconds ?? null;
    let slaCycle = currentTicket.slaCycle || 1;

    // 1. Transitioning into PENDING (Waiting on customer -> Freeze SLA clock)
    if (newStatus === Status.PENDING && currentTicket.status !== Status.PENDING) {
      slaPausedAt = now;
      if (slaDueAt) {
        const diffMs = slaDueAt.getTime() - now.getTime();
        slaPausedRemainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
      } else {
        slaPausedRemainingSeconds = 0;
      }
      slaDueAt = null; // Unset active deadline while paused
    }

    // 2. Transitioning OUT of PENDING back to OPEN (Customer replied -> Resume SLA clock)
    else if (currentTicket.status === Status.PENDING && newStatus === Status.OPEN) {
      const remainingSec = slaPausedRemainingSeconds ?? 0;
      slaDueAt = new Date(now.getTime() + remainingSec * 1000);
      slaPausedAt = null;
      slaPausedRemainingSeconds = null;
    }

    // 3. Reopening a CLOSED or RESOLVED ticket -> Increment cycle & set fresh deadline
    else if (
      (currentTicket.status === Status.CLOSED || currentTicket.status === Status.RESOLVED) &&
      newStatus === Status.OPEN
    ) {
      slaCycle += 1;
      slaPausedAt = null;
      slaPausedRemainingSeconds = null;
    }

    // 4. Moving to RESOLVED or CLOSED -> Stop active timer
    else if (newStatus === Status.RESOLVED || newStatus === Status.CLOSED) {
      slaDueAt = null;
      slaPausedAt = null;
      slaPausedRemainingSeconds = null;
    }

    return {
      slaDueAt,
      slaPausedAt,
      slaPausedRemainingSeconds,
      slaCycle,
    };
  }
}
