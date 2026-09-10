export type Role = "SUPERVISOR" | "AGENT";
export type Status = "NEW" | "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
export type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
export type Category = "BUG" | "BILLING" | "FEATURE" | "QUESTION";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type SessionUser = User;

export interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId?: string | null;
  assignee?: User | null;
  creatorId?: string | null;
  creator?: User | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  responseDueAt?: string | null;
  resolutionDueAt?: string | null;
  firstRespondedAt?: string | null;
  archivedAt?: string | null;
  tags?: string[];
  collaborators?: { user: User; userId: string; ticketId: string }[];
  replies?: any[];
  timeline?: any[];
  breachingSla?: boolean;
}

export interface TicketPermissions {
  canReply: boolean;
  canAddInternalNote: boolean;
  canReassign: boolean;
  canManageCollaborators: boolean;
  canClose: boolean;
  canReopen: boolean;
  canArchive: boolean;
  canAcknowledgeAlert: boolean;
}

export interface TimelineItem {
  id: string;
  type: "REPLY" | "AUDIT";
  createdAt: string;
  reply?: any;
  audit?: any;
}

export interface BulkActionResponse {
  totalRequested: number;
  succeededCount: number;
  failedCount: number;
  results: {
    ticketId: string;
    ticketNumber?: number;
    subject?: string;
    status: "SUCCESS" | "FAILED";
    reason?: string;
  }[];
}

export interface DashboardMetrics {
  openTicketsCount: number;
  pendingOnCustomerCount: number;
  resolvedThisWeekCount: number;
  breachingSlaCount: number;
  statusBreakdown: { status: Status; count: number }[];
  agentBreakdown: { agentId: string; agentName: string; activeTicketsCount: number }[];
  weeklyResolutionTrend: { weekStart: string; weekLabel: string; resolvedCount: number }[];
}

export interface AlertItem {
  ticketId: string;
  ticketNumber: number;
  title: string;
  priority: Priority;
  status: Status;
  breachType: "FIRST_RESPONSE" | "RESOLUTION";
  dueAt: string;
  assigneeName: string;
}
