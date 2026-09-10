import { describe, it, expect } from "vitest";
import { Role, Status } from "@prisma/client";
import { LifecycleController as LifecycleService } from "@/controllers/lifecycle.controller";
import { SessionUser } from "@/models/types.model";
import { REOPEN_WINDOW_DAYS, REOPEN_WINDOW_MS } from "@/utils/constants.util";

describe("Unit Tests: LifecycleService State Machine Validation", () => {
  const supervisor: SessionUser = {
    id: "sup-1",
    email: "supervisor@test.com",
    name: "Supervisor",
    role: Role.SUPERVISOR,
  };

  const agent: SessionUser = {
    id: "agent-1",
    email: "agent@test.com",
    name: "Agent",
    role: Role.AGENT,
  };

  describe("Self-transitions (same status)", () => {
    const statuses = [Status.NEW, Status.OPEN, Status.PENDING, Status.RESOLVED, Status.CLOSED];
    for (const s of statuses) {
      it(`Rejects self-transition ${s} -> ${s}`, () => {
        const result = LifecycleService.validateTransition(s, s, supervisor, {});
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("already in");
      });
    }
  });

  describe("From NEW status", () => {
    it("Allows NEW -> OPEN", () => {
      const res = LifecycleService.validateTransition(Status.NEW, Status.OPEN, agent, {});
      expect(res.valid).toBe(true);
    });

    it("Rejects NEW -> PENDING", () => {
      const res = LifecycleService.validateTransition(Status.NEW, Status.PENDING, agent, {});
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("must be moved to OPEN");
    });

    it("Rejects NEW -> RESOLVED", () => {
      const res = LifecycleService.validateTransition(Status.NEW, Status.RESOLVED, agent, {});
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("must be moved to OPEN");
    });

    it("Rejects NEW -> CLOSED", () => {
      const res = LifecycleService.validateTransition(Status.NEW, Status.CLOSED, supervisor, {});
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("must be moved to OPEN");
    });
  });

  describe("From OPEN status", () => {
    it("Allows OPEN -> PENDING (waiting on customer)", () => {
      const res = LifecycleService.validateTransition(Status.OPEN, Status.PENDING, agent, {});
      expect(res.valid).toBe(true);
    });

    it("Allows OPEN -> RESOLVED (resolution achieved)", () => {
      const res = LifecycleService.validateTransition(Status.OPEN, Status.RESOLVED, agent, {});
      expect(res.valid).toBe(true);
    });

    it("Rejects OPEN -> CLOSED (must be RESOLVED first)", () => {
      const res = LifecycleService.validateTransition(Status.OPEN, Status.CLOSED, supervisor, {});
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("marked as RESOLVED before they can be CLOSED");
    });

    it("Rejects OPEN -> NEW", () => {
      const res = LifecycleService.validateTransition(Status.OPEN, Status.NEW, agent, {});
      expect(res.valid).toBe(false);
    });
  });

  describe("From PENDING status", () => {
    it("Allows PENDING -> OPEN (customer reply or resumed triage)", () => {
      const res = LifecycleService.validateTransition(Status.PENDING, Status.OPEN, agent, {});
      expect(res.valid).toBe(true);
    });

    it("Allows PENDING -> RESOLVED", () => {
      const res = LifecycleService.validateTransition(Status.PENDING, Status.RESOLVED, agent, {});
      expect(res.valid).toBe(true);
    });

    it("Rejects PENDING -> CLOSED", () => {
      const res = LifecycleService.validateTransition(Status.PENDING, Status.CLOSED, supervisor, {});
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("must return to OPEN or RESOLVED");
    });

    it("Rejects PENDING -> NEW", () => {
      const res = LifecycleService.validateTransition(Status.PENDING, Status.NEW, agent, {});
      expect(res.valid).toBe(false);
    });
  });

  describe("From RESOLVED status", () => {
    it("Allows RESOLVED -> OPEN (reopened by agent or supervisor)", () => {
      const res = LifecycleService.validateTransition(Status.RESOLVED, Status.OPEN, agent, {});
      expect(res.valid).toBe(true);
    });

    it("Allows RESOLVED -> CLOSED when actor is Supervisor", () => {
      const res = LifecycleService.validateTransition(Status.RESOLVED, Status.CLOSED, supervisor, {});
      expect(res.valid).toBe(true);
    });

    it("Rejects RESOLVED -> CLOSED when actor is Agent", () => {
      const res = LifecycleService.validateTransition(Status.RESOLVED, Status.CLOSED, agent, {});
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("Only Supervisors are authorized");
    });

    it("Rejects RESOLVED -> PENDING or RESOLVED -> NEW", () => {
      const res1 = LifecycleService.validateTransition(Status.RESOLVED, Status.PENDING, agent, {});
      expect(res1.valid).toBe(false);
      const res2 = LifecycleService.validateTransition(Status.RESOLVED, Status.NEW, agent, {});
      expect(res2.valid).toBe(false);
    });
  });

  describe("From CLOSED status (Strict 7-Day Window and Role Verification)", () => {
    it("Allows Supervisor to reopen ticket closed 3 days ago", () => {
      const closedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const res = LifecycleService.validateTransition(Status.CLOSED, Status.OPEN, supervisor, {
        closedAt,
      });
      expect(res.valid).toBe(true);
    });

    it("Rejects Agent attempting to reopen a recently closed ticket", () => {
      const closedAt = new Date(Date.now() - 1000);
      const res = LifecycleService.validateTransition(Status.CLOSED, Status.OPEN, agent, {
        closedAt,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("Only Supervisors are authorized");
    });

    it("Rejects Supervisor reopening ticket closed 10 days ago (expired past 7-day window)", () => {
      const closedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const res = LifecycleService.validateTransition(Status.CLOSED, Status.OPEN, supervisor, {
        closedAt,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain(`the ${REOPEN_WINDOW_DAYS}-day reopen window expired`);
    });

    it("Rejects reopening if closedAt timestamp is null or missing", () => {
      const res = LifecycleService.validateTransition(Status.CLOSED, Status.OPEN, supervisor, {
        closedAt: null,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("missing; cannot verify reopen window");
    });

    it("Rejects CLOSED -> RESOLVED or CLOSED -> PENDING", () => {
      const closedAt = new Date(Date.now() - 1000);
      const res = LifecycleService.validateTransition(Status.CLOSED, Status.RESOLVED, supervisor, {
        closedAt,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("can only be reopened to OPEN");
    });
  });
});
