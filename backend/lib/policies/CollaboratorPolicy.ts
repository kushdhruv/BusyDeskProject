import { Role } from "@prisma/client";
import { SessionUser } from "../types";
import { TicketAccessContext } from "./TicketPolicy";

export class CollaboratorPolicy {
  static canManage(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    // Primary assignee agent can manage collaborators
    return ticket.primaryAssigneeId === user.id;
  }
}
