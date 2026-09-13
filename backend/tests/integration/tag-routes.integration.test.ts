import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

let mockCookieToken: string | undefined = undefined;

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "busy_ticketing_session" && mockCookieToken
        ? { value: mockCookieToken }
        : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { prisma } from "@/db/prisma.db";
import { Role, Priority, Category, Status } from "@prisma/client";
import { createSessionToken } from "@/middlewares/auth.middleware";
import {
  listTagGroupsRoute,
  createTagGroupRoute,
  listTagsRoute,
  createTagRoute,
  searchTagsRoute,
  addTicketTagsRoute,
  getTicketTagsRoute,
  removeTicketTagRoute,
  mergeTagsRoute,
} from "@/routes";

describe("Integration: Tag & Tag Group End-to-End Route Handlers", () => {
  let supervisorUser: any;
  let supervisorToken: string;
  let agentUser: any;
  let agentToken: string;
  let customerUser: any;
  let customerToken: string;

  let testGroupId: string;
  let testTagId: string;
  let targetMergeTagId: string;
  let testTicketId: string;

  beforeAll(async () => {
    supervisorUser = await prisma.user.findFirst({
      where: { role: Role.SUPERVISOR },
    });

    agentUser = await prisma.user.findFirst({
      where: { role: Role.AGENT },
    });

    customerUser = await prisma.user.findFirst({
      where: { role: Role.CUSTOMER },
    });

    supervisorToken = await createSessionToken({
      id: supervisorUser.id,
      email: supervisorUser.email,
      name: supervisorUser.name,
      role: supervisorUser.role,
    });

    agentToken = await createSessionToken({
      id: agentUser.id,
      email: agentUser.email,
      name: agentUser.name,
      role: agentUser.role,
    });

    customerToken = await createSessionToken({
      id: customerUser.id,
      email: customerUser.email,
      name: customerUser.name,
      role: customerUser.role,
    });

    // Create a temporary test ticket
    const ticket = await prisma.ticket.create({
      data: {
        subject: "Integration Tag Test Ticket",
        description: "Testing tag attachment and queries",
        requesterId: customerUser.id,
        requesterName: customerUser.name,
        requesterEmail: customerUser.email,
        priority: Priority.MEDIUM,
        category: Category.BUG,
        status: Status.OPEN,
        createdById: supervisorUser.id,
        primaryAssigneeId: agentUser.id,
        slaTargetMinutes: 1440,
      },
    });
    testTicketId = ticket.id;
  });

  afterAll(async () => {
    if (testTicketId) {
      await prisma.ticket.deleteMany({ where: { id: testTicketId } });
    }
    if (testTagId) {
      await prisma.tag.deleteMany({ where: { id: testTagId } });
    }
    if (targetMergeTagId) {
      await prisma.tag.deleteMany({ where: { id: targetMergeTagId } });
    }
    if (testGroupId) {
      await prisma.tagGroup.deleteMany({ where: { id: testGroupId } });
    }
  });

  it("Supervisor can create a new Tag Group", async () => {
    mockCookieToken = supervisorToken;
    const req = new Request("http://localhost/api/tag-groups", {
      method: "POST",
      body: JSON.stringify({
        name: `Test Group ${Date.now()}`,
        description: "Integration test group",
        color: "#EC4899",
        isExclusive: false,
      }),
    });

    const res = await createTagGroupRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.group.name).toContain("Test Group");
    testGroupId = data.group.id;
  });

  it("Agent CANNOT create a Tag Group (forbidden)", async () => {
    mockCookieToken = agentToken;
    const req = new Request("http://localhost/api/tag-groups", {
      method: "POST",
      body: JSON.stringify({
        name: "Unauthorized Agent Group",
      }),
    });

    const res = await createTagGroupRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Supervisors");
  });

  it("Supervisor can create tags in a group", async () => {
    mockCookieToken = supervisorToken;
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      body: JSON.stringify({
        name: `Source Tag ${Date.now()}`,
        color: "#EC4899",
        groupId: testGroupId,
      }),
    });

    const res = await createTagRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tag.groupId).toBe(testGroupId);
    testTagId = data.tag.id;
  });

  it("Supervisor can create a second tag for merge target", async () => {
    mockCookieToken = supervisorToken;
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      body: JSON.stringify({
        name: `Target Tag ${Date.now()}`,
        color: "#10B981",
        groupId: testGroupId,
      }),
    });

    const res = await createTagRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    targetMergeTagId = data.tag.id;
  });

  it("Agent can create an UNGROUPED tag", async () => {
    mockCookieToken = agentToken;
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      body: JSON.stringify({
        name: `Agent Adhoc ${Date.now()}`,
      }),
    });

    const res = await createTagRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tag.groupId).toBeNull();
    // Clean up
    await prisma.tag.deleteMany({ where: { id: data.tag.id } });
  });

  it("Agent CANNOT create a tag assigned to a group", async () => {
    mockCookieToken = agentToken;
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      body: JSON.stringify({
        name: "Forbidden Grouped Tag",
        groupId: testGroupId,
      }),
    });

    const res = await createTagRoute(req);
    expect(res.status).toBe(400);
  });

  it("Agent can apply a tag to their assigned ticket", async () => {
    mockCookieToken = agentToken;
    const req = new Request(`http://localhost/api/tickets/${testTicketId}/tags`, {
      method: "POST",
      body: JSON.stringify({
        tagIds: [testTagId],
      }),
    });

    const res = await addTicketTagsRoute(req, { params: { id: testTicketId } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags.some((t: any) => t.tagId === testTagId)).toBe(true);

    // Verify tag usageCount incremented
    const updatedTag = await prisma.tag.findUnique({ where: { id: testTagId } });
    expect(updatedTag?.usageCount).toBe(1);
  });

  it("Customer CANNOT apply tags to ticket", async () => {
    mockCookieToken = customerToken;
    const req = new Request(`http://localhost/api/tickets/${testTicketId}/tags`, {
      method: "POST",
      body: JSON.stringify({
        tagIds: [testTagId],
      }),
    });

    const res = await addTicketTagsRoute(req, { params: { id: testTicketId } });
    expect(res.status).toBe(400);
  });

  it("Supervisor can merge source tag into target tag", async () => {
    mockCookieToken = supervisorToken;
    const req = new Request(`http://localhost/api/tags/${testTagId}/merge`, {
      method: "POST",
      body: JSON.stringify({
        targetTagId: targetMergeTagId,
      }),
    });

    const res = await mergeTagsRoute(req, { params: { id: testTagId } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.ticketsMigrated).toBe(1);

    // Check that source tag is deleted and ticket now has target tag
    const sourceExists = await prisma.tag.findUnique({ where: { id: testTagId } });
    expect(sourceExists).toBeNull();

    const ticketTags = await prisma.ticketTag.findMany({ where: { ticketId: testTicketId } });
    expect(ticketTags.some((tt) => tt.tagId === targetMergeTagId)).toBe(true);
  });

  it("Agent can remove tag from ticket", async () => {
    mockCookieToken = agentToken;
    const req = new Request(
      `http://localhost/api/tickets/${testTicketId}/tags/${targetMergeTagId}`,
      { method: "DELETE" }
    );

    const res = await removeTicketTagRoute(req, {
      params: { id: testTicketId, tagId: targetMergeTagId },
    });
    expect(res.status).toBe(200);

    const ticketTags = await prisma.ticketTag.findMany({ where: { ticketId: testTicketId } });
    expect(ticketTags.some((tt) => tt.tagId === targetMergeTagId)).toBe(false);
  });
});
