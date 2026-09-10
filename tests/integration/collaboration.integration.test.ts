import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { TicketService } from "../../lib/services/TicketService";
import { CollaborationService } from "../../lib/services/CollaborationService";
import { ReplyService } from "../../lib/services/ReplyService";
import { SessionUser } from "../../lib/types";

describe("Integration Tests: Collaborators, Shared Queues & Access Control", () => {
  let supervisor: SessionUser;
  let agent1: SessionUser;
  let agent2: SessionUser;
  let agent3: SessionUser;

  beforeAll(async () => {
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    const ag1 = await prisma.user.findFirst({ where: { email: "sarah@busy.com" } });
    const ag2 = await prisma.user.findFirst({ where: { email: "alex@busy.com" } });
    const ag3 = await prisma.user.findFirst({ where: { email: "jordan@busy.com" } });

    supervisor = { id: sup!.id, email: sup!.email, name: sup!.name, role: sup!.role };
    agent1 = { id: ag1!.id, email: ag1!.email, name: ag1!.name, role: ag1!.role };
    agent2 = { id: ag2!.id, email: ag2!.email, name: ag2!.name, role: ag2!.role };
    agent3 = { id: ag3!.id, email: ag3!.email, name: ag3!.name, role: ag3!.role };
  });

  it("Assignee can add collaborator; collaborator can view and post internal notes; unrelated agent is blocked", async () => {
    // 1. Agent 1 creates a ticket assigned to herself
    const ticket = await TicketService.createTicket(
      {
        subject: "Collaboration Integration Test",
        description: "Testing collaboration join/leave and note access",
        requesterName: "Collab Customer",
        requesterEmail: "collab@cust.com",
        primaryAssigneeId: agent1.id,
      },
      agent1
    );

    // 2. Unrelated Agent 2 cannot view ticket details initially
    await expect(TicketService.getTicketDetails(ticket.id, agent2)).rejects.toThrow(
      /permission to view/
    );

    // 3. Agent 1 adds Agent 2 as collaborator
    const collab = await CollaborationService.addCollaborator(ticket.id, agent2.id, agent1);
    expect(collab.userId).toBe(agent2.id);

    // 4. Adding duplicate collaborator is rejected
    await expect(
      CollaborationService.addCollaborator(ticket.id, agent2.id, agent1)
    ).rejects.toThrow(/already a collaborator/);

    // 5. Adding primary assignee as collaborator is rejected
    await expect(
      CollaborationService.addCollaborator(ticket.id, agent1.id, agent1)
    ).rejects.toThrow(/already the primary assignee/);

    // 6. Now Agent 2 (Collaborator) CAN view details and add internal note
    const details = await TicketService.getTicketDetails(ticket.id, agent2);
    expect(details.ticket.id).toBe(ticket.id);

    const note = await ReplyService.addAgentReply(
      ticket.id,
      { body: "Collaborator investigation note.", isInternal: true },
      agent2
    );
    expect(note.isInternal).toBe(true);

    // 7. Collaborator Agent 2 cannot add another collaborator (only primary assignee or supervisor can)
    await expect(
      CollaborationService.addCollaborator(ticket.id, agent3.id, agent2)
    ).rejects.toThrow(/Only the primary assignee or a Supervisor/);

    // 8. Agent 1 removes Agent 2
    const removeRes = await CollaborationService.removeCollaborator(ticket.id, agent2.id, agent1);
    expect(removeRes.success).toBe(true);

    // 9. Now Agent 2 is blocked from viewing again
    await expect(TicketService.getTicketDetails(ticket.id, agent2)).rejects.toThrow(
      /permission to view/
    );

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
