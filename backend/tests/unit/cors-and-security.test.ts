import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { corsHeaders, handleCorsOptions } from "@/middlewares/cors.middleware";
import { createSessionToken, verifySessionToken } from "@/middlewares/auth.middleware";
import { Role } from "@prisma/client";

describe("CORS & Production Security Middleware", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("CORS Header Generation", () => {
    it("uses process.env.FRONTEND_URL when configured", () => {
      process.env.FRONTEND_URL = "https://busydesk.vercel.app";
      delete process.env.CORS_ORIGIN;

      const headers = corsHeaders("https://other-domain.com");
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://busydesk.vercel.app");
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
      expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
      expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
    });

    it("falls back to requestOrigin if no configured environment origin", () => {
      delete process.env.CORS_ORIGIN;
      delete process.env.FRONTEND_URL;

      const headers = corsHeaders("https://preview-deploy.vercel.app");
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://preview-deploy.vercel.app");
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    });

    it("falls back to localhost:3000 if neither configured origin nor requestOrigin is provided", () => {
      delete process.env.CORS_ORIGIN;
      delete process.env.FRONTEND_URL;

      const headers = corsHeaders(null);
      expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");
    });

    it("handles OPTIONS preflight requests returning 204 No Content with CORS headers", () => {
      process.env.FRONTEND_URL = "https://busydesk.vercel.app";
      const req = new Request("http://localhost:3001/api/tickets", {
        method: "OPTIONS",
        headers: { origin: "https://busydesk.vercel.app" },
      });

      const response = handleCorsOptions(req);
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://busydesk.vercel.app");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });

  describe("Session JWT Lifecycle", () => {
    it("creates, signs, and successfully verifies valid session token", async () => {
      const user = {
        id: "usr_test_123",
        email: "test.agent@busy.com",
        name: "Test Agent",
        role: Role.AGENT,
      };

      const token = await createSessionToken(user);
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);

      const verified = await verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(user.id);
      expect(verified?.email).toBe(user.email);
      expect(verified?.role).toBe(Role.AGENT);
    });

    it("rejects tampered or malformed JWT token", async () => {
      const fakeToken = "eyJhbGciOiJIUzI1NiJ9.invalidPayload.tamperedSignature";
      const verified = await verifySessionToken(fakeToken);
      expect(verified).toBeNull();
    });
  });
});
