import { GetQueueParams, BulkOperationDTO, CreateTicketDTO } from "@/packages/contracts/src";

/**
 * Pure HTTP REST API Client for Decoupled Frontend Layer
 * Completely decoupled from database ORM and backend logic.
 */
export class ApiClient {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      let errorMessage = `HTTP Error ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.error) errorMessage = errorData.error;
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }

    return res.json() as Promise<T>;
  }

  // Auth Endpoints
  static async login(email: string, password: string) {
    return this.request<{ user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  static async logout() {
    return this.request<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
    });
  }

  static async getMe() {
    return this.request<{ user: any }>("/api/auth/me");
  }

  // Ticket Endpoints
  static async getQueue(params: GetQueueParams) {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.status) query.append("status", params.status);
    if (params.priority) query.append("priority", params.priority);
    if (params.category) query.append("category", params.category);
    if (params.assigneeId) query.append("assigneeId", params.assigneeId);
    if (params.scope) query.append("scope", params.scope);
    if (params.sort) query.append("sort", params.sort);
    if (params.order) query.append("order", params.order);
    if (params.page) query.append("page", params.page.toString());
    if (params.limit) query.append("limit", params.limit.toString());

    return this.request<{
      tickets: any[];
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    }>(`/api/tickets?${query.toString()}`);
  }

  static async getTicketById(id: string) {
    return this.request<{ ticket: any; timeline: any[]; permissions: any }>(`/api/tickets/${id}`);
  }

  static async createTicket(data: CreateTicketDTO) {
    return this.request<{ ticket: any }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  static async updateStatus(ticketId: string, status: string) {
    return this.request<{ ticket: any }>(`/api/tickets/${ticketId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  static async reassign(ticketId: string, assigneeId: string | null) {
    return this.request<{ ticket: any }>(`/api/tickets/${ticketId}/reassign`, {
      method: "PATCH",
      body: JSON.stringify({ assigneeId }),
    });
  }

  static async addReply(ticketId: string, body: string, isInternal: boolean) {
    return this.request<{ reply: any }>(`/api/tickets/${ticketId}/replies`, {
      method: "POST",
      body: JSON.stringify({ body, isInternal }),
    });
  }

  static async addCollaborator(ticketId: string, userId: string) {
    return this.request<{ collaborator: any }>(`/api/tickets/${ticketId}/collaborators`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  static async removeCollaborator(ticketId: string, userId: string) {
    return this.request<{ success: boolean }>(`/api/tickets/${ticketId}/collaborators?userId=${userId}`, {
      method: "DELETE",
    });
  }

  static async bulkOperation(data: BulkOperationDTO) {
    return this.request<any>("/api/tickets/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  static async archiveTicket(ticketId: string) {
    return this.request<{ ticket: any }>(`/api/tickets/${ticketId}/archive`, {
      method: "PATCH",
    });
  }

  static async restoreTicket(ticketId: string) {
    return this.request<{ ticket: any }>(`/api/tickets/${ticketId}/restore`, {
      method: "PATCH",
    });
  }

  // Dashboard Metrics
  static async getDashboard() {
    return this.request<{
      headline: {
        openCount: number;
        pendingCustomerCount: number;
        resolvedThisWeekCount: number;
        breachedCount: number;
      };
      byStatus: { status: string; count: number }[];
      byAgent: { agentId: string; agentName: string; count: number }[];
      resolvedWeeklyHistory: { weekLabel: string; resolvedCount: number; avgResolutionHours: number }[];
    }>("/api/dashboard");
  }

  // Alerts
  static async getAlerts() {
    return this.request<{ count: number; alerts: any[] }>("/api/sla/alerts");
  }

  static async acknowledgeAlert(ticketId: string) {
    return this.request<{ success: boolean }>(`/api/tickets/${ticketId}/acknowledge-alert`, {
      method: "POST",
    });
  }
}
