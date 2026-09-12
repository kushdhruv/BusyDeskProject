import { describe, it, expect } from "vitest";
import {
  loginRoute,
  registerRoute,
  getTicketsRoute,
  createTicketRoute,
  getTicketByIdRoute,
  updateTicketRoute,
  changeTicketStatusRoute,
  reassignTicketRoute,
  archiveTicketRoute,
  restoreTicketRoute,
  addAgentReplyRoute,
  addCustomerReplyRoute,
  addCollaboratorRoute,
  removeCollaboratorRoute,
  getSlaAlertsRoute,
  acknowledgeAlertRoute,
  submitCsatRoute,
  bulkActionRoute,
  exportTicketsRoute,
  getDashboardRoute,
  getUsersRoute,
  getTicketRecommendationsRoute,
  searchKnowledgeBaseRoute,
  logRecommendationFeedbackRoute,
} from "@/routes";

describe("API Route Layer Validation & Error Responses", () => {
  describe("Authentication Routes", () => {
    it("loginRoute returns 400 when email or password is missing", async () => {
      const req = new Request("http://localhost:3001/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "" }),
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Email and password are required");
    });

    it("registerRoute returns 400 when registration fails validation", async () => {
      const req = new Request("http://localhost:3001/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: "", password: "" }),
      });
      const res = await registerRoute(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Ticket Routes Authorization Guards", () => {
    it("getTicketsRoute returns 401 when no session cookie is provided", async () => {
      const req = new Request("http://localhost:3001/api/tickets");
      const res = await getTicketsRoute(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("createTicketRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: "Test" }),
      });
      const res = await createTicketRoute(req);
      expect(res.status).toBe(401);
    });

    it("getTicketByIdRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/ticket_123");
      const res = await getTicketByIdRoute(req, { id: "ticket_123" });
      expect(res.status).toBe(401);
    });

    it("updateTicketRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/ticket_123", {
        method: "PATCH",
        body: JSON.stringify({ subject: "Updated" }),
      });
      const res = await updateTicketRoute(req, { id: "ticket_123" });
      expect(res.status).toBe(401);
    });

    it("changeTicketStatusRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/ticket_123/status", {
        method: "POST",
        body: JSON.stringify({ status: "OPEN" }),
      });
      const res = await changeTicketStatusRoute(req, { id: "ticket_123" });
      expect(res.status).toBe(401);
    });

    it("reassignTicketRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/ticket_123/reassign", {
        method: "POST",
        body: JSON.stringify({ primaryAssigneeId: "usr_1" }),
      });
      const res = await reassignTicketRoute(req, { id: "ticket_123" });
      expect(res.status).toBe(401);
    });

    it("archiveTicketRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/ticket_123/archive", {
        method: "POST",
      });
      const res = await archiveTicketRoute(req, { id: "ticket_123" });
      expect(res.status).toBe(401);
    });

    it("restoreTicketRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/ticket_123/restore", {
        method: "POST",
      });
      const res = await restoreTicketRoute(req, { id: "ticket_123" });
      expect(res.status).toBe(401);
    });
  });

  describe("Reply Routes Validation", () => {
    it("addAgentReplyRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/t1/replies", {
        method: "POST",
        body: JSON.stringify({ body: "Hello" }),
      });
      const res = await addAgentReplyRoute(req, { id: "t1" });
      expect(res.status).toBe(401);
    });

    it("addCustomerReplyRoute returns 400 when body is empty", async () => {
      const req = new Request("http://localhost:3001/api/tickets/t1/customer-reply", {
        method: "POST",
        body: JSON.stringify({ body: "   " }),
      });
      const res = await addCustomerReplyRoute(req, { id: "t1" });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("empty");
    });
  });

  describe("Collaboration, SLA & CSAT Routes", () => {
    it("addCollaboratorRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/t1/collaborators", {
        method: "POST",
        body: JSON.stringify({ userId: "usr_2" }),
      });
      const res = await addCollaboratorRoute(req, { id: "t1" });
      expect(res.status).toBe(401);
    });

    it("removeCollaboratorRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/t1/collaborators?userId=usr_2", {
        method: "DELETE",
      });
      const res = await removeCollaboratorRoute(req, { id: "t1" });
      expect(res.status).toBe(401);
    });

    it("getSlaAlertsRoute returns 401 when unauthenticated", async () => {
      const res = await getSlaAlertsRoute();
      expect(res.status).toBe(401);
    });

    it("acknowledgeAlertRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/t1/acknowledge-alert", {
        method: "POST",
        body: JSON.stringify({ alertId: "alt_1" }),
      });
      const res = await acknowledgeAlertRoute(req, { id: "t1" });
      expect(res.status).toBe(401);
    });

    it("submitCsatRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/t1/csat", {
        method: "POST",
        body: JSON.stringify({ rating: 5 }),
      });
      const res = await submitCsatRoute(req, { id: "t1" });
      expect(res.status).toBe(401);
    });
  });

  describe("Bulk, Export, Dashboard & Users Routes", () => {
    it("bulkActionRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/bulk", {
        method: "POST",
        body: JSON.stringify({ ticketIds: ["t1"], action: "CLOSE" }),
      });
      const res = await bulkActionRoute(req);
      expect(res.status).toBe(401);
    });

    it("exportTicketsRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/export");
      const res = await exportTicketsRoute(req);
      expect(res.status).toBe(401);
    });

    it("getDashboardRoute returns 401 when unauthenticated", async () => {
      const res = await getDashboardRoute();
      expect(res.status).toBe(401);
    });

    it("getUsersRoute returns 401 when unauthenticated", async () => {
      const res = await getUsersRoute();
      expect(res.status).toBe(401);
    });
  });

  describe("AI & Knowledge Recommendation Routes (Smart Assist)", () => {
    it("getTicketRecommendationsRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/tickets/t1/recommendations");
      const res = await getTicketRecommendationsRoute(req, { id: "t1" });
      expect(res.status).toBe(401);
    });

    it("searchKnowledgeBaseRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/kb/search?q=oauth");
      const res = await searchKnowledgeBaseRoute(req);
      expect(res.status).toBe(401);
    });

    it("logRecommendationFeedbackRoute returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3001/api/recommendations/feedback", {
        method: "POST",
        body: JSON.stringify({
          targetTicketId: "t1",
          sourceType: "TICKET",
          sourceId: "s1",
          similarityScore: 0.9,
          actionTaken: "INSERTED",
        }),
      });
      const res = await logRecommendationFeedbackRoute(req);
      expect(res.status).toBe(401);
    });
  });
});
