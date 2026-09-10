/**
 * Reply & Internal Notes Policy
 * Authorization checks for adding public replies and private internal notes.
 */

import { Role } from "@prisma/client";
import { SessionUser } from "../types.model";
import { TicketAccessContext, TicketPolicy } from "./ticket.policy";

export class ReplyPolicy {
  static canReply(user: SessionUser, ticket: TicketAccessContext): boolean {
    return TicketPolicy.canView(user, ticket);
  }

  static canAddInternalNote(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.CUSTOMER) {
      return false;
    }
    return TicketPolicy.canView(user, ticket);
  }
}
