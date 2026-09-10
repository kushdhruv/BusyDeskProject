import { describe, it, expect } from "vitest";
import { Role, Status } from "@prisma/client";
import { TicketPolicy, TicketAccessContext } from "../../lib/policies/TicketPolicy";
import { ReplyPolicy } from "../../lib/policies/ReplyPolicy";
import { CollaboratorPolicy } from "../../lib/policies/CollaboratorPolicy";
import { AlertPolicy } from "../../lib/policies/AlertPolicy";
import { SessionUser } from "../../lib/types";
import { REOPEN_WINDOW_MS } from "../../lib/constants";

describe("Unit Tests: 3-Role Policy & Permission Layer (SUPERVISOR, AGENT, CUSTOMER)", () => {
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

  const customerAlice: SessionUser = {
    id: "user-customer-alice",
    email: "alice@customer.com",
    name: "Alice Henderson",
    role: Role.CUSTOMER,
  };

  const customerBob: SessionUser = {
    id: "user-customer-bob",
    email: "bob@customer.com",
    name: "Bob Martinez",
    role: Role.CUSTOMER,
  };

  const unassignedTicket: TicketAccessContext = {
    id: "ticket-1",
    status: Status.OPEN,
    requesterId: customerAlice.id,
    primaryAssigneeId: null,
    collaborators: [],
  };

  const assignedToAgent1: TicketAccessContext = {
    id: "ticket-2",
    status: Status.OPEN,
    requesterId: customerAlice.id,
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

    it("Customer can view their own requested ticket", () => {
      expect(TicketPolicy.canView(customerAlice, assignedToAgent1)).toBe(true);
      expect(TicketPolicy.canView(customerAlice, unassignedTicket)).toBe(true);
    });

    it("Customer CANNOT view another customer's ticket", () => {
      expect(TicketPolicy.canView(customerBob, assignedToAgent1)).toBe(false);
      expect(TicketPolicy.canView(customerBob, unassignedTicket)).toBe(false);
    });

    it("Handles null or undefined collaborators gracefully", () => {
      const ticketWithoutCollabs: TicketAccessContext = {
        id: "ticket-3",
        status: Status.OPEN,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
        collaborators: undefined,
      };
      expect(TicketPolicy.canView(agent1, ticketWithoutCollabs)).toBe(true);
      expect(TicketPolicy.canView(agent2, ticketWithoutCollabs)).toBe(false);
      expect(TicketPolicy.canView(customerAlice, ticketWithoutCollabs)).toBe(true);
      expect(TicketPolicy.canView(customerBob, ticketWithoutCollabs)).toBe(false);
    });
  });

  describe("TicketPolicy.canEdit", () => {
    it("Supervisor can edit any ticket", () => {
      expect(TicketPolicy.canEdit(supervisorUser, assignedToAgent1)).toBe(true);
    });

    it("Assigned agent can edit their ticket", () => {
      expect(TicketPolicy.canEdit(agent1, assignedToAgent1)).toBe(true);
    });

    it("Customer CANNOT directly edit tickets", () => {
      expect(TicketPolicy.canEdit(customerAlice, assignedToAgent1)).toBe(false);
    });
  });

  describe("TicketPolicy.canReassign", () => {
    it("Supervisor is allowed to reassign tickets", () => {
      expect(TicketPolicy.canReassign(supervisorUser)).toBe(true);
    });

    it("Agent is strictly prohibited from reassigning tickets away or to others", () => {
      expect(TicketPolicy.canReassign(agent1)).toBe(false);
    });

    it("Customer is strictly prohibited from reassigning tickets", () => {
      expect(TicketPolicy.canReassign(customerAlice)).toBe(false);
    });
  });

  describe("TicketPolicy.canClose", () => {
    it("Supervisor can close a RESOLVED ticket", () => {
      const resolvedTicket: TicketAccessContext = {
        id: "ticket-r",
        status: Status.RESOLVED,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
      };
      expect(TicketPolicy.canClose(supervisorUser, resolvedTicket)).toBe(true);
    });

    it("Supervisor cannot close an OPEN or PENDING ticket (must be RESOLVED first)", () => {
      expect(TicketPolicy.canClose(supervisorUser, unassignedTicket)).toBe(false);
      const pendingTicket: TicketAccessContext = {
        id: "ticket-p",
        status: Status.PENDING,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
      };
      expect(TicketPolicy.canClose(supervisorUser, pendingTicket)).toBe(false);
    });

    it("Agent cannot close tickets even if RESOLVED or assigned to them", () => {
      const resolvedTicket: TicketAccessContext = {
        id: "ticket-r",
        status: Status.RESOLVED,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
      };
      expect(TicketPolicy.canClose(agent1, resolvedTicket)).toBe(false);
    });

    it("Customer cannot close tickets", () => {
      const resolvedTicket: TicketAccessContext = {
        id: "ticket-r",
        status: Status.RESOLVED,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
      };
      expect(TicketPolicy.canClose(customerAlice, resolvedTicket)).toBe(false);
    });
  });

  describe("TicketPolicy.canReopen", () => {
    it("Supervisor can reopen CLOSED ticket within 7-day window", () => {
      const recentClosedTicket: TicketAccessContext = {
        id: "ticket-c1",
        status: Status.CLOSED,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
        closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };
      expect(TicketPolicy.canReopen(supervisorUser, recentClosedTicket)).toBe(true);
    });

    it("Supervisor cannot reopen CLOSED ticket past the 7-day window", () => {
      const expiredClosedTicket: TicketAccessContext = {
        id: "ticket-c2",
        status: Status.CLOSED,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
        closedAt: new Date(Date.now() - (REOPEN_WINDOW_MS + 10000)), // 7 days + 10s
      };
      expect(TicketPolicy.canReopen(supervisorUser, expiredClosedTicket)).toBe(false);
    });

    it("Supervisor cannot reopen ticket if closedAt is null or missing", () => {
      const corruptClosedTicket: TicketAccessContext = {
        id: "ticket-c3",
        status: Status.CLOSED,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
        closedAt: null,
      };
      expect(TicketPolicy.canReopen(supervisorUser, corruptClosedTicket)).toBe(false);
    });

    it("Customer and Agent cannot reopen tickets", () => {
      const recentClosedTicket: TicketAccessContext = {
        id: "ticket-c1",
        status: Status.CLOSED,
        requesterId: customerAlice.id,
        primaryAssigneeId: agent1.id,
        closedAt: new Date(Date.now() - 1000),
      };
      expect(TicketPolicy.canReopen(agent1, recentClosedTicket)).toBe(false);
      expect(TicketPolicy.canReopen(customerAlice, recentClosedTicket)).toBe(false);
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

    it("Customer cannot archive tickets", () => {
      expect(TicketPolicy.canArchive(customerAlice, assignedToAgent1)).toBe(false);
    });
  });

  describe("TicketPolicy.canRateCsat", () => {
    const resolvedTicket: TicketAccessContext = {
      id: "ticket-r",
      status: Status.RESOLVED,
      requesterId: customerAlice.id,
      primaryAssigneeId: agent1.id,
      satisfaction: null,
    };

    const closedTicket: TicketAccessContext = {
      id: "ticket-c",
      status: Status.CLOSED,
      requesterId: customerAlice.id,
      primaryAssigneeId: agent1.id,
      satisfaction: null,
    };

    const ratedTicket: TicketAccessContext = {
      id: "ticket-rated",
      status: Status.RESOLVED,
      requesterId: customerAlice.id,
      primaryAssigneeId: agent1.id,
      satisfaction: { rating: 5 },
    };

    it("Customer can rate CSAT on their own RESOLVED or CLOSED unrated ticket", () => {
      expect(TicketPolicy.canRateCsat(customerAlice, resolvedTicket)).toBe(true);
      expect(TicketPolicy.canRateCsat(customerAlice, closedTicket)).toBe(true);
    });

    it("Customer CANNOT rate CSAT on OPEN or PENDING tickets", () => {
      expect(TicketPolicy.canRateCsat(customerAlice, assignedToAgent1)).toBe(false);
    });

    it("Customer CANNOT rate CSAT on tickets that already have a rating (immutable)", () => {
      expect(TicketPolicy.canRateCsat(customerAlice, ratedTicket)).toBe(false);
    });

    it("Customer CANNOT rate CSAT on another customer's ticket", () => {
      expect(TicketPolicy.canRateCsat(customerBob, resolvedTicket)).toBe(false);
    });

    it("Supervisor and Agent CANNOT rate CSAT", () => {
      expect(TicketPolicy.canRateCsat(supervisorUser, resolvedTicket)).toBe(false);
      expect(TicketPolicy.canRateCsat(agent1, resolvedTicket)).toBe(false);
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

    it("Customer can reply to their own ticket", () => {
      expect(ReplyPolicy.canReply(customerAlice, assignedToAgent1)).toBe(true);
    });

    it("Customer CANNOT add internal notes", () => {
      expect(ReplyPolicy.canAddInternalNote(customerAlice, assignedToAgent1)).toBe(false);
    });

    it("Customer CANNOT reply to another customer's ticket", () => {
      expect(ReplyPolicy.canReply(customerBob, assignedToAgent1)).toBe(false);
    });
  });

  describe("CollaboratorPolicy", () => {
    it("Supervisor can manage collaborators on any ticket", () => {
      expect(CollaboratorPolicy.canManage(supervisorUser, unassignedTicket)).toBe(true);
    });

    it("Primary assignee can manage collaborators on their ticket", () => {
      expect(CollaboratorPolicy.canManage(agent1, assignedToAgent1)).toBe(true);
    });

    it("Customer CANNOT manage collaborators", () => {
      expect(CollaboratorPolicy.canManage(customerAlice, assignedToAgent1)).toBe(false);
    });
  });

  describe("AlertPolicy", () => {
    it("Supervisor can acknowledge alerts for any ticket", () => {
      expect(AlertPolicy.canAcknowledge(supervisorUser, unassignedTicket)).toBe(true);
    });

    it("Primary Assignee can acknowledge alert for their assigned ticket", () => {
      expect(AlertPolicy.canAcknowledge(agent1, assignedToAgent1)).toBe(true);
    });

    it("Customer CANNOT acknowledge alerts", () => {
      expect(AlertPolicy.canAcknowledge(customerAlice, assignedToAgent1)).toBe(false);
    });
  });
});
