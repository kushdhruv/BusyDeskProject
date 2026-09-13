import { describe, it, expect, beforeEach } from "vitest";
import { Role, Status } from "@prisma/client";
import { TagPolicy } from "@/models/policies/tag.policy";
import { SessionUser } from "@/models/types.model";
import { TicketAccessContext } from "@/models/policies/ticket.policy";
import { slugifyTag } from "@/controllers/tag.controller";

describe("Tag System & Policy Unit Tests", () => {
  const supervisorUser: SessionUser = {
    id: "supervisor-1",
    email: "supervisor@test.com",
    name: "Supervisor Test",
    role: Role.SUPERVISOR,
  };

  const agent1: SessionUser = {
    id: "agent-1",
    email: "agent1@test.com",
    name: "Agent One",
    role: Role.AGENT,
  };

  const agent2: SessionUser = {
    id: "agent-2",
    email: "agent2@test.com",
    name: "Agent Two",
    role: Role.AGENT,
  };

  const customerUser: SessionUser = {
    id: "customer-1",
    email: "customer@test.com",
    name: "Customer One",
    role: Role.CUSTOMER,
  };

  const assignedTicket: TicketAccessContext = {
    id: "ticket-1",
    status: Status.OPEN,
    requesterId: customerUser.id,
    primaryAssigneeId: agent1.id,
    collaborators: [{ userId: agent2.id }],
  };

  const otherTicket: TicketAccessContext = {
    id: "ticket-2",
    status: Status.OPEN,
    requesterId: "other-customer",
    primaryAssigneeId: "other-agent",
    collaborators: [],
  };

  describe("Slugification Utility", () => {
    it("should format tag names to clean lowercase hyphenated slugs", () => {
      expect(slugifyTag("Production")).toBe("production");
      expect(slugifyTag("iOS App (v2.0)")).toBe("ios-app-v2-0");
      expect(slugifyTag("  high priority / urgent  ")).toBe("high-priority-urgent");
      expect(slugifyTag("Bug: Critical -- DB")).toBe("bug-critical-db");
    });
  });

  describe("Tag Group Policy", () => {
    it("allows only Supervisors to create tag groups", () => {
      expect(TagPolicy.canCreateGroup(supervisorUser)).toBe(true);
      expect(TagPolicy.canCreateGroup(agent1)).toBe(false);
      expect(TagPolicy.canCreateGroup(customerUser)).toBe(false);
    });

    it("allows only Supervisors to manage (edit/delete) tag groups", () => {
      expect(TagPolicy.canManageGroup(supervisorUser)).toBe(true);
      expect(TagPolicy.canManageGroup(agent1)).toBe(false);
      expect(TagPolicy.canManageGroup(customerUser)).toBe(false);
    });
  });

  describe("Tag Creation Policy", () => {
    it("allows Supervisors to create grouped or ungrouped tags", () => {
      expect(TagPolicy.canCreateTag(supervisorUser, "group-1")).toBe(true);
      expect(TagPolicy.canCreateTag(supervisorUser, null)).toBe(true);
      expect(TagPolicy.canCreateTag(supervisorUser)).toBe(true);
    });

    it("allows Agents to create ONLY ungrouped tags", () => {
      expect(TagPolicy.canCreateTag(agent1, null)).toBe(true);
      expect(TagPolicy.canCreateTag(agent1, undefined)).toBe(true);
      expect(TagPolicy.canCreateTag(agent1, "group-1")).toBe(false);
    });

    it("denies Customers from creating any tags", () => {
      expect(TagPolicy.canCreateTag(customerUser, null)).toBe(false);
      expect(TagPolicy.canCreateTag(customerUser, "group-1")).toBe(false);
    });
  });

  describe("Tag Lifecycle Policy (Edit, Delete, Merge)", () => {
    it("allows only Supervisors to edit, delete, or merge tags", () => {
      expect(TagPolicy.canEditTag(supervisorUser)).toBe(true);
      expect(TagPolicy.canEditTag(agent1)).toBe(false);
      expect(TagPolicy.canEditTag(customerUser)).toBe(false);

      expect(TagPolicy.canDeleteTag(supervisorUser)).toBe(true);
      expect(TagPolicy.canDeleteTag(agent1)).toBe(false);
      expect(TagPolicy.canDeleteTag(customerUser)).toBe(false);

      expect(TagPolicy.canMergeTag(supervisorUser)).toBe(true);
      expect(TagPolicy.canMergeTag(agent1)).toBe(false);
      expect(TagPolicy.canMergeTag(customerUser)).toBe(false);
    });

    it("restricts tag visibility to internal staff (Supervisors and Agents)", () => {
      expect(TagPolicy.canViewTags(supervisorUser)).toBe(true);
      expect(TagPolicy.canViewTags(agent1)).toBe(true);
      expect(TagPolicy.canViewTags(customerUser)).toBe(false);
    });
  });

  describe("Ticket Tag Application & Removal Policy", () => {
    it("allows assigned Agent or collaborator to apply tags to ticket", () => {
      expect(TagPolicy.canApplyTagToTicket(agent1, assignedTicket)).toBe(true);
      expect(TagPolicy.canApplyTagToTicket(agent2, assignedTicket)).toBe(true);
      expect(TagPolicy.canApplyTagToTicket(supervisorUser, assignedTicket)).toBe(true);
    });

    it("prevents unassigned Agent from modifying tags on another agent's ticket", () => {
      expect(TagPolicy.canApplyTagToTicket(agent1, otherTicket)).toBe(false);
    });

    it("strictly prevents Customers from applying tags", () => {
      expect(TagPolicy.canApplyTagToTicket(customerUser, assignedTicket)).toBe(false);
      expect(TagPolicy.canApplyTagToTicket(customerUser, otherTicket)).toBe(false);
    });

    it("allows Supervisors to remove any tag from tickets", () => {
      expect(TagPolicy.canRemoveTagFromTicket(supervisorUser, assignedTicket, "someone-else")).toBe(true);
    });

    it("allows Agent who added tag to remove it", () => {
      expect(TagPolicy.canRemoveTagFromTicket(agent1, assignedTicket, agent1.id)).toBe(true);
    });

    it("allows primary assignee to remove any tag on their assigned ticket", () => {
      expect(TagPolicy.canRemoveTagFromTicket(agent1, assignedTicket, "other-user-id")).toBe(true);
    });

    it("strictly prevents Customers from removing tags", () => {
      expect(TagPolicy.canRemoveTagFromTicket(customerUser, assignedTicket, customerUser.id)).toBe(false);
    });
  });
});
