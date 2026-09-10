import { Role } from "@prisma/client";
import { SessionUser } from "../types";
import { TicketAccessContext } from "./TicketPolicy";

export class CollaboratorPolicy {
  static canManage(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.CUSTOMER) {
      return false;
    }
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    return ticket.primaryAssigneeId === user.id;
  }
}
