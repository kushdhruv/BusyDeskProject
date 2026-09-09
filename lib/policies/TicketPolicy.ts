import { Role, Status } from "@prisma/client";
import { SessionUser, TicketPermissions } from "../types";
import { REOPEN_WINDOW_MS } from "../constants";

export interface TicketAccessContext {
  id: string;
  status: Status;
  primaryAssigneeId: string | null;
  closedAt?: Date | null;
  archivedAt?: Date | null;
  collaborators?: { userId: string }[];
}

export class TicketPolicy {
  static canView(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    // Agent can view if primary assignee or collaborator
    if (ticket.primaryAssigneeId === user.id) {
      return true;
    }
    if (ticket.collaborators && ticket.collaborators.some((c) => c.userId === user.id)) {
      return true;
    }
    return false;
  }

  static canEdit(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    // Agent can edit if assigned or collaborator
    return this.canView(user, ticket);
  }

  static canReassign(user: SessionUser): boolean {
    // Only Supervisors can reassign primary assignee. Agents cannot reassign away from themselves.
    return user.role === Role.SUPERVISOR;
  }

  static canClose(user: SessionUser, ticket: TicketAccessContext): boolean {
    // Only Supervisors are authorized to close tickets (RESOLVED -> CLOSED)
    if (user.role !== Role.SUPERVISOR) {
      return false;
    }
    return ticket.status === Status.RESOLVED;
  }

  static canReopen(user: SessionUser, ticket: TicketAccessContext): boolean {
    // Only Supervisors can reopen a CLOSED ticket, and strictly within the 7-day window
    if (user.role !== Role.SUPERVISOR) {
      return false;
    }
    if (ticket.status !== Status.CLOSED) {
      return false;
    }
    if (!ticket.closedAt) {
      return false;
    }
    const elapsed = Date.now() - new Date(ticket.closedAt).getTime();
    return elapsed <= REOPEN_WINDOW_MS;
  }

  static canArchive(user: SessionUser, ticket: TicketAccessContext): boolean {
    if (user.role === Role.SUPERVISOR) {
      return true;
    }
    return ticket.primaryAssigneeId === user.id;
  }

  static computePermissions(user: SessionUser, ticket: TicketAccessContext): TicketPermissions {
    return {
      canView: this.canView(user, ticket),
      canEdit: this.canEdit(user, ticket),
      canReassign: this.canReassign(user),
      canClose: this.canClose(user, ticket),
      canReopen: this.canReopen(user, ticket),
      canArchive: this.canArchive(user, ticket),
      canReply: this.canView(user, ticket),
      canAddInternalNote: this.canView(user, ticket),
      canManageCollaborators: user.role === Role.SUPERVISOR || ticket.primaryAssigneeId === user.id,
      canAcknowledgeAlert: user.role === Role.SUPERVISOR || ticket.primaryAssigneeId === user.id,
    };
  }
}
