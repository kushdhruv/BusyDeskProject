import { describe, it, expect } from "vitest";
import { DashboardController as DashboardService } from "@/controllers/dashboard.controller";
import { DashboardMetrics } from "@/models/types.model";

describe("Integration Tests: Dashboard Aggregates & 8-Week Historical Resolution Trend", () => {
  it("Calculates 4 headline metrics, status distributions, and 8 continuous weekly buckets", async () => {
    const metrics = (await DashboardService.getMetrics()) as DashboardMetrics;

    // 1. Headline metrics
    expect(typeof metrics.openTicketsCount).toBe("number");
    expect(typeof metrics.pendingOnCustomerCount).toBe("number");
    expect(typeof metrics.resolvedThisWeekCount).toBe("number");
    expect(typeof metrics.breachingSlaCount).toBe("number");

    // 2. Status breakdown includes all 5 statuses
    expect(metrics.statusBreakdown.length).toBe(5);
    const statuses = metrics.statusBreakdown.map((s) => s.status);
    expect(statuses).toContain("NEW");
    expect(statuses).toContain("OPEN");
    expect(statuses).toContain("PENDING");
    expect(statuses).toContain("RESOLVED");
    expect(statuses).toContain("CLOSED");

    // 3. Agent workload breakdown
    expect(metrics.agentBreakdown.length).toBeGreaterThan(0);
    for (const agent of metrics.agentBreakdown) {
      expect(agent.agentId).toBeDefined();
      expect(agent.agentName).toBeDefined();
      expect(typeof agent.activeTicketsCount).toBe("number");
    }

    // 4. 8-week continuous weekly resolution trend
    expect(metrics.weeklyResolutionTrend.length).toBe(8);
    for (const week of metrics.weeklyResolutionTrend) {
      expect(week.weekLabel).toBeDefined();
      expect(week.weekStart).toBeDefined();
      expect(typeof week.resolvedCount).toBe("number");
    }
  });
});
