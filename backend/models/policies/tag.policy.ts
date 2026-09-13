/**
 * Tag Authorization Policy
 * Enforces fine-grained permissions across Tag Groups, Tags, and Ticket Tag associations.
 */

import { Role } from "@prisma/client";
import { SessionUser } from "../types.model";
import { TicketAccessContext, TicketPolicy } from "./ticket.policy";

export class TagPolicy {
  /**
   * Only Supervisors can create tag groups.
   */
  static canCreateGroup(user: SessionUser): boolean {
    return user.role === Role.SUPERVISOR;
  }

  /**
   * Only Supervisors can edit or delete tag groups.
   */
  static canManageGroup(user: SessionUser): boolean {
    return user.role === Role.SUPERVISOR;
  }

  /**
   * Supervisors can create tags in any group or ungrouped.
   * Agents can only create ungrouped ad-hoc tags.
   * Customers cannot create tags.
   */
  static canCreateTag(user: SessionUser, groupId?: string | null): boolean {
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    if (user.role === Role.AGENT) {
      return !groupId;
    }
    return false;
  }

  /**
   * Only Supervisors can edit tag properties (name, color, group assignment).
   */
  static canEditTag(user: SessionUser): boolean {
    return user.role === Role.SUPERVISOR;
  }

  /**
   * Only Supervisors can delete tags.
   */
  static canDeleteTag(user: SessionUser): boolean {
    return user.role === Role.SUPERVISOR;
  }

  /**
   * Only Supervisors can merge tags.
   */
  static canMergeTag(user: SessionUser): boolean {
    return user.role === Role.SUPERVISOR;
  }

  /**
   * Agents and Supervisors can view tags (internal metadata). Customers cannot.
   */
  static canViewTags(user: SessionUser): boolean {
    return user.role !== Role.CUSTOMER;
  }

  /**
   * Agents and Supervisors who have access to the ticket can apply tags.
   */
  static canApplyTagToTicket(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.CUSTOMER) {
      return false;
    }
    return TicketPolicy.canEdit(user, ticket);
  }

  /**
   * Agents and Supervisors who have access to the ticket can remove tags.
   * Supervisors can remove any tag.
   * Agents can remove tags they applied or if they can edit the ticket.
   */
  static canRemoveTagFromTicket(
    user: SessionUser,
    ticket: TicketAccessContext,
    tagAddedById?: string | null
  ): boolean {
    if (user.role === Role.CUSTOMER) {
      return false;
    }
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    if (tagAddedById && user.id === tagAddedById) {
      return true;
    }
    return TicketPolicy.canEdit(user, ticket);
  }
}
