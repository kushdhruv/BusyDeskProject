/**
 * Alert Policy
 * Authorization checks for acknowledging SLA warning and breach alerts.
 */

import { Role } from "@prisma/client";
import { SessionUser } from "../types.model";
import { TicketAccessContext } from "./ticket.policy";

export class AlertPolicy {
  static canAcknowledge(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.CUSTOMER) {
      return false;
    }
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    return ticket.primaryAssigneeId === user.id;
  }
}
