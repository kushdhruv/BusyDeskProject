import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import { createSessionToken, verifySessionToken } from "@/middlewares/auth.middleware";
import { SessionUser } from "@/models/types.model";

describe("Unit Tests: Authentication & JWT Tokens", () => {
  const mockUser: SessionUser = {
    id: "usr-unit-123",
    email: "agent.unit@test.com",
    name: "Unit Agent",
    role: Role.AGENT,
  };

  it("Signs and verifies a valid JWT session token", async () => {
    const token = await createSessionToken(mockUser);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // Header.Payload.Signature

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(mockUser.id);
    expect(verified?.email).toBe(mockUser.email);
    expect(verified?.name).toBe(mockUser.name);
    expect(verified?.role).toBe(mockUser.role);
  });

  it("Rejects tampered or corrupted JWT tokens", async () => {
    const token = await createSessionToken(mockUser);
    const parts = token.split(".");
    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ id: mockUser.id, role: Role.SUPERVISOR })
    ).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const verified = await verifySessionToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it("Rejects malformed strings or empty tokens", async () => {
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
    expect(await verifySessionToken("a.b.c.d")).toBeNull();
  });
});
