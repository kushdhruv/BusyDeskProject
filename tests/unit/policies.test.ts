import { describe, it, expect } from "vitest";
import { Role, Status } from "@prisma/client";
import { TicketPolicy, TicketAccessContext } from "../../lib/policies/TicketPolicy";
import { ReplyPolicy } from "../../lib/policies/ReplyPolicy";
import { CollaboratorPolicy } from "../../lib/policies/CollaboratorPolicy";
import { AlertPolicy } from "../../lib/policies/AlertPolicy";
import { SessionUser } from "../../lib/types";
import { REOPEN_WINDOW_MS } from "../../lib/constants";

describe("Unit Tests: Policy & Permission Layer", () => {
  const supervisorUser: SessionUser = {
    id: "user-supervisor-1",
    email: "supervisor@test.com",
    name: "Supervisor Test",
    role: Role.SUPERVISOR,
  };

  const agent1: SessionUser = {
    id: "user-agent-1",
    email: "agent1@test.com",
    name: "Agent One",
    role: Role.AGENT,
  };

  const agent2: SessionUser = {
    id: "user-agent-2",
    email: "agent2@test.com",
    name: "Agent Two",
    role: Role.AGENT,
  };

  const unassignedTicket: TicketAccessContext = {
    id: "ticket-1",
    status: Status.OPEN,
    primaryAssigneeId: null,
    collaborators: [],
  };

  const assignedToAgent1: TicketAccessContext = {
    id: "ticket-2",
    status: Status.OPEN,
    primaryAssigneeId: agent1.id,
    collaborators: [{ userId: agent2.id }],
  };

  describe("TicketPolicy.canView", () => {
    it("Supervisor can view any ticket (assigned, unassigned, or collaborating)", () => {
      expect(TicketPolicy.canView(supervisorUser, unassignedTicket)).toBe(true);
      expect(TicketPolicy.canView(supervisorUser, assignedToAgent1)).toBe(true);
    });

    it("Primary Assignee Agent can view their assigned ticket", () => {
      expect(TicketPolicy.canView(agent1, assignedToAgent1)).toBe(true);
    });

    it("Collaborator Agent can view the ticket", () => {
      expect(TicketPolicy.canView(agent2, assignedToAgent1)).toBe(true);
    });

    it("Unrelated Agent cannot view ticket if neither primary assignee nor collaborator", () => {
      const agent3: SessionUser = {
        id: "user-agent-3",
        email: "agent3@test.com",
        name: "Agent Three",
        role: Role.AGENT,
      };
      expect(TicketPolicy.canView(agent3, assignedToAgent1)).toBe(false);
      expect(TicketPolicy.canView(agent3, unassignedTicket)).toBe(false);
    });

    it("Handles null or undefined collaborators gracefully", () => {
      const ticketWithoutCollabs: TicketAccessContext = {
        id: "ticket-3",
        status: Status.OPEN,
        primaryAssigneeId: agent1.id,
        collaborators: undefined,
      };
      expect(TicketPolicy.canView(agent1, ticketWithoutCollabs)).toBe(true);
      expect(TicketPolicy.canView(agent2, ticketWithoutCollabs)).toBe(false);
    });
  });

  describe("TicketPolicy.canReassign", () => {
    it("Supervisor is allowed to reassign tickets", () => {
      expect(TicketPolicy.canReassign(supervisorUser)).toBe(true);
    });

    it("Agent is strictly prohibited from reassigning tickets away or to others", () => {
      expect(TicketPolicy.canReassign(agent1)).toBe(false);
    });
  });

  describe("TicketPolicy.canClose", () => {
    it("Supervisor can close a RESOLVED ticket", () => {
      const resolvedTicket: TicketAccessContext = {
        id: "ticket-r",
        status: Status.RESOLVED,
        primaryAssigneeId: agent1.id,
      };
      expect(TicketPolicy.canClose(supervisorUser, resolvedTicket)).toBe(true);
    });

    it("Supervisor cannot close an OPEN or PENDING ticket (must be RESOLVED first)", () => {
      expect(TicketPolicy.canClose(supervisorUser, unassignedTicket)).toBe(false);
      const pendingTicket: TicketAccessContext = {
        id: "ticket-p",
        status: Status.PENDING,
        primaryAssigneeId: agent1.id,
      };
      expect(TicketPolicy.canClose(supervisorUser, pendingTicket)).toBe(false);
    });

    it("Agent cannot close tickets even if RESOLVED or assigned to them", () => {
      const resolvedTicket: TicketAccessContext = {
        id: "ticket-r",
        status: Status.RESOLVED,
        primaryAssigneeId: agent1.id,
      };
      expect(TicketPolicy.canClose(agent1, resolvedTicket)).toBe(false);
    });
  });

  describe("TicketPolicy.canReopen", () => {
    it("Supervisor can reopen CLOSED ticket within 7-day window", () => {
      const recentClosedTicket: TicketAccessContext = {
        id: "ticket-c1",
        status: Status.CLOSED,
        primaryAssigneeId: agent1.id,
        closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };
      expect(TicketPolicy.canReopen(supervisorUser, recentClosedTicket)).toBe(true);
    });

    it("Supervisor cannot reopen CLOSED ticket past the 7-day window", () => {
      const expiredClosedTicket: TicketAccessContext = {
        id: "ticket-c2",
        status: Status.CLOSED,
        primaryAssigneeId: agent1.id,
        closedAt: new Date(Date.now() - (REOPEN_WINDOW_MS + 10000)), // 7 days + 10s
      };
      expect(TicketPolicy.canReopen(supervisorUser, expiredClosedTicket)).toBe(false);
    });

    it("Supervisor cannot reopen ticket if closedAt is null or missing", () => {
      const corruptClosedTicket: TicketAccessContext = {
        id: "ticket-c3",
        status: Status.CLOSED,
        primaryAssigneeId: agent1.id,
        closedAt: null,
      };
      expect(TicketPolicy.canReopen(supervisorUser, corruptClosedTicket)).toBe(false);
    });

    it("Supervisor cannot reopen ticket that is not CLOSED (e.g. OPEN or RESOLVED)", () => {
      expect(TicketPolicy.canReopen(supervisorUser, assignedToAgent1)).toBe(false);
    });

    it("Agent cannot reopen CLOSED ticket even within 7 days", () => {
      const recentClosedTicket: TicketAccessContext = {
        id: "ticket-c1",
        status: Status.CLOSED,
        primaryAssigneeId: agent1.id,
        closedAt: new Date(Date.now() - 1000),
      };
      expect(TicketPolicy.canReopen(agent1, recentClosedTicket)).toBe(false);
    });
  });

  describe("TicketPolicy.canArchive", () => {
    it("Supervisor can archive any ticket", () => {
      expect(TicketPolicy.canArchive(supervisorUser, unassignedTicket)).toBe(true);
      expect(TicketPolicy.canArchive(supervisorUser, assignedToAgent1)).toBe(true);
    });

    it("Primary Assignee Agent can archive their assigned ticket", () => {
      expect(TicketPolicy.canArchive(agent1, assignedToAgent1)).toBe(true);
    });

    it("Collaborator or unassigned Agent cannot archive ticket", () => {
      expect(TicketPolicy.canArchive(agent2, assignedToAgent1)).toBe(false);
      expect(TicketPolicy.canArchive(agent1, unassignedTicket)).toBe(false);
    });
  });

  describe("TicketPolicy.computePermissions", () => {
    it("Computes full granular permission matrix for Supervisor", () => {
      const resolvedTicket: TicketAccessContext = {
        id: "ticket-r",
        status: Status.RESOLVED,
        primaryAssigneeId: agent1.id,
      };
      const perms = TicketPolicy.computePermissions(supervisorUser, resolvedTicket);
      expect(perms.canView).toBe(true);
      expect(perms.canEdit).toBe(true);
      expect(perms.canReassign).toBe(true);
      expect(perms.canClose).toBe(true);
      expect(perms.canArchive).toBe(true);
      expect(perms.canReply).toBe(true);
      expect(perms.canAddInternalNote).toBe(true);
      expect(perms.canManageCollaborators).toBe(true);
      expect(perms.canAcknowledgeAlert).toBe(true);
    });

    it("Computes granular permission matrix for Primary Assignee Agent", () => {
      const openTicket: TicketAccessContext = {
        id: "ticket-o",
        status: Status.OPEN,
        primaryAssigneeId: agent1.id,
        collaborators: [{ userId: agent2.id }],
      };
      const perms = TicketPolicy.computePermissions(agent1, openTicket);
      expect(perms.canView).toBe(true);
      expect(perms.canEdit).toBe(true);
      expect(perms.canReassign).toBe(false);
      expect(perms.canClose).toBe(false);
      expect(perms.canReopen).toBe(false);
      expect(perms.canArchive).toBe(true);
      expect(perms.canReply).toBe(true);
      expect(perms.canAddInternalNote).toBe(true);
      expect(perms.canManageCollaborators).toBe(true);
      expect(perms.canAcknowledgeAlert).toBe(true);
    });

    it("Computes restricted permission matrix for Collaborator Agent", () => {
      const openTicket: TicketAccessContext = {
        id: "ticket-o",
        status: Status.OPEN,
        primaryAssigneeId: agent1.id,
        collaborators: [{ userId: agent2.id }],
      };
      const perms = TicketPolicy.computePermissions(agent2, openTicket);
      expect(perms.canView).toBe(true);
      expect(perms.canEdit).toBe(true);
      expect(perms.canReassign).toBe(false);
      expect(perms.canClose).toBe(false);
      expect(perms.canArchive).toBe(false);
      expect(perms.canReply).toBe(true);
      expect(perms.canAddInternalNote).toBe(true);
      expect(perms.canManageCollaborators).toBe(false);
      expect(perms.canAcknowledgeAlert).toBe(false);
    });
  });

  describe("CollaboratorPolicy", () => {
    it("Supervisor can manage collaborators on any ticket", () => {
      expect(CollaboratorPolicy.canManage(supervisorUser, unassignedTicket)).toBe(true);
    });

    it("Primary assignee can manage collaborators on their ticket", () => {
      expect(CollaboratorPolicy.canManage(agent1, assignedToAgent1)).toBe(true);
    });

    it("Collaborator agent cannot add or remove other collaborators", () => {
      expect(CollaboratorPolicy.canManage(agent2, assignedToAgent1)).toBe(false);
    });
  });

  describe("ReplyPolicy", () => {
    it("Supervisor and assigned agents can reply and add internal notes", () => {
      expect(ReplyPolicy.canReply(supervisorUser, assignedToAgent1)).toBe(true);
      expect(ReplyPolicy.canAddInternalNote(supervisorUser, assignedToAgent1)).toBe(true);
      expect(ReplyPolicy.canReply(agent1, assignedToAgent1)).toBe(true);
      expect(ReplyPolicy.canAddInternalNote(agent1, assignedToAgent1)).toBe(true);
      expect(ReplyPolicy.canReply(agent2, assignedToAgent1)).toBe(true);
      expect(ReplyPolicy.canAddInternalNote(agent2, assignedToAgent1)).toBe(true);
    });

    it("Unrelated agent cannot reply or add internal notes", () => {
      const unrelated: SessionUser = {
        id: "unrelated-user",
        email: "unrelated@test.com",
        name: "Unrelated",
        role: Role.AGENT,
      };
      expect(ReplyPolicy.canReply(unrelated, assignedToAgent1)).toBe(false);
      expect(ReplyPolicy.canAddInternalNote(unrelated, assignedToAgent1)).toBe(false);
    });
  });

  describe("AlertPolicy", () => {
    it("Supervisor can acknowledge alerts for any ticket", () => {
      expect(AlertPolicy.canAcknowledge(supervisorUser, unassignedTicket)).toBe(true);
      expect(AlertPolicy.canAcknowledge(supervisorUser, assignedToAgent1)).toBe(true);
    });

    it("Primary Assignee can acknowledge alert for their assigned ticket", () => {
      expect(AlertPolicy.canAcknowledge(agent1, assignedToAgent1)).toBe(true);
    });

    it("Collaborator or unrelated agent cannot acknowledge alert", () => {
      expect(AlertPolicy.canAcknowledge(agent2, assignedToAgent1)).toBe(false);
    });
  });
});
