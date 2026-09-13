/**
 * Tag & Tag Group Controller
 * Provides enterprise-grade tag lifecycle management, group hierarchies,
 * autocomplete search, merge operations, and ticket tagging with audit logging.
 */

import { AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { SessionUser } from "../models/types.model";
import { TagPolicy } from "../models/policies/tag.policy";
import { TicketPolicy } from "../models/policies/ticket.policy";
import { AuditController } from "./audit.controller";

export function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CreateTagGroupInput {
  name: string;
  description?: string;
  color?: string;
  isExclusive?: boolean;
  displayOrder?: number;
}

export interface UpdateTagGroupInput {
  name?: string;
  description?: string;
  color?: string;
  isExclusive?: boolean;
  displayOrder?: number;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  groupId?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  groupId?: string | null;
}

export class TagController {
  // ==========================================
  // TAG GROUPS
  // ==========================================

  static async listTagGroups(actor: SessionUser) {
    if (!TagPolicy.canViewTags(actor)) {
      throw new Error("Unauthorized to view tag groups.");
    }

    return prisma.tagGroup.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        tags: {
          orderBy: [{ usageCount: "desc" }, { name: "asc" }],
        },
      },
    });
  }

  static async getTagGroupById(id: string, actor: SessionUser) {
    if (!TagPolicy.canViewTags(actor)) {
      throw new Error("Unauthorized to view tag group.");
    }

    const group = await prisma.tagGroup.findUnique({
      where: { id },
      include: {
        tags: {
          orderBy: [{ usageCount: "desc" }, { name: "asc" }],
        },
      },
    });

    if (!group) {
      throw new Error("Tag group not found.");
    }

    return group;
  }

  static async createTagGroup(data: CreateTagGroupInput, actor: SessionUser) {
    if (!TagPolicy.canCreateGroup(actor)) {
      throw new Error("Only Supervisors can create tag groups.");
    }

    const trimmedName = data.name?.trim();
    if (!trimmedName) {
      throw new Error("Tag group name is required.");
    }

    const existing = await prisma.tagGroup.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      throw new Error(`A tag group with the name "${trimmedName}" already exists.`);
    }

    return prisma.tagGroup.create({
      data: {
        name: trimmedName,
        description: data.description?.trim() || null,
        color: data.color || "#6B7280",
        isExclusive: !!data.isExclusive,
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  static async updateTagGroup(id: string, data: UpdateTagGroupInput, actor: SessionUser) {
    if (!TagPolicy.canManageGroup(actor)) {
      throw new Error("Only Supervisors can update tag groups.");
    }

    const existing = await prisma.tagGroup.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Tag group not found.");
    }

    const updateData: Prisma.TagGroupUpdateInput = {};

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new Error("Tag group name cannot be empty.");
      }
      if (trimmed !== existing.name) {
        const nameConflict = await prisma.tagGroup.findUnique({ where: { name: trimmed } });
        if (nameConflict) {
          throw new Error(`Tag group name "${trimmed}" is already taken.`);
        }
        updateData.name = trimmed;
      }
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.color !== undefined) {
      updateData.color = data.color;
    }
    if (data.isExclusive !== undefined) {
      updateData.isExclusive = data.isExclusive;
    }
    if (data.displayOrder !== undefined) {
      updateData.displayOrder = data.displayOrder;
    }

    return prisma.tagGroup.update({
      where: { id },
      data: updateData,
    });
  }

  static async deleteTagGroup(id: string, actor: SessionUser) {
    if (!TagPolicy.canManageGroup(actor)) {
      throw new Error("Only Supervisors can delete tag groups.");
    }

    const existing = await prisma.tagGroup.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Tag group not found.");
    }

    // Deleting the group unlinks tags (SetNull in schema), keeping tags intact as ungrouped
    return prisma.tagGroup.delete({
      where: { id },
    });
  }

  // ==========================================
  // TAGS (CRUD, SEARCH, AUTOCOMPLETE, MERGE)
  // ==========================================

  static async listTags(
    params: { groupId?: string | null; ungroupedOnly?: boolean; search?: string },
    actor: SessionUser
  ) {
    if (!TagPolicy.canViewTags(actor)) {
      throw new Error("Unauthorized to view tags.");
    }

    const where: Prisma.TagWhereInput = {};

    if (params.ungroupedOnly) {
      where.groupId = null;
    } else if (params.groupId !== undefined) {
      where.groupId = params.groupId;
    }

    if (params.search) {
      const q = params.search.trim().toLowerCase();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }

    return prisma.tag.findMany({
      where,
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
      include: {
        group: {
          select: { id: true, name: true, color: true, isExclusive: true },
        },
        _count: {
          select: { tickets: true },
        },
      },
    });
  }

  static async searchTags(query: string, actor: SessionUser, limit: number = 10) {
    if (!TagPolicy.canViewTags(actor)) {
      throw new Error("Unauthorized to view tags.");
    }

    const q = query.trim().toLowerCase();
    if (!q) {
      return prisma.tag.findMany({
        take: limit,
        orderBy: { usageCount: "desc" },
        include: {
          group: {
            select: { id: true, name: true, color: true, isExclusive: true },
          },
        },
      });
    }

    return prisma.tag.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
      include: {
        group: {
          select: { id: true, name: true, color: true, isExclusive: true },
        },
      },
    });
  }

  static async getTagById(id: string, actor: SessionUser) {
    if (!TagPolicy.canViewTags(actor)) {
      throw new Error("Unauthorized to view tag.");
    }

    const tag = await prisma.tag.findUnique({
      where: { id },
      include: {
        group: true,
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!tag) {
      throw new Error("Tag not found.");
    }

    return tag;
  }

  static async createTag(data: CreateTagInput, actor: SessionUser) {
    if (!TagPolicy.canCreateTag(actor, data.groupId)) {
      throw new Error("Unauthorized to create tags with the specified group.");
    }

    const trimmedName = data.name?.trim();
    if (!trimmedName) {
      throw new Error("Tag name is required.");
    }

    // Slug generation
    let baseSlug = slugifyTag(trimmedName);
    if (!baseSlug) {
      baseSlug = "tag";
    }

    // Ensure slug uniqueness
    let finalSlug = baseSlug;
    let counter = 1;
    while (await prisma.tag.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    let groupColor = data.color;
    if (data.groupId) {
      const group = await prisma.tagGroup.findUnique({ where: { id: data.groupId } });
      if (!group) {
        throw new Error("Assigned tag group does not exist.");
      }
      if (!groupColor) {
        groupColor = group.color;
      }
    }

    return prisma.tag.create({
      data: {
        name: trimmedName,
        slug: finalSlug,
        color: groupColor || "#6B7280",
        groupId: data.groupId || null,
      },
      include: {
        group: true,
      },
    });
  }

  static async updateTag(id: string, data: UpdateTagInput, actor: SessionUser) {
    if (!TagPolicy.canEditTag(actor)) {
      throw new Error("Only Supervisors can edit tag properties.");
    }

    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Tag not found.");
    }

    const updateData: Prisma.TagUpdateInput = {};

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new Error("Tag name cannot be empty.");
      }
      if (trimmed !== existing.name) {
        let baseSlug = slugifyTag(trimmed) || "tag";
        let finalSlug = baseSlug;
        let counter = 1;
        while (true) {
          const match = await prisma.tag.findUnique({ where: { slug: finalSlug } });
          if (!match || match.id === id) break;
          finalSlug = `${baseSlug}-${counter++}`;
        }
        updateData.name = trimmed;
        updateData.slug = finalSlug;
      }
    }

    if (data.color !== undefined) {
      updateData.color = data.color;
    }

    if (data.groupId !== undefined) {
      if (data.groupId) {
        const group = await prisma.tagGroup.findUnique({ where: { id: data.groupId } });
        if (!group) {
          throw new Error("Tag group does not exist.");
        }
        updateData.group = { connect: { id: data.groupId } };
      } else {
        updateData.group = { disconnect: true };
      }
    }

    return prisma.tag.update({
      where: { id },
      data: updateData,
      include: {
        group: true,
      },
    });
  }

  static async deleteTag(id: string, actor: SessionUser) {
    if (!TagPolicy.canDeleteTag(actor)) {
      throw new Error("Only Supervisors can delete tags.");
    }

    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Tag not found.");
    }

    // Cascade deletes TicketTag associations via Prisma schema onDelete: Cascade
    return prisma.tag.delete({
      where: { id },
    });
  }

  static async mergeTags(sourceTagId: string, targetTagId: string, actor: SessionUser) {
    if (!TagPolicy.canMergeTag(actor)) {
      throw new Error("Only Supervisors can merge tags.");
    }

    if (sourceTagId === targetTagId) {
      throw new Error("Source and target tags cannot be identical.");
    }

    const sourceTag = await prisma.tag.findUnique({
      where: { id: sourceTagId },
      include: { tickets: true },
    });
    if (!sourceTag) {
      throw new Error("Source tag not found.");
    }

    const targetTag = await prisma.tag.findUnique({
      where: { id: targetTagId },
      include: { tickets: true },
    });
    if (!targetTag) {
      throw new Error("Target tag not found.");
    }

    return prisma.$transaction(async (tx) => {
      const targetTicketIds = new Set(targetTag.tickets.map((t) => t.ticketId));

      for (const st of sourceTag.tickets) {
        if (targetTicketIds.has(st.ticketId)) {
          // Ticket already has the target tag, simply remove source association
          await tx.ticketTag.delete({ where: { id: st.id } });
        } else {
          // Re-point source tag association to target tag
          await tx.ticketTag.update({
            where: { id: st.id },
            data: { tagId: targetTagId },
          });
        }
      }

      // Recompute actual usage count for target tag
      const actualTargetUsage = await tx.ticketTag.count({
        where: { tagId: targetTagId },
      });

      await tx.tag.update({
        where: { id: targetTagId },
        data: { usageCount: actualTargetUsage },
      });

      // Delete the source tag
      await tx.tag.delete({
        where: { id: sourceTagId },
      });

      return {
        success: true,
        sourceTag: sourceTag.name,
        targetTag: targetTag.name,
        ticketsMigrated: sourceTag.tickets.length,
        newUsageCount: actualTargetUsage,
      };
    });
  }

  // ==========================================
  // TICKET TAG ACTIONS
  // ==========================================

  static async addTagsToTicket(ticketId: string, tagIds: string[], actor: SessionUser) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        collaborators: true,
        tags: {
          include: {
            tag: {
              include: { group: true },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!TagPolicy.canApplyTagToTicket(actor, ticket)) {
      throw new Error("You do not have permission to modify tags on this ticket.");
    }

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return ticket.tags;
    }

    // Fetch candidate tags to add
    const candidateTags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      include: { group: true },
    });

    if (candidateTags.length === 0) {
      return ticket.tags;
    }

    return prisma.$transaction(async (tx) => {
      const existingTagIds = new Set(ticket.tags.map((tt) => tt.tagId));
      const addedTags: { id: string; name: string }[] = [];

      for (const newTag of candidateTags) {
        if (existingTagIds.has(newTag.id)) {
          continue; // Already applied
        }

        // Check if tag belongs to an exclusive group
        if (newTag.group?.isExclusive) {
          // Find any existing ticket tag belonging to the same exclusive group
          const conflicting = ticket.tags.find(
            (tt) => tt.tag.groupId === newTag.groupId && tt.tagId !== newTag.id
          );
          if (conflicting) {
            // Replace existing exclusive tag with the new one
            await tx.ticketTag.delete({ where: { id: conflicting.id } });
            await tx.tag.update({
              where: { id: conflicting.tagId },
              data: { usageCount: { decrement: 1 } },
            });
            existingTagIds.delete(conflicting.tagId);

            // Audit the removal
            await AuditController.log(
              {
                ticketId,
                actorId: actor.id,
                actorName: actor.name,
                eventType: AuditEventType.TAG_REMOVED,
                oldValue: { tagId: conflicting.tagId, tagName: conflicting.tag.name },
                metadata: { reason: "Replaced by exclusive group tag", newTagId: newTag.id },
              },
              tx
            );
          }
        }

        // Add the new tag
        await tx.ticketTag.create({
          data: {
            ticketId,
            tagId: newTag.id,
            addedById: actor.id,
          },
        });

        // Increment usage count
        await tx.tag.update({
          where: { id: newTag.id },
          data: { usageCount: { increment: 1 } },
        });

        existingTagIds.add(newTag.id);
        addedTags.push({ id: newTag.id, name: newTag.name });

        // Audit the addition
        await AuditController.log(
          {
            ticketId,
            actorId: actor.id,
            actorName: actor.name,
            eventType: AuditEventType.TAG_ADDED,
            newValue: { tagId: newTag.id, tagName: newTag.name },
            metadata: { group: newTag.group?.name || null },
          },
          tx
        );
      }

      // Return updated tags
      return tx.ticketTag.findMany({
        where: { ticketId },
        include: {
          tag: {
            include: { group: true },
          },
          addedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });
  }

  static async removeTagFromTicket(ticketId: string, tagId: string, actor: SessionUser) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        collaborators: true,
      },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    const ticketTag = await prisma.ticketTag.findUnique({
      where: {
        ticketId_tagId: {
          ticketId,
          tagId,
        },
      },
      include: {
        tag: true,
      },
    });

    if (!ticketTag) {
      throw new Error("Tag is not associated with this ticket.");
    }

    if (!TagPolicy.canRemoveTagFromTicket(actor, ticket, ticketTag.addedById)) {
      throw new Error("You do not have permission to remove this tag.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.ticketTag.delete({
        where: { id: ticketTag.id },
      });

      // Decrement usage count, floor at 0
      const current = await tx.tag.findUnique({ where: { id: tagId }, select: { usageCount: true } });
      if (current && current.usageCount > 0) {
        await tx.tag.update({
          where: { id: tagId },
          data: { usageCount: { decrement: 1 } },
        });
      }

      await AuditController.log(
        {
          ticketId,
          actorId: actor.id,
          actorName: actor.name,
          eventType: AuditEventType.TAG_REMOVED,
          oldValue: { tagId: ticketTag.tagId, tagName: ticketTag.tag.name },
        },
        tx
      );

      return { success: true, removedTagId: tagId };
    });
  }

  static async getTicketTags(ticketId: string, actor: SessionUser) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { collaborators: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!TicketPolicy.canView(actor, ticket) || !TagPolicy.canViewTags(actor)) {
      throw new Error("Unauthorized to view tags for this ticket.");
    }

    return prisma.ticketTag.findMany({
      where: { ticketId },
      include: {
        tag: {
          include: { group: true },
        },
        addedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}
