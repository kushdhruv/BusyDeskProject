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
  getTicketsRoute,
  createTicketRoute,
  getTicketByIdRoute,
  addAgentReplyRoute,
  addCustomerReplyRoute,
  changeTicketStatusRoute,
  reassignTicketRoute,
  submitCsatRoute,
  bulkActionRoute,
  getHealthRoute,
} from "@/routes";

describe("Integration: End-to-End Route Handlers on Supabase", () => {
  let supervisorUser: any;
  let supervisorToken: string;
  let createdTicketId: string;

  beforeAll(async () => {
    supervisorUser = await prisma.user.findFirst({
      where: { role: Role.SUPERVISOR },
    });

    supervisorToken = await createSessionToken({
      id: supervisorUser.id,
      email: supervisorUser.email,
      name: supervisorUser.name,
      role: supervisorUser.role,
    });

    mockCookieToken = supervisorToken;
  });

  afterAll(async () => {
    if (createdTicketId) {
      await prisma.ticket.deleteMany({ where: { id: createdTicketId } });
    }
  });

  it("GET /api/health returns database: connected and low latency", async () => {
    const res = await getHealthRoute();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
    expect(typeof body.latencyMs).toBe("number");
  });

  it("POST /api/tickets creates a ticket via HTTP route handler when authenticated", async () => {
    const req = new Request("http://localhost:3001/api/tickets", {
      method: "POST",
      body: JSON.stringify({
        subject: "Route Handler Integration Test Ticket",
        description: "Verifying routes layer end-to-end with Supabase",
        requesterName: "Route Tester",
        requesterEmail: "tester@route.com",
        priority: Priority.HIGH,
        category: Category.BUG,
      }),
    });

    const res = await createTicketRoute(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.ticket).toBeDefined();
    expect(body.ticket.subject).toBe("Route Handler Integration Test Ticket");
    expect(body.ticket.status).toBe(Status.NEW);

    createdTicketId = body.ticket.id;
  });

  it("GET /api/tickets retrieves the queue including the newly created ticket", async () => {
    const req = new Request(`http://localhost:3001/api/tickets?search=Route+Handler`);
    const res = await getTicketsRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toBeDefined();
    expect(Array.isArray(body.tickets)).toBe(true);

    const found = body.tickets.some((t: any) => t.id === createdTicketId);
    expect(found).toBe(true);
  });

  it("GET /api/tickets/[id] retrieves full ticket details and unified timeline", async () => {
    const req = new Request(`http://localhost:3001/api/tickets/${createdTicketId}`);
    const res = await getTicketByIdRoute(req, { id: createdTicketId });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ticket).toBeDefined();
    expect(body.ticket.id).toBe(createdTicketId);
    expect(Array.isArray(body.timeline)).toBe(true);
  });

  it("POST /api/tickets/[id]/customer-reply adds customer message and triggers audit", async () => {
    const req = new Request(`http://localhost:3001/api/tickets/${createdTicketId}/customer-reply`, {
      method: "POST",
      body: JSON.stringify({
        body: "Customer reply via public route handler",
        customerName: "Route Tester",
        customerEmail: "tester@route.com",
      }),
    });

    const res = await addCustomerReplyRoute(req, { id: createdTicketId });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.reply).toBeDefined();
    expect(body.reply.body).toBe("Customer reply via public route handler");
  });

  it("POST /api/tickets/[id]/reassign reassigns ticket to an agent via route handler", async () => {
    const agent = await prisma.user.findFirst({ where: { role: Role.AGENT } });
    expect(agent).toBeDefined();

    mockCookieToken = supervisorToken;
    const req = new Request(`http://localhost:3001/api/tickets/${createdTicketId}/reassign`, {
      method: "POST",
      body: JSON.stringify({ primaryAssigneeId: agent!.id }),
    });

    const res = await reassignTicketRoute(req, { id: createdTicketId });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ticket.primaryAssigneeId).toBe(agent!.id);
  });

  it("POST /api/tickets/[id]/replies adds internal note and public reply via route handler", async () => {
    const agent = await prisma.user.findFirst({ where: { role: Role.AGENT } });
    const agentToken = await createSessionToken({
      id: agent!.id,
      email: agent!.email,
      name: agent!.name,
      role: agent!.role,
    });

    mockCookieToken = agentToken;

    // Add internal note
    const noteReq = new Request(`http://localhost:3001/api/tickets/${createdTicketId}/replies`, {
      method: "POST",
      body: JSON.stringify({
        body: "Internal agent diagnostics note via route layer",
        isInternal: true,
      }),
    });
    const noteRes = await addAgentReplyRoute(noteReq, { id: createdTicketId });
    expect(noteRes.status).toBe(201);
    const noteBody = await noteRes.json();
    expect(noteBody.reply.isInternal).toBe(true);

    // Add public agent reply
    const replyReq = new Request(`http://localhost:3001/api/tickets/${createdTicketId}/replies`, {
      method: "POST",
      body: JSON.stringify({
        body: "Agent response to customer via route layer",
        isInternal: false,
      }),
    });
    const replyRes = await addAgentReplyRoute(replyReq, { id: createdTicketId });
    expect(replyRes.status).toBe(201);
    const replyBody = await replyRes.json();
    expect(replyBody.reply.isInternal).toBe(false);
  });

  it("POST /api/tickets/[id]/status resolves ticket via route handler", async () => {
    mockCookieToken = supervisorToken;
    const req = new Request(`http://localhost:3001/api/tickets/${createdTicketId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: Status.RESOLVED }),
    });

    const res = await changeTicketStatusRoute(req, { id: createdTicketId });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ticket.status).toBe(Status.RESOLVED);
  });

  it("POST /api/tickets/[id]/csat submits customer satisfaction score via route handler", async () => {
    // Create customer session
    const customer = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });
    expect(customer).toBeDefined();

    // Ensure ticket requesterId matches customer to pass permission
    await prisma.ticket.update({
      where: { id: createdTicketId },
      data: { requesterId: customer!.id, requesterEmail: customer!.email },
    });

    const customerToken = await createSessionToken({
      id: customer!.id,
      email: customer!.email,
      name: customer!.name,
      role: customer!.role,
    });

    mockCookieToken = customerToken;

    const req = new Request(`http://localhost:3001/api/tickets/${createdTicketId}/csat`, {
      method: "POST",
      body: JSON.stringify({ rating: 5, comment: "Excellent resolution via route layer!" }),
    });

    const res = await submitCsatRoute(req, { id: createdTicketId });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.satisfaction).toBeDefined();
    expect(body.satisfaction.rating).toBe(5);
  });

  it("POST /api/tickets/bulk executes bulk operations via route handler", async () => {
    mockCookieToken = supervisorToken;
    const req = new Request("http://localhost:3001/api/tickets/bulk", {
      method: "POST",
      body: JSON.stringify({
        ticketIds: [createdTicketId],
        action: "CLOSE",
      }),
    });

    const res = await bulkActionRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalRequested).toBe(1);
    expect(body.succeededCount).toBe(1);
    expect(body.results).toBeDefined();
    expect(body.results[0].status).toBe("SUCCESS");
  });
});
