import { describe, it, expect, vi, beforeEach } from "vitest";
import { ticketBroadcaster } from "@/utils/event-bus.util";
import { ReplyController } from "@/controllers/reply.controller";
import { Role } from "@prisma/client";

describe("Unit Tests: Chat Attachments & Real-Time Event Bus", () => {
  it("TicketBroadcaster accurately delivers events to subscribed ticket listeners", () => {
    const ticketId = "test-ticket-sse-123";
    const receivedEvents: any[] = [];

    const unsubscribe = ticketBroadcaster.subscribe(ticketId, (event) => {
      receivedEvents.push(event);
    });

    // Broadcast event for this ticket
    ticketBroadcaster.broadcast(ticketId, {
      type: "REPLY_ADDED",
      reply: { id: "rep-1", body: "Hello SSE" },
    });

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].type).toBe("REPLY_ADDED");
    expect(receivedEvents[0].reply.body).toBe("Hello SSE");

    // Unsubscribe and verify no more events received
    unsubscribe();

    ticketBroadcaster.broadcast(ticketId, {
      type: "REPLY_ADDED",
      reply: { id: "rep-2", body: "Should not be received" },
    });

    expect(receivedEvents.length).toBe(1);
  });

  it("TicketBroadcaster isolates events between different ticket IDs", () => {
    const ticketA = "ticket-A";
    const ticketB = "ticket-B";
    const eventsA: any[] = [];
    const eventsB: any[] = [];

    const unsubA = ticketBroadcaster.subscribe(ticketA, (e) => eventsA.push(e));
    const unsubB = ticketBroadcaster.subscribe(ticketB, (e) => eventsB.push(e));

    ticketBroadcaster.broadcast(ticketA, { type: "MSG_A" });

    expect(eventsA.length).toBe(1);
    expect(eventsB.length).toBe(0);

    unsubA();
    unsubB();
  });
});
