import { describe, it, expect, beforeEach } from "vitest";
import { Role, UserStatus, Priority, Category, Status } from "@prisma/client";
import { prisma } from "../../db/prisma.db";
import { AgentController } from "../../controllers/agent.controller";
import { SessionUser } from "../../models/types.model";

describe("Agent Administration: Role Management, Suspension & Invitation Revocation", () => {
  let supervisor: SessionUser;
  let testAgent: any;
  let secondaryAgent: any;

  beforeEach(async () => {
    // Find or ensure supervisor
    const sup = await prisma.user.findFirst({
      where: { role: Role.SUPERVISOR, status: UserStatus.ACTIVE },
    });
    if (!sup) throw new Error("Supervisor fixture not found");
    supervisor = {
      id: sup.id,
      email: sup.email,
      name: sup.name,
      role: sup.role,
    };

    // Find test agent
    testAgent = await prisma.user.findFirst({
      where: { email: "jordan@busy.com" },
    });

    secondaryAgent = await prisma.user.findFirst({
      where: { email: "alex@busy.com" },
    });
  });

  it("allows Supervisor to promote an Agent to SUPERVISOR", async () => {
    if (!testAgent) return;

    const result = await AgentController.updateAgent(supervisor, testAgent.id, {
      role: Role.SUPERVISOR,
    });

    expect(result.success).toBe(true);
    expect(result.user.role).toBe(Role.SUPERVISOR);

    // Revert back
    await AgentController.updateAgent(supervisor, testAgent.id, {
      role: Role.AGENT,
    });
  });

  it("blocks non-supervisors from updating agent roles or statuses", async () => {
    if (!secondaryAgent) return;

    const agentSession: SessionUser = {
      id: secondaryAgent.id,
      email: secondaryAgent.email,
      name: secondaryAgent.name,
      role: Role.AGENT,
    };

    await expect(
      AgentController.updateAgent(agentSession, testAgent.id, {
        role: Role.SUPERVISOR,
      })
    ).rejects.toThrow("Forbidden");
  });

  it("prevents supervisor from suspending their own account", async () => {
    await expect(
      AgentController.updateAgent(supervisor, supervisor.id, {
        status: UserStatus.SUSPENDED,
      })
    ).rejects.toThrow("You cannot suspend your own supervisor account");
  });

  it("suspends an agent and atomically reassigns their active tickets", async () => {
    if (!testAgent || !secondaryAgent) return;

    // Create a dummy ticket assigned to testAgent
    const customer = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });
    if (!customer) return;

    const ticket = await prisma.ticket.create({
      data: {
        subject: "Ticket for suspension reassignment test",
        description: "Test issue",
        requesterId: customer.id,
        requesterName: customer.name,
        requesterEmail: customer.email,
        priority: Priority.LOW,
        category: Category.OTHER,
        status: Status.OPEN,
        createdById: supervisor.id,
        primaryAssigneeId: testAgent.id,
        slaTargetMinutes: 1440,
        slaCycle: 1,
      },
    });

    try {
      const result = await AgentController.updateAgent(supervisor, testAgent.id, {
        status: UserStatus.SUSPENDED,
        reassignTicketsToId: secondaryAgent.id,
      });

      expect(result.success).toBe(true);
      expect(result.user.status).toBe(UserStatus.SUSPENDED);
      expect(result.reassignedTicketsCount).toBeGreaterThanOrEqual(1);

      // Verify ticket is now assigned to secondaryAgent
      const updatedTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket?.primaryAssigneeId).toBe(secondaryAgent.id);

      // Verify audit log was written
      const audit = await prisma.auditLog.findFirst({
        where: { ticketId: ticket.id, eventType: "REASSIGNED" as any },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe(supervisor.id);
    } finally {
      // Reactivate testAgent and clean up ticket
      await AgentController.updateAgent(supervisor, testAgent.id, {
        status: UserStatus.ACTIVE,
      });
      await prisma.auditLog.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    }
  });

  it("allows cancelling a pending agent invitation", async () => {
    // Create a pending invite
    const inviteResult = await AgentController.inviteAgent(supervisor, {
      name: "Temporary Pending Agent",
      email: `temp-test-${Date.now()}@busy.com`,
    });

    const pendingAgentId = inviteResult.user.id;

    // Cancel invitation
    const cancelResult = await AgentController.cancelInvitation(supervisor, pendingAgentId);
    expect(cancelResult.success).toBe(true);

    // Verify user is deleted
    const deletedUser = await prisma.user.findUnique({
      where: { id: pendingAgentId },
    });
    expect(deletedUser).toBeNull();
  });
});
