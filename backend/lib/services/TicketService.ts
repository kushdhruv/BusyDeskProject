import { Role, Priority, Category, Status, AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { SessionUser } from "../types";
import { TicketPolicy } from "../policies/TicketPolicy";
import { LifecycleService } from "./LifecycleService";
import { SlaService } from "./SlaService";
import { AuditService } from "./AuditService";
import { TimelineService } from "./TimelineService";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants";

export interface CreateTicketDTO {
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  priority?: Priority;
  category?: Category;
  primaryAssigneeId?: string | null;
}

export interface GetQueueParams {
  search?: string;
  status?: Status;
  priority?: Priority;
  category?: Category;
  assigneeId?: string;
  scope?: "all" | "assigned_to_me" | "collaborating" | "awaiting_customer" | "due_soon" | "breached" | "archived";
  sort?: "createdAt" | "updatedAt" | "priority" | "slaDueAt";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export class TicketService {
  static async createTicket(data: CreateTicketDTO, actor: SessionUser) {
    if (!data.subject?.trim()) throw new Error("Subject is required.");
    if (!data.description?.trim()) throw new Error("Description is required.");
    if (!data.requesterName?.trim()) throw new Error("Requester name is required.");
    if (!data.requesterEmail?.trim()) throw new Error("Requester email is required.");

    const priority = data.priority || Priority.MEDIUM;
    const category = data.category || Category.QUESTION;
    const slaTargetMinutes = SlaService.getTargetMinutes(priority);

    // Default primary assignee: If Agent creates ticket, auto-assign to creator so they immediately have working permissions
    let primaryAssigneeId = data.primaryAssigneeId;
    if (actor.role === Role.AGENT && !primaryAssigneeId) {
      primaryAssigneeId = actor.id;
    }

    const now = new Date();
    const slaDueAt = new Date(now.getTime() + slaTargetMinutes * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          subject: data.subject.trim(),
          description: data.description.trim(),
          requesterName: data.requesterName.trim(),
          requesterEmail: data.requesterEmail.trim(),
          priority,
          category,
          status: Status.NEW,
          createdById: actor.id,
          primaryAssigneeId: primaryAssigneeId || null,
          slaTargetMinutes,
          slaDueAt,
          slaCycle: 1,
        },
        include: {
          primaryAssignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await AuditService.log(
        {
          ticketId: ticket.id,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.TICKET_CREATED,
          newValue: {
            subject: ticket.subject,
            priority: ticket.priority,
            category: ticket.category,
            primaryAssigneeId: ticket.primaryAssigneeId,
            status: ticket.status,
          },
        },
        tx
      );

      await SlaService.syncAlertForTicket(ticket.id, tx);

      return ticket;
    });
  }

  static async updateTicketDetails(
    ticketId: string,
    data: { subject?: string; description?: string; priority?: Priority; category?: Category },
    actor: SessionUser
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { collaborators: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!TicketPolicy.canEdit(actor, ticket)) {
      throw new Error("You do not have permission to edit this ticket.");
    }

    const updateData: Prisma.TicketUpdateInput = {};
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (data.subject && data.subject.trim() !== ticket.subject) {
      oldValues.subject = ticket.subject;
      newValues.subject = data.subject.trim();
      updateData.subject = data.subject.trim();
    }

    if (data.description && data.description.trim() !== ticket.description) {
      oldValues.description = ticket.description;
      newValues.description = data.description.trim();
      updateData.description = data.description.trim();
    }

    if (data.category && data.category !== ticket.category) {
      oldValues.category = ticket.category;
      newValues.category = data.category;
      updateData.category = data.category;
    }

    if (data.priority && data.priority !== ticket.priority) {
      oldValues.priority = ticket.priority;
      newValues.priority = data.priority;
      updateData.priority = data.priority;

      // Update SLA target if priority changes
      const newTarget = SlaService.getTargetMinutes(data.priority);
      updateData.slaTargetMinutes = newTarget;

      if (ticket.status === Status.NEW || ticket.status === Status.OPEN) {
        updateData.slaDueAt = new Date(ticket.createdAt.getTime() + newTarget * 60 * 1000);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return ticket;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.TICKET_EDITED,
          oldValue: oldValues,
          newValue: newValues,
        },
        tx
      );

      await SlaService.syncAlertForTicket(ticketId, tx);

      return updated;
    });
  }

  static async changeStatus(ticketId: string, newStatus: Status, actor: SessionUser) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { collaborators: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!TicketPolicy.canEdit(actor, ticket)) {
      throw new Error("You do not have permission to modify this ticket.");
    }

    const validation = LifecycleService.validateTransition(ticket.status, newStatus, actor, {
      closedAt: ticket.closedAt,
    });

    if (!validation.valid) {
      throw new Error(validation.reason || "Invalid status transition.");
    }

    const slaUpdates = SlaService.computeStateOnStatusChange(ticket, newStatus, new Date());

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: slaUpdates,
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.STATUS_CHANGED,
          oldValue: { status: ticket.status },
          newValue: { status: newStatus },
          metadata: {
            slaPausedRemainingSeconds: slaUpdates.slaPausedRemainingSeconds,
            slaDueAt: slaUpdates.slaDueAt,
            slaCycle: slaUpdates.slaCycle,
          },
        },
        tx
      );

      await SlaService.syncAlertForTicket(ticketId, tx);

      return updated;
    });
  }

  static async reassign(ticketId: string, newAssigneeId: string | null, actor: SessionUser) {
    if (!TicketPolicy.canReassign(actor)) {
      throw new Error("Only Supervisors are authorized to reassign primary ticket ownership.");
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { primaryAssignee: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    let newAssigneeUser: { id: string; name: string } | null = null;
    if (newAssigneeId) {
      newAssigneeUser = await prisma.user.findUnique({
        where: { id: newAssigneeId },
        select: { id: true, name: true },
      });
      if (!newAssigneeUser) {
        throw new Error("Target assignee user not found.");
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { primaryAssigneeId: newAssigneeId },
        include: { primaryAssignee: true },
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.REASSIGNED,
          oldValue: {
            assigneeId: ticket.primaryAssigneeId,
            assigneeName: ticket.primaryAssignee?.name || "Unassigned",
          },
          newValue: {
            assigneeId: newAssigneeId,
            assigneeName: newAssigneeUser?.name || "Unassigned",
          },
        },
        tx
      );

      return updated;
    });
  }

  static async archive(ticketId: string, actor: SessionUser) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { collaborators: true },
    });

    if (!ticket) throw new Error("Ticket not found.");
    if (!TicketPolicy.canArchive(actor, ticket)) {
      throw new Error("You do not have permission to archive this ticket.");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { archivedAt: new Date() },
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.TICKET_ARCHIVED,
        },
        tx
      );

      await SlaService.syncAlertForTicket(ticketId, tx);

      return updated;
    });
  }

  static async restore(ticketId: string, actor: SessionUser) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { collaborators: true },
    });

    if (!ticket) throw new Error("Ticket not found.");
    if (!TicketPolicy.canArchive(actor, ticket)) {
      throw new Error("You do not have permission to restore this ticket.");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { archivedAt: null },
      });

      await AuditService.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.TICKET_RESTORED,
        },
        tx
      );

      await SlaService.syncAlertForTicket(ticketId, tx);

      return updated;
    });
  }

  static async getTicketDetails(ticketId: string, user: SessionUser) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        primaryAssignee: { select: { id: true, name: true, email: true, role: true } },
        collaborators: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            addedBy: { select: { id: true, name: true } },
          },
        },
        slaAlerts: {
          where: { status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!TicketPolicy.canView(user, ticket)) {
      throw new Error("You do not have permission to view this ticket.");
    }

    const permissions = TicketPolicy.computePermissions(user, ticket);
    const timeline = await TimelineService.getUnifiedTimeline(ticketId);

    return {
      ticket,
      permissions,
      timeline,
    };
  }

  static async getQueue(params: GetQueueParams, user: SessionUser) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, params.limit || DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};

    // Explicit Archive Rule: Default queries strictly exclude archived tickets
    if (params.scope === "archived") {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

    // Role-based visibility scoping
    if (user.role === Role.AGENT) {
      if (params.scope === "collaborating") {
        where.collaborators = { some: { userId: user.id } };
      } else if (params.scope === "assigned_to_me") {
        where.primaryAssigneeId = user.id;
      } else {
        // Agent sees assigned + collaborating
        where.OR = [
          { primaryAssigneeId: user.id },
          { collaborators: { some: { userId: user.id } } },
        ];
      }
    } else if (params.scope === "assigned_to_me") {
      where.primaryAssigneeId = user.id;
    }

    // Specific Scope filters
    const now = new Date();
    if (params.scope === "awaiting_customer") {
      where.status = Status.PENDING;
    } else if (params.scope === "due_soon") {
      where.status = { in: [Status.NEW, Status.OPEN] };
      where.slaDueAt = {
        gt: now,
        lte: new Date(now.getTime() + 60 * 60 * 1000),
      };
    } else if (params.scope === "breached") {
      where.status = { in: [Status.NEW, Status.OPEN] };
      where.slaDueAt = { lte: now };
    }

    // Filters
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.category) where.category = params.category;
    if (params.assigneeId) where.primaryAssigneeId = params.assigneeId;

    // Search: Subject and Description
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { subject: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { requesterName: { contains: q, mode: "insensitive" } },
            { requesterEmail: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    // Sorting
    const sortField = params.sort || "createdAt";
    const sortOrder = params.order || "desc";
    const orderBy: Prisma.TicketOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    // Server-side pagination via concurrent queries
    const [tickets, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          primaryAssignee: { select: { id: true, name: true, email: true } },
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          _count: { select: { replies: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      tickets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
