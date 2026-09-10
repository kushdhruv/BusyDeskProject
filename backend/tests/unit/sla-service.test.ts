import { describe, it, expect } from "vitest";
import { Priority, Status } from "@prisma/client";
import { SlaController as SlaService } from "@/controllers/sla.controller";
import { SLA_TARGETS_MINUTES } from "@/utils/constants.util";

describe("Unit Tests: SlaService Calculations and State Transitions", () => {
  describe("SlaService.getTargetMinutes", () => {
    it("Returns correct SLA targets per priority", () => {
      expect(SlaService.getTargetMinutes(Priority.URGENT)).toBe(SLA_TARGETS_MINUTES.URGENT); // 120 (2h)
      expect(SlaService.getTargetMinutes(Priority.HIGH)).toBe(SLA_TARGETS_MINUTES.HIGH); // 480 (8h)
      expect(SlaService.getTargetMinutes(Priority.MEDIUM)).toBe(SLA_TARGETS_MINUTES.MEDIUM); // 1440 (24h)
      expect(SlaService.getTargetMinutes(Priority.LOW)).toBe(SLA_TARGETS_MINUTES.LOW); // 4320 (72h)
    });

    it("Falls back to MEDIUM target if priority is invalid or undefined", () => {
      expect(SlaService.getTargetMinutes("UNKNOWN" as any)).toBe(SLA_TARGETS_MINUTES.MEDIUM);
    });
  });

  describe("SlaService.computeStateOnStatusChange", () => {
    const fixedNow = new Date("2026-09-10T12:00:00.000Z");

    it("Pauses SLA when transitioning from OPEN to PENDING with positive remaining seconds", () => {
      const ticket = {
        priority: Priority.HIGH,
        status: Status.OPEN,
        slaTargetMinutes: 480,
        slaDueAt: new Date("2026-09-10T15:00:00.000Z"), // 3 hours remaining (10800s)
        slaPausedAt: null,
        slaPausedRemainingSeconds: null,
        slaCycle: 1,
      };

      const result = SlaService.computeStateOnStatusChange(ticket, Status.PENDING, fixedNow);

      expect(result.status).toBe(Status.PENDING);
      expect(result.slaDueAt).toBeNull();
      expect(result.slaPausedAt).toEqual(fixedNow);
      expect(result.slaPausedRemainingSeconds).toBe(3 * 3600);
    });

    it("Clamps remaining seconds to 0 if ticket was already breached when moving to PENDING", () => {
      const ticket = {
        priority: Priority.HIGH,
        status: Status.OPEN,
        slaTargetMinutes: 480,
        slaDueAt: new Date("2026-09-10T10:00:00.000Z"), // Breached 2 hours ago
        slaPausedAt: null,
        slaPausedRemainingSeconds: null,
        slaCycle: 1,
      };

      const result = SlaService.computeStateOnStatusChange(ticket, Status.PENDING, fixedNow);

      expect(result.slaPausedRemainingSeconds).toBe(0);
      expect(result.slaDueAt).toBeNull();
      expect(result.slaPausedAt).toEqual(fixedNow);
    });

    it("Resumes SLA from PENDING to OPEN accurately using stored paused seconds", () => {
      const resumeNow = new Date("2026-09-12T09:00:00.000Z");
      const ticket = {
        priority: Priority.HIGH,
        status: Status.PENDING,
        slaTargetMinutes: 480,
        slaDueAt: null,
        slaPausedAt: new Date("2026-09-10T12:00:00.000Z"),
        slaPausedRemainingSeconds: 7200, // 2 hours remaining
        slaCycle: 1,
      };

      const result = SlaService.computeStateOnStatusChange(ticket, Status.OPEN, resumeNow);

      expect(result.status).toBe(Status.OPEN);
      expect(result.slaPausedAt).toBeNull();
      expect(result.slaPausedRemainingSeconds).toBeNull();
      // slaDueAt should be resumeNow + 7200s
      const expectedDueAt = new Date(resumeNow.getTime() + 7200 * 1000);
      expect(result.slaDueAt?.toISOString()).toBe(expectedDueAt.toISOString());
    });

    it("Resumes SLA with fallback full duration if slaPausedRemainingSeconds is null", () => {
      const resumeNow = new Date("2026-09-12T09:00:00.000Z");
      const ticket = {
        priority: Priority.MEDIUM,
        status: Status.PENDING,
        slaTargetMinutes: 1440,
        slaDueAt: null,
        slaPausedAt: null,
        slaPausedRemainingSeconds: null,
        slaCycle: 1,
      };

      const result = SlaService.computeStateOnStatusChange(ticket, Status.OPEN, resumeNow);

      expect(result.status).toBe(Status.OPEN);
      const expectedDueAt = new Date(resumeNow.getTime() + 1440 * 60 * 1000);
      expect(result.slaDueAt?.toISOString()).toBe(expectedDueAt.toISOString());
    });

    it("Increments slaCycle and resets SLA when reopening a RESOLVED ticket", () => {
      const reopenNow = new Date("2026-09-15T10:00:00.000Z");
      const ticket = {
        priority: Priority.URGENT,
        status: Status.RESOLVED,
        slaTargetMinutes: 240, // 4 hours
        slaDueAt: new Date("2026-09-10T14:00:00.000Z"),
        slaPausedAt: null,
        slaPausedRemainingSeconds: null,
        slaCycle: 1,
      };

      const result = SlaService.computeStateOnStatusChange(ticket, Status.OPEN, reopenNow);

      expect(result.status).toBe(Status.OPEN);
      expect(result.slaCycle).toBe(2);
      expect(result.resolvedAt).toBeNull();
      expect(result.closedAt).toBeNull();
      expect(result.slaPausedAt).toBeNull();
      expect(result.slaPausedRemainingSeconds).toBeNull();
      // Fresh 4-hour deadline
      const expectedDue = new Date(reopenNow.getTime() + 240 * 60 * 1000);
      expect(result.slaDueAt?.toISOString()).toBe(expectedDue.toISOString());
    });

    it("Increments slaCycle and resets SLA when reopening a CLOSED ticket", () => {
      const reopenNow = new Date("2026-09-15T10:00:00.000Z");
      const ticket = {
        priority: Priority.LOW,
        status: Status.CLOSED,
        slaTargetMinutes: 2880, // 48 hours
        slaDueAt: null,
        slaPausedAt: null,
        slaPausedRemainingSeconds: null,
        slaCycle: 2,
      };

      const result = SlaService.computeStateOnStatusChange(ticket, Status.OPEN, reopenNow);

      expect(result.status).toBe(Status.OPEN);
      expect(result.slaCycle).toBe(3);
      expect(result.resolvedAt).toBeNull();
      expect(result.closedAt).toBeNull();
      const expectedDue = new Date(reopenNow.getTime() + 2880 * 60 * 1000);
      expect(result.slaDueAt?.toISOString()).toBe(expectedDue.toISOString());
    });

    it("Sets resolvedAt timestamp when moving to RESOLVED", () => {
      const ticket = {
        priority: Priority.MEDIUM,
        status: Status.OPEN,
        slaTargetMinutes: 1440,
        slaDueAt: new Date(),
        slaPausedAt: null,
        slaPausedRemainingSeconds: null,
        slaCycle: 1,
      };

      const result = SlaService.computeStateOnStatusChange(ticket, Status.RESOLVED, fixedNow);

      expect(result.status).toBe(Status.RESOLVED);
      expect(result.resolvedAt).toEqual(fixedNow);
    });

    it("Sets closedAt timestamp when moving to CLOSED", () => {
      const ticket = {
        priority: Priority.MEDIUM,
        status: Status.RESOLVED,
        slaTargetMinutes: 1440,
        slaDueAt: new Date(),
        slaPausedAt: null,
        slaPausedRemainingSeconds: null,
        slaCycle: 1,
      };

      const result = SlaService.computeStateOnStatusChange(ticket, Status.CLOSED, fixedNow);

      expect(result.status).toBe(Status.CLOSED);
      expect(result.closedAt).toEqual(fixedNow);
    });
  });
});
