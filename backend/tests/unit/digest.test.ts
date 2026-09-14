import { describe, it, expect } from "vitest";
import { Priority, Status, DigestFrequency } from "@prisma/client";
import { DigestService, AgentDigestData, SupervisorDigestData } from "@/services/digest.service";

describe("Email Digest Unit Tests", () => {
  const mockAgentData: AgentDigestData = {
    agent: {
      id: "agent-123",
      name: "Sarah Jenkins",
      email: "sarah@busy.com",
    },
    period: "daily",
    generatedAt: new Date("2026-09-13T08:30:00Z"),
    metrics: {
      assignedOpenCount: 4,
      assignedPendingCount: 2,
      urgentCount: 1,
      dueSoonCount: 1,
      breachedCount: 0,
      resolvedRecentCount: 3,
      awaitingAgentReplyCount: 2,
      recentCsatRating: 4.8,
    },
    urgentTickets: [
      {
        id: "t-1",
        ticketNumber: 1042,
        subject: "Production database connection spike",
        priority: Priority.URGENT,
        status: Status.OPEN,
        slaDueAt: new Date("2026-09-13T09:30:00Z"),
      },
    ],
    shouldSuppress: false,
  };

  const mockSupervisorData: SupervisorDigestData = {
    supervisor: {
      id: "sup-1",
      name: "Suresh Menon",
      email: "supervisor@busy.com",
    },
    period: "daily",
    generatedAt: new Date("2026-09-13T08:30:00Z"),
    metrics: {
      totalOpenTickets: 24,
      totalPendingTickets: 8,
      newTicketsCount: 14,
      resolvedTicketsCount: 11,
      slaBreachedCount: 1,
      slaComplianceRate: 94,
      averageCsat: 4.7,
      csatResponseCount: 8,
    },
    agentWorkloads: [
      {
        id: "agent-1",
        name: "Sarah Jenkins",
        activeTicketsCount: 7,
        breachedCount: 0,
        resolvedCount: 5,
      },
      {
        id: "agent-2",
        name: "Alex Rivera",
        activeTicketsCount: 9,
        breachedCount: 1,
        resolvedCount: 4,
      },
    ],
    atRiskTickets: [
      {
        id: "t-2",
        ticketNumber: 1045,
        subject: "SAML SSO identity provider certificate expired",
        priority: Priority.URGENT,
        assigneeName: "Alex Rivera",
        slaDueAt: new Date("2026-09-13T09:00:00Z"),
      },
    ],
  };

  describe("Agent Digest HTML Rendering", () => {
    it("renders agent greeting, metrics, and actionable ticket links", () => {
      const html = DigestService.renderAgentDigestHtml(mockAgentData, "https://support.busy.com");

      expect(html).toContain("Good morning, Sarah Jenkins");
      expect(html).toContain("4"); // Open assigned count
      expect(html).toContain("4.8 ★"); // CSAT rating
      expect(html).toContain("#1042 Production database connection spike");
      expect(html).toContain("https://support.busy.com/tickets/t-1");
      expect(html).toContain("https://support.busy.com/tickets?scope=assigned_to_me");
    });

    it("renders green SLA badge when no breaching tickets", () => {
      const cleanData: AgentDigestData = {
        ...mockAgentData,
        metrics: {
          ...mockAgentData.metrics,
          dueSoonCount: 0,
          breachedCount: 0,
        },
        urgentTickets: [],
      };

      const html = DigestService.renderAgentDigestHtml(cleanData);
      expect(html).toContain("All clear on SLAs!");
      expect(html).toContain("On Track");
    });
  });

  describe("Supervisor Digest HTML Rendering", () => {
    it("renders department overview, workload distribution table, and at-risk tickets", () => {
      const html = DigestService.renderSupervisorDigestHtml(mockSupervisorData, "https://support.busy.com");

      expect(html).toContain("Support Operations Briefing");
      expect(html).toContain("Supervisor: Suresh Menon");
      expect(html).toContain("24"); // Total open
      expect(html).toContain("94%"); // SLA compliance rate
      expect(html).toContain("Sarah Jenkins");
      expect(html).toContain("Alex Rivera");
      expect(html).toContain("#1045 SAML SSO identity provider certificate expired");
      expect(html).toContain("https://support.busy.com/dashboard");
    });
  });

  describe("Smart Suppression Behavior", () => {
    it("suppresses agent digest when agent has 0 actionable items", () => {
      const emptyAgentData: AgentDigestData = {
        agent: { id: "a-3", name: "Quiet Agent", email: "quiet@busy.com" },
        period: "daily",
        generatedAt: new Date(),
        metrics: {
          assignedOpenCount: 0,
          assignedPendingCount: 0,
          urgentCount: 0,
          dueSoonCount: 0,
          breachedCount: 0,
          resolvedRecentCount: 0,
          awaitingAgentReplyCount: 0,
          recentCsatRating: null,
        },
        urgentTickets: [],
        shouldSuppress: true,
        suppressReason: "No active tickets or pending customer replies assigned.",
      };

      expect(emptyAgentData.shouldSuppress).toBe(true);
      expect(emptyAgentData.suppressReason).toBeDefined();
    });
  });

  describe("Enriched Digest Features", () => {
    it("renders customer follow-up section and resolved momentum banner", () => {
      const enrichedData: AgentDigestData = {
        ...mockAgentData,
        awaitingReplies: [
          {
            id: "t-rep-1",
            ticketNumber: 2011,
            subject: "Error connecting via SSH key",
            priority: Priority.HIGH,
            customerName: "Alice Walker",
            lastReplyTime: new Date("2026-09-13T08:15:00Z"),
          },
        ],
        recentResolvedHighlights: [
          {
            id: "t-res-1",
            ticketNumber: 1999,
            subject: "Reset multi-factor authentication",
            resolvedAt: new Date("2026-09-13T07:00:00Z"),
          },
        ],
      };

      const html = DigestService.renderAgentDigestHtml(enrichedData, "https://support.busy.com");

      expect(html).toContain("Customer Follow-ups Awaiting Reply");
      expect(html).toContain("#2011 Error connecting via SSH key");
      expect(html).toContain("Alice Walker");
      expect(html).toContain("Momentum:");
      expect(html).toContain("3 tickets");
    });

    it("renders weekly digest header and unassigned tickets warning for supervisor", () => {
      const weeklySupervisorData: SupervisorDigestData = {
        ...mockSupervisorData,
        period: "weekly",
        metrics: {
          ...mockSupervisorData.metrics,
          unassignedCount: 5,
        },
      };

      const html = DigestService.renderSupervisorDigestHtml(weeklySupervisorData, "https://support.busy.com");

      expect(html).toContain("5 Unassigned Tickets");
      expect(html).toContain("Resolved (weekly)");
    });

    it("renders customer reply preview snippet, productivity pulse, tags, and unassigned backlog alert", () => {
      const advancedAgentData: AgentDigestData = {
        ...mockAgentData,
        metrics: {
          ...mockAgentData.metrics,
          repliesSentCount: 12,
          internalNotesCount: 4,
          unassignedTeamCount: 6,
        },
        personalSlaComplianceRate: 98,
        urgentTickets: [
          {
            id: "t-urg-1",
            ticketNumber: 3044,
            subject: "Payment webhook failing for Stripe",
            priority: Priority.URGENT,
            status: Status.OPEN,
            category: "BILLING",
            tags: ["vip", "escalated"],
            customerCompany: "AcmeCorp",
            slaDueAt: new Date("2026-09-13T09:00:00Z"),
          },
        ],
        awaitingReplies: [
          {
            id: "t-rep-2",
            ticketNumber: 3045,
            subject: "OAuth2 configuration question",
            priority: Priority.HIGH,
            category: "INTEGRATION",
            customerName: "David Miller",
            lastReplySnippet: "I checked the redirect URI but still get invalid_grant...",
            lastReplyTime: new Date("2026-09-13T08:00:00Z"),
          },
        ],
      };

      const html = DigestService.renderAgentDigestHtml(advancedAgentData, "https://support.busy.com");

      // Verify unassigned team backlog alert
      expect(html).toContain("Team Backlog:");
      expect(html).toContain("6 unassigned ticket(s)");
      expect(html).toContain("https://support.busy.com/tickets?scope=unassigned");

      // Verify productivity pulse
      expect(html).toContain("Your Activity");
      expect(html).toContain("12");
      expect(html).toContain("responses sent");
      expect(html).toContain("4");
      expect(html).toContain("internal notes");
      expect(html).toContain("98% SLA Adherence");

      // Verify ticket category and tags
      expect(html).toContain("BILLING");
      expect(html).toContain("#vip");
      expect(html).toContain("#escalated");
      expect(html).toContain("(AcmeCorp)");

      // Verify customer snippet
      expect(html).toContain("I checked the redirect URI but still get invalid_grant...");
    });
  });
});

