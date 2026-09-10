/**
 * Ticket Controller
 * Core ticketing operations: creation, updates, status changes, assignment, queue retrieval, and archiving.
 */

import { Role, Priority, Category, Status, AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser } from "../models/types.model";
import { TicketPolicy } from "../models/policies/ticket.policy";
import { LifecycleController } from "./lifecycle.controller";
import { SlaController } from "./sla.controller";
import { AuditController } from "./audit.controller";
import { TimelineController } from "./timeline.controller";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../utils/constants.util";

export interface CreateTicketDTO {
  subject: string;
  description: string;
  requesterId?: string;
  requesterName?: string;
  requesterEmail?: string;
  priority?: Priority;
  customerUrgency?: "LOW" | "NORMAL" | "HIGH";
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

export class TicketController {
  /**
   * Creates a new ticket with automatic SLA due date calculation and audit logging.
   */
  static async createTicket(data: CreateTicketDTO, actor: SessionUser) {
    if (!data.subject?.trim()) throw new Error("Subject is required.");
    if (!data.description?.trim()) throw new Error("Description is required.");

    let requesterId = data.requesterId;
    let requesterName = data.requesterName?.trim();
    let requesterEmail = data.requesterEmail?.trim();
    let priority = data.priority || Priority.MEDIUM;
    let primaryAssigneeId = data.primaryAssigneeId;

    if (actor.role === Role.CUSTOMER) {
      // Security: Hardcode customer's own identity as requester & creator
      requesterId = actor.id;
      requesterName = actor.name;
      requesterEmail = actor.email;
      primaryAssigneeId = null; // Customers cannot assign tickets

      // Server-side mapped urgency -> internal priority
      if (data.customerUrgency === "LOW") {
        priority = Priority.LOW;
      } else if (data.customerUrgency === "HIGH") {
        priority = Priority.HIGH;
      } else {
        priority = Priority.MEDIUM;
      }
    } else {
      if (!requesterName) throw new Error("Requester name is required.");
      if (!requesterEmail) throw new Error("Requester email is required.");

      // If Agent/Supervisor didn't specify requesterId, resolve or use existing customer by email
      if (!requesterId) {
        const existingCustomer = await prisma.user.findUnique({
          where: { email: requesterEmail.toLowerCase() },
        });
        if (existingCustomer) {
          requesterId = existingCustomer.id;
        } else {
          // If no customer user exists yet, link to actor or create customer stub
          requesterId = actor.id;
        }
      }

      if (actor.role === Role.AGENT) {
        if (primaryAssigneeId && primaryAssigneeId !== actor.id) {
          throw new Error("Agents cannot assign tickets to other agents upon creation. Only Supervisors can assign tickets to other agents.");
        }
        if (!primaryAssigneeId) {
          primaryAssigneeId = actor.id;
        }
      }
    }

    const category = data.category || Category.QUESTION;
    const slaTargetMinutes = SlaController.getTargetMinutes(priority);
    const now = new Date();
    const slaDueAt = new Date(now.getTime() + slaTargetMinutes * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          subject: data.subject.trim(),
          description: data.description.trim(),
          requesterId: requesterId!,
          requesterName: requesterName!,
          requesterEmail: requesterEmail!,
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

      await AuditController.log(
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
            requesterId: ticket.requesterId,
            status: ticket.status,
          },
        },
        tx
      );

      await SlaController.syncAlertForTicket(ticket.id, tx);

      return ticket;
    });
  }

  /**
   * Updates ticket subject, description, category, or priority with dynamic SLA recomputation.
   */
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
      const oldTarget = ticket.slaTargetMinutes;
      const newTarget = SlaController.getTargetMinutes(data.priority);
      updateData.slaTargetMinutes = newTarget;

      const targetDeltaMinutes = newTarget - oldTarget;

      if ((ticket.status === Status.NEW || ticket.status === Status.OPEN) && ticket.slaDueAt) {
        updateData.slaDueAt = new Date(new Date(ticket.slaDueAt).getTime() + targetDeltaMinutes * 60 * 1000);
      } else if (ticket.status === Status.PENDING && ticket.slaPausedRemainingSeconds !== null) {
        const newRemaining = Math.max(0, ticket.slaPausedRemainingSeconds + targetDeltaMinutes * 60);
        updateData.slaPausedRemainingSeconds = newRemaining;
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

      await AuditController.log(
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

      await SlaController.syncAlertForTicket(ticketId, tx);

      return updated;
    });
  }

  /**
   * Transitions ticket status with full lifecycle validation and SLA clock adjustments.
   */
  static async changeStatus(ticketId: string, newStatus: Status, actor: SessionUser) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { collaborators: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!TicketPolicy.canEdit(actor, ticket) || actor.role === Role.CUSTOMER) {
      throw new Error("You do not have permission to modify this ticket status.");
    }

    const validation = LifecycleController.validateTransition(ticket.status, newStatus, actor, {
      closedAt: ticket.closedAt,
    });

    if (!validation.valid) {
      throw new Error(validation.reason || "Invalid status transition.");
    }

    const slaUpdates = SlaController.computeStateOnStatusChange(ticket, newStatus, new Date());

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: slaUpdates,
      });

      await AuditController.log(
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

      await SlaController.syncAlertForTicket(ticketId, tx);

      return updated;
    });
  }

  /**
   * Reassigns primary ticket ownership (Supervisors only).
   */
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

      await AuditController.log(
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

  /**
   * Soft-archives a ticket.
   */
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

      await AuditController.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.TICKET_ARCHIVED,
        },
        tx
      );

      await SlaController.syncAlertForTicket(ticketId, tx);

      return updated;
    });
  }

  /**
   * Restores an archived ticket.
   */
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

      await AuditController.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.TICKET_RESTORED,
        },
        tx
      );

      await SlaController.syncAlertForTicket(ticketId, tx);

      return updated;
    });
  }

  /**
   * Retrieves ticket details, permissions, and timeline with query-level privacy scoping.
   */
  static async getTicketDetails(ticketId: string, user: SessionUser) {
    const isCustomer = user.role === Role.CUSTOMER;

    // Defense-in-depth: Query-level filtering
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        primaryAssignee: { select: { id: true, name: true, email: true, role: true } },
        collaborators: isCustomer
          ? false
          : {
              include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                addedBy: { select: { id: true, name: true } },
              },
            },
        slaAlerts: isCustomer
          ? false
          : {
              where: { status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
              orderBy: { createdAt: "desc" },
            },
        satisfaction: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
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

    // Query-level timeline retrieval: customers only get customer-visible replies; no audit logs
    let timeline: any[] = [];
    if (isCustomer) {
      const customerReplies = await prisma.reply.findMany({
        where: {
          ticketId,
          isInternal: false,
        },
        orderBy: { createdAt: "asc" },
      });

      timeline = customerReplies.map((r) => ({
        id: `reply-${r.id}`,
        type: "REPLY" as const,
        createdAt: r.createdAt.toISOString(),
        reply: {
          id: r.id,
          authorId: r.authorId,
          authorType: r.authorType,
          authorName: r.authorName,
          authorEmail: r.authorEmail,
          body: r.body,
          isInternal: false,
        },
      }));
    } else {
      timeline = await TimelineController.getUnifiedTimeline(ticketId);
    }

    return {
      ticket,
      permissions,
      timeline,
    };
  }

  /**
   * Retrieves paginated ticket queue matching filters, scopes, and search keywords.
   */
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

    // Role-based query-level security scoping
    if (user.role === Role.CUSTOMER) {
      // Customer strictly sees ONLY their own tickets, archive always null
      where.requesterId = user.id;
      where.archivedAt = null;
    } else if (user.role === Role.AGENT) {
      if (params.scope === "collaborating") {
        where.collaborators = { some: { userId: user.id } };
      } else if (params.scope === "assigned_to_me") {
        where.primaryAssigneeId = user.id;
      } else {
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
    } else if (params.scope === "due_soon" && user.role !== Role.CUSTOMER) {
      where.status = { in: [Status.NEW, Status.OPEN] };
      where.slaDueAt = {
        gt: now,
        lte: new Date(now.getTime() + 60 * 60 * 1000),
      };
    } else if (params.scope === "breached" && user.role !== Role.CUSTOMER) {
      where.status = { in: [Status.NEW, Status.OPEN] };
      where.slaDueAt = { lte: now };
    }

    // Filters
    if (params.status) where.status = params.status;
    if (params.priority && user.role !== Role.CUSTOMER) where.priority = params.priority;
    if (params.category) where.category = params.category;
    if (params.assigneeId && user.role !== Role.CUSTOMER) where.primaryAssigneeId = params.assigneeId;

    // Search: Subject and Description
    if (params.search?.trim()) {
      const q = params.search.trim();
      const searchConditions: Prisma.TicketWhereInput[] = [
        { subject: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ];

      if (user.role !== Role.CUSTOMER) {
        searchConditions.push(
          { requesterName: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { requesterEmail: { contains: q, mode: Prisma.QueryMode.insensitive } }
        );
      }

      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: searchConditions },
      ];
    }

    // Sorting
    const sortField = params.sort || "createdAt";
    const sortOrder = params.order || "desc";
    const orderBy: Prisma.TicketOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [tickets, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          primaryAssignee: user.role === Role.CUSTOMER ? false : { select: { id: true, name: true, email: true } },
          collaborators: user.role === Role.CUSTOMER ? false : {
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

export const TicketService = TicketController;
