import { Role } from "@prisma/client";
import { SessionUser } from "../lib/types";
import { TicketAccessContext } from "./TicketPolicy";

export class AlertPolicy {
  static canAcknowledge(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    // Assigned agent can acknowledge alert for their ticket
    return ticket.primaryAssigneeId === user.id;
  }
}
