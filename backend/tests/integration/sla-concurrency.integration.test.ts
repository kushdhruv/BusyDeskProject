import { describe, it, expect } from "vitest";
import { SlaController } from "@/controllers/sla.controller";
import { Role } from "@/models/types.model";
import { prisma } from "@/db/prisma.db";

describe("Integration: SLA Alert Concurrency & Duplicate Prevention", () => {
  const supervisorUser = {
    id: "usr_supervisor_1",
    email: "sarah.supervisor@busydesk.com",
    name: "Sarah Supervisor",
    role: Role.SUPERVISOR,
  };

  it("handles 10 simultaneous getActiveAlerts calls without deadlocks and prevents duplicate alerts", async () => {
    // 1. Fire 10 concurrent requests simultaneously
    const CONCURRENCY = 10;
    const promises = Array.from({ length: CONCURRENCY }, () =>
      SlaController.getActiveAlerts(supervisorUser)
    );

    const results = await Promise.all(promises);

    // 2. All calls must return valid alert arrays and counts
    expect(results).toHaveLength(CONCURRENCY);
    for (const res of results) {
      expect(Array.isArray(res.alerts)).toBe(true);
      expect(typeof res.count).toBe("number");
      expect(res.alerts.length).toBe(res.count);
    }

    // 3. Query the database to verify ZERO duplicate alerts for any (ticketId, breachCycle)
    const duplicates: any[] = await prisma.$queryRaw`
      SELECT "ticketId", "breachCycle", COUNT(*)::int AS count
      FROM sla_alerts
      GROUP BY "ticketId", "breachCycle"
      HAVING COUNT(*) > 1;
    `;

    expect(duplicates).toEqual([]);
  }, 60000);
});
