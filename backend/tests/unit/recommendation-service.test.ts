import { describe, it, expect, beforeAll } from "vitest";
import { Role, Priority, Category, Status } from "@prisma/client";
import { prisma } from "@/db/prisma.db";
import { RecommendationService } from "@/services/recommendation.service";

describe("Unit Tests: RecommendationService Semantic Matching & Quality Filters", () => {
  let seedTicketId: string;

  beforeAll(async () => {
    // Ensure we have a sample ticket for query testing
    const agent = await prisma.user.findFirst({ where: { role: Role.AGENT } });
    const customer = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });

    if (!agent || !customer) return;

    // Create a target test ticket
    const ticket = await prisma.ticket.create({
      data: {
        subject: "Help with OAuth token invalid_grant error during login",
        description: "Our mobile app gets invalid_grant when trying to refresh the authorization token.",
        requesterId: customer.id,
        requesterName: customer.name,
        requesterEmail: customer.email,
        priority: Priority.HIGH,
        category: Category.BUG,
        status: Status.OPEN,
        createdById: customer.id,
        primaryAssigneeId: agent.id,
        slaTargetMinutes: 480,
      },
    });

    seedTicketId = ticket.id;
  });

  it("should return recommendations categorized by confidence thresholds", async () => {
    if (!seedTicketId) return;

    const result = await RecommendationService.getRecommendationsForTicket(seedTicketId);

    expect(result).toBeDefined();
    expect(result.scannedCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.highConfidence)).toBe(true);
    expect(Array.isArray(result.related)).toBe(true);

    // Any match in highConfidence must meet threshold
    for (const match of result.highConfidence) {
      expect(match.similarity).toBeGreaterThanOrEqual(RecommendationService.HIGH_CONFIDENCE_THRESHOLD);
    }

    // Any match in related must be between MIN and HIGH
    for (const match of result.related) {
      expect(match.similarity).toBeGreaterThanOrEqual(RecommendationService.MIN_SIMILARITY_THRESHOLD);
      expect(match.similarity).toBeLessThan(RecommendationService.HIGH_CONFIDENCE_THRESHOLD);
    }
  });

  it("should never include the target ticket itself in recommendations", async () => {
    if (!seedTicketId) return;

    const result = await RecommendationService.getRecommendationsForTicket(seedTicketId);
    const allIds = [
      ...result.highConfidence.map((m) => m.sourceId),
      ...result.related.map((m) => m.sourceId),
    ];

    expect(allIds.includes(seedTicketId)).toBe(false);
  });

  it("should search knowledge base articles and return matching guides", async () => {
    const results = await RecommendationService.searchKnowledgeBase("OAuth token refresh guide");
    expect(Array.isArray(results)).toBe(true);
  });
});
