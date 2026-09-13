/**
 * Customer Reviews & Agent CSAT Analytics Unit Tests
 * Verifies review retrieval, filtering, and agent ranking by highest/lowest ratings.
 */

import { describe, it, expect } from "vitest";
import { ReviewsController } from "../../controllers/reviews.controller";

describe("ReviewsController & Agent Performance Analytics", () => {
  it("should fetch all customer reviews and global summary metrics", async () => {
    const data = await ReviewsController.getAllReviews({ limit: 10 });
    expect(data).toHaveProperty("reviews");
    expect(data).toHaveProperty("totalCount");
    expect(data).toHaveProperty("summary");
    expect(typeof data.summary.averageRating).toBe("number");
    expect(typeof data.summary.satisfactionRate).toBe("number");
    expect(data.summary.distribution).toHaveProperty("5");
    expect(data.summary.distribution).toHaveProperty("1");
  });

  it("should filter reviews by star rating", async () => {
    const data = await ReviewsController.getAllReviews({ rating: 5, limit: 5 });
    for (const rev of data.reviews) {
      expect(rev.rating).toBe(5);
    }
  });

  it("should aggregate agent performance scorecards and sort by rating_desc", async () => {
    const agents = await ReviewsController.getAgentPerformanceSummary("rating_desc");
    expect(Array.isArray(agents)).toBe(true);

    if (agents.length >= 2) {
      // Top performer should have rating >= subsequent agents
      for (let i = 0; i < agents.length - 1; i++) {
        expect(agents[i].averageRating).toBeGreaterThanOrEqual(agents[i + 1].averageRating);
      }
    }

    if (agents.length > 0) {
      const first = agents[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("averageRating");
      expect(first).toHaveProperty("satisfactionRate");
      expect(first).toHaveProperty("totalResolvedTickets");
      expect(first).toHaveProperty("distribution");
    }
  });

  it("should sort agent performance scorecards by rating_asc (lowest first)", async () => {
    const agents = await ReviewsController.getAgentPerformanceSummary("rating_asc");
    expect(Array.isArray(agents)).toBe(true);

    // Agents with reviews should have lower ratings at the beginning
    const reviewedAgents = agents.filter((a) => a.totalReviews > 0);
    if (reviewedAgents.length >= 2) {
      for (let i = 0; i < reviewedAgents.length - 1; i++) {
        expect(reviewedAgents[i].averageRating).toBeLessThanOrEqual(reviewedAgents[i + 1].averageRating);
      }
    }
  });
});
