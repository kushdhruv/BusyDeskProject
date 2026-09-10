import { describe, it, expect } from "vitest";
import { API_ROUTE_REGISTRY } from "@/routes";

describe("Route Registry & Definitions", () => {
  it("should contain all expected API routes with required metadata", () => {
    expect(API_ROUTE_REGISTRY.length).toBeGreaterThanOrEqual(18);

    const endpoints = API_ROUTE_REGISTRY.map((r) => `${r.method} ${r.path}`);
    
    // Auth
    expect(endpoints).toContain("POST /api/auth/login");
    expect(endpoints).toContain("POST /api/auth/logout");
    expect(endpoints).toContain("GET /api/auth/me");
    expect(endpoints).toContain("POST /api/auth/register");

    // Tickets
    expect(endpoints).toContain("GET /api/tickets");
    expect(endpoints).toContain("POST /api/tickets");
    expect(endpoints).toContain("GET /api/tickets/[id]");
    expect(endpoints).toContain("PATCH /api/tickets/[id]");
    expect(endpoints).toContain("POST /api/tickets/[id]/status");
    expect(endpoints).toContain("POST /api/tickets/[id]/reassign");
    expect(endpoints).toContain("POST /api/tickets/[id]/archive");
    expect(endpoints).toContain("POST /api/tickets/[id]/restore");

    // Replies
    expect(endpoints).toContain("POST /api/tickets/[id]/replies");
    expect(endpoints).toContain("POST /api/tickets/[id]/customer-reply");

    // Collaboration
    expect(endpoints).toContain("POST /api/tickets/[id]/collaborators");
    expect(endpoints).toContain("DELETE /api/tickets/[id]/collaborators");

    // SLA, CSAT, Bulk, Export, Dashboard, Users
    expect(endpoints).toContain("GET /api/sla/alerts");
    expect(endpoints).toContain("POST /api/tickets/[id]/acknowledge-alert");
    expect(endpoints).toContain("POST /api/tickets/[id]/csat");
    expect(endpoints).toContain("POST /api/tickets/bulk");
    expect(endpoints).toContain("GET /api/tickets/export");
    expect(endpoints).toContain("GET /api/dashboard");
    expect(endpoints).toContain("GET /api/users");
  });

  it("should enforce valid authentication requirement flags", () => {
    const publicRoutes = API_ROUTE_REGISTRY.filter((r) => !r.authRequired).map(
      (r) => `${r.method} ${r.path}`
    );

    expect(publicRoutes).toContain("POST /api/auth/login");
    expect(publicRoutes).toContain("POST /api/auth/logout");
    expect(publicRoutes).toContain("POST /api/auth/register");
    expect(publicRoutes).toContain("POST /api/tickets/[id]/customer-reply");
  });
});
