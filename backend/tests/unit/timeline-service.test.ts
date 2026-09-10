import { describe, it, expect } from "vitest";
import { AuthorType, AuditEventType } from "@prisma/client";
import { TimelineItem } from "@/models/types.model";

describe("Unit Tests: Timeline Item Merging and Chronological Ordering", () => {
  it("Orders interleaved replies and audit logs chronologically", () => {
    const rawReplies = [
      {
        id: "rep-2",
        createdAt: new Date("2026-09-10T10:15:00Z"),
        authorId: "user-1",
        authorType: AuthorType.AGENT,
        authorName: "Agent One",
        authorEmail: "agent@test.com",
        body: "Investigating issue.",
        isInternal: false,
      },
      {
        id: "rep-1",
        createdAt: new Date("2026-09-10T10:00:00Z"),
        authorId: null,
        authorType: AuthorType.CUSTOMER,
        authorName: "Alice Customer",
        authorEmail: "alice@customer.com",
        body: "Help with login.",
        isInternal: false,
      },
    ];

    const rawAudits = [
      {
        id: "aud-1",
        createdAt: new Date("2026-09-10T10:00:00Z"),
        actorId: null,
        actorName: "System",
        eventType: AuditEventType.TICKET_CREATED,
        oldValue: null,
        newValue: { status: "NEW" },
        metadata: null,
      },
      {
        id: "aud-2",
        createdAt: new Date("2026-09-10T10:10:00Z"),
        actorId: "user-1",
        actorName: "Agent One",
        eventType: AuditEventType.STATUS_CHANGED,
        oldValue: { status: "NEW" },
        newValue: { status: "OPEN" },
        metadata: null,
      },
    ];

    const items: TimelineItem[] = [];
    for (const r of rawReplies) {
      items.push({
        id: `reply-${r.id}`,
        type: "REPLY",
        createdAt: r.createdAt.toISOString(),
        reply: r,
      });
    }
    for (const a of rawAudits) {
      items.push({
        id: `audit-${a.id}`,
        type: "AUDIT",
        createdAt: a.createdAt.toISOString(),
        audit: a,
      });
    }

    items.sort(
      (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
    );

    expect(items.length).toBe(4);
    // Early items at 10:00:00
    expect(new Date(items[0].createdAt).getTime()).toBe(new Date("2026-09-10T10:00:00Z").getTime());
    expect(new Date(items[1].createdAt).getTime()).toBe(new Date("2026-09-10T10:00:00Z").getTime());
    // Next item at 10:10:00
    expect(items[2].id).toBe("audit-aud-2");
    // Last item at 10:15:00
    expect(items[3].id).toBe("reply-rep-2");
  });
});
