/**
 * Ticket Event Bus for real-time SSE streaming across agents and customers.
 */

type TicketEventListener = (data: any) => void;

class TicketBroadcaster {
  private listeners: Map<string, Set<TicketEventListener>> = new Map();

  subscribe(ticketId: string, listener: TicketEventListener): () => void {
    if (!this.listeners.has(ticketId)) {
      this.listeners.set(ticketId, new Set());
    }
    this.listeners.get(ticketId)!.add(listener);

    return () => {
      const set = this.listeners.get(ticketId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(ticketId);
        }
      }
    };
  }

  broadcast(ticketId: string, event: { type: string; [key: string]: any }) {
    const set = this.listeners.get(ticketId);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error("Error dispatching ticket event:", err);
        }
      });
    }
  }
}

const globalForBroadcaster = global as unknown as { ticketBroadcaster?: TicketBroadcaster };
export const ticketBroadcaster =
  globalForBroadcaster.ticketBroadcaster || new TicketBroadcaster();

if (process.env.NODE_ENV !== "production") {
  globalForBroadcaster.ticketBroadcaster = ticketBroadcaster;
}
