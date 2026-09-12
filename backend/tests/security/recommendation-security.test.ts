import { describe, it, expect, beforeAll } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "@/db/prisma.db";
import { RecommendationController } from "@/controllers/recommendation.controller";
import { SessionUser } from "@/models/types.model";

describe("Security Tests: Semantic Recommendation & Access Control Isolation", () => {
  let supervisor: SessionUser;
  let agent: SessionUser;
  let customer: SessionUser;

  beforeAll(async () => {
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    const ag = await prisma.user.findFirst({ where: { role: Role.AGENT } });
    const cust = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });

    supervisor = { id: sup!.id, email: sup!.email, name: sup!.name, role: sup!.role };
    agent = { id: ag!.id, email: ag!.email, name: ag!.name, role: ag!.role };
    customer = { id: cust!.id, email: cust!.email, name: cust!.name, role: cust!.role };
  });

  it("Strictly forbids CUSTOMER role from accessing ticket recommendations", async () => {
    const anyTicket = await prisma.ticket.findFirst();
    if (!anyTicket) return;

    await expect(
      RecommendationController.getTicketRecommendations(anyTicket.id, customer)
    ).rejects.toThrow("Forbidden: Only Support Staff can access cross-ticket solution recommendations.");
  });

  it("Allows AGENT role to access ticket recommendations", async () => {
    const anyTicket = await prisma.ticket.findFirst();
    if (!anyTicket) return;

    const result = await RecommendationController.getTicketRecommendations(anyTicket.id, agent);
    expect(result).toBeDefined();
    expect(Array.isArray(result.highConfidence)).toBe(true);
    expect(Array.isArray(result.related)).toBe(true);
  });

  it("Allows SUPERVISOR role to access ticket recommendations", async () => {
    const anyTicket = await prisma.ticket.findFirst();
    if (!anyTicket) return;

    const result = await RecommendationController.getTicketRecommendations(anyTicket.id, supervisor);
    expect(result).toBeDefined();
    expect(Array.isArray(result.highConfidence)).toBe(true);
    expect(Array.isArray(result.related)).toBe(true);
  });

  it("Allows both Staff and Customer to search public Knowledge Base", async () => {
    const staffSearch = await RecommendationController.searchKnowledgeBase("OAuth login", agent);
    const customerSearch = await RecommendationController.searchKnowledgeBase("OAuth login", customer);

    expect(Array.isArray(staffSearch)).toBe(true);
    expect(Array.isArray(customerSearch)).toBe(true);
  });

  it("Forbids CUSTOMER from submitting recommendation telemetry feedback", async () => {
    await expect(
      RecommendationController.logFeedback(
        {
          targetTicketId: "ticket-123",
          sourceType: "TICKET",
          sourceId: "source-456",
          similarityScore: 0.92,
          actionTaken: "INSERTED",
        },
        customer
      )
    ).rejects.toThrow("Forbidden: Only Support Staff can submit recommendation feedback.");
  });
});
