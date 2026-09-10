import { Role } from "@prisma/client";
import { SessionUser } from "../types";
import { TicketAccessContext, TicketPolicy } from "./TicketPolicy";

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
