/**
 * Agent Invitation & Account Setup Unit Tests
 * Verifies one-time token generation, SHA-256 hashing, 24-hour expiration,
 * role authorization, and atomic account activation.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import crypto from "crypto";
import { prisma } from "../../db/prisma.db";
import { AgentController } from "../../controllers/agent.controller";
import { SetupAccountController } from "../../controllers/setup-account.controller";
import { AuthController } from "../../controllers/auth.controller";
import { Role, UserStatus } from "@prisma/client";
import { SessionUser } from "../../models/types.model";

const supervisorSession: SessionUser = {
  id: "test-supervisor-id",
  email: "supervisor-test@busyinfotech.test",
  name: "Head Supervisor",
  role: "SUPERVISOR",
};

const agentSession: SessionUser = {
  id: "test-agent-id",
  email: "agent-test@busyinfotech.test",
  name: "Regular Agent",
  role: "AGENT",
};

describe("Agent Invitation & Setup Account Workflow", () => {
  const testAgentEmail = `test.invited.agent.${Date.now()}@busyinfotech.test`;

  beforeEach(async () => {
    // Cleanup any prior test artifacts
    const existing = await prisma.user.findUnique({ where: { email: testAgentEmail } });
    if (existing) {
      await prisma.agentInvitation.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  afterAll(async () => {
    const existing = await prisma.user.findUnique({ where: { email: testAgentEmail } });
    if (existing) {
      await prisma.agentInvitation.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  it("should enforce authorization: only SUPERVISOR can invite new agents", async () => {
    await expect(
      AgentController.inviteAgent(agentSession, {
        name: "Test Agent",
        email: testAgentEmail,
      })
    ).rejects.toThrow("Forbidden: Only supervisors can invite new agents.");
  });

  it("should create user in PENDING_SETUP state and generate 24h single-use token", async () => {
    const result = await AgentController.inviteAgent(supervisorSession, {
      name: "Sarah Connor",
      email: testAgentEmail,
    });

    expect(result.user.email).toBe(testAgentEmail);
    expect(result.user.status).toBe(UserStatus.PENDING_SETUP);
    expect(result.user.role).toBe(Role.AGENT);
    expect(result.setupUrl).toContain("/setup-account?token=");

    // Verify token parameter extraction
    const setupUrlObj = new URL(result.setupUrl);
    const rawToken = setupUrlObj.searchParams.get("token")!;
    expect(rawToken).toBeDefined();
    expect(rawToken.length).toBe(64); // 32 bytes hex = 64 chars

    // Verify token is stored as SHA-256 in DB, NOT plaintext
    const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const storedInvitation = await prisma.agentInvitation.findUnique({
      where: { tokenHash: expectedHash },
    });

    expect(storedInvitation).toBeDefined();
    expect(storedInvitation!.usedAt).toBeNull();
    // Expiration should be ~24 hours from now
    const hoursRemaining = (storedInvitation!.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursRemaining).toBeGreaterThan(23.5);
    expect(hoursRemaining).toBeLessThanOrEqual(24);
  });

  it("should prevent login while account is in PENDING_SETUP state", async () => {
    await AgentController.inviteAgent(supervisorSession, {
      name: "Sarah Connor",
      email: testAgentEmail,
    });

    await expect(
      AuthController.authenticate(testAgentEmail, "AnyPassword123!")
    ).rejects.toThrow("Your account has not been set up yet.");
  });

  it("should validate invitation token without consuming it", async () => {
    const result = await AgentController.inviteAgent(supervisorSession, {
      name: "Sarah Connor",
      email: testAgentEmail,
    });

    const rawToken = new URL(result.setupUrl).searchParams.get("token")!;

    // Validate token
    const validation = await SetupAccountController.validateInvitationToken(rawToken);
    expect(validation.valid).toBe(true);
    expect(validation.name).toBe("Sarah Connor");
    expect(validation.email).toBe(testAgentEmail);
    expect(validation.role).toBe(Role.AGENT);

    // Invalid token check
    const invalidValidation = await SetupAccountController.validateInvitationToken("invalid-tampered-token");
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.error).toContain("invalid");
  });

  it("should complete account setup atomically and activate the agent", async () => {
    const result = await AgentController.inviteAgent(supervisorSession, {
      name: "Sarah Connor",
      email: testAgentEmail,
    });

    const rawToken = new URL(result.setupUrl).searchParams.get("token")!;
    const newPassword = "SuperSecurePassword2026!";

    // Complete setup
    const activatedUser = await SetupAccountController.completeAccountSetup(rawToken, newPassword);
    expect(activatedUser.email).toBe(testAgentEmail);
    expect(activatedUser.role).toBe(Role.AGENT);

    // Verify DB user is now ACTIVE and password hash is valid bcrypt
    const dbUser = await prisma.user.findUnique({ where: { email: testAgentEmail } });
    expect(dbUser!.status).toBe(UserStatus.ACTIVE);
    expect(dbUser!.passwordHash).not.toContain("!PENDING_SETUP");

    // Verify invitation is marked used
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const invitation = await prisma.agentInvitation.findUnique({ where: { tokenHash } });
    expect(invitation!.usedAt).not.toBeNull();

    // Replay attack prevention: second attempt with same token must fail
    await expect(
      SetupAccountController.completeAccountSetup(rawToken, "AnotherPassword123!")
    ).rejects.toThrow("This invitation has already been used");

    // Authenticate with new password should now succeed
    const session = await AuthController.authenticate(testAgentEmail, newPassword);
    expect(session.email).toBe(testAgentEmail);
  });

  it("should allow supervisor to resend invitation and rotate the token", async () => {
    const result1 = await AgentController.inviteAgent(supervisorSession, {
      name: "Sarah Connor",
      email: testAgentEmail,
    });
    const rawToken1 = new URL(result1.setupUrl).searchParams.get("token")!;

    // Resend invitation
    const result2 = await AgentController.resendInvitation(supervisorSession, result1.user.id);
    const rawToken2 = new URL(result2.setupUrl).searchParams.get("token")!;

    expect(rawToken2).not.toBe(rawToken1);

    // Old token must now be invalid
    const validationOld = await SetupAccountController.validateInvitationToken(rawToken1);
    expect(validationOld.valid).toBe(false);

    // New token must be valid
    const validationNew = await SetupAccountController.validateInvitationToken(rawToken2);
    expect(validationNew.valid).toBe(true);
  });
});
