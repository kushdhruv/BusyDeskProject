export type Role = "SUPERVISOR" | "AGENT" | "CUSTOMER";
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

export interface CustomerSatisfaction {
  id: string;
  ticketId?: string;
  userId?: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  status: Status;
  priority: Priority;
  category: Category;
  requesterId: string;
  requesterName?: string;
  requesterEmail?: string;
  primaryAssigneeId?: string | null;
  primaryAssignee?: User | null;
  createdById?: string | null;
  createdBy?: User | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaTargetMinutes?: number;
  slaDueAt?: string | null;
  slaPausedRemainingSeconds?: number | null;
  slaCycle?: number;
  archivedAt?: string | null;
  collaborators?: { user: User; userId: string; ticketId: string }[];
  replies?: any[];
  timeline?: any[];
  satisfaction?: CustomerSatisfaction | null;
  canRateCsat?: boolean;
}

export interface TicketPermissions {
  canView: boolean;
  canEdit: boolean;
  canReassign: boolean;
  canClose: boolean;
  canReopen: boolean;
  canArchive: boolean;
  canReply: boolean;
  canAddInternalNote: boolean;
  canManageCollaborators: boolean;
  canAcknowledgeAlert: boolean;
  canRateCsat: boolean;
}

export interface TimelineItem {
  id: string;
  type: "REPLY" | "AUDIT";
  createdAt: string;
  reply?: {
    id: string;
    authorId: string | null;
    authorType: "AGENT" | "CUSTOMER";
    authorName: string;
    authorEmail: string;
    body: string;
    isInternal: boolean;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentSize?: number | null;
    attachmentType?: string | null;
  };
  audit?: {
    id: string;
    actorId: string | null;
    actorName: string;
    eventType: string;
    oldValue: any;
    newValue: any;
    metadata: any;
  };
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
  slaComplianceRate?: number;
  statusBreakdown: { status: Status; count: number }[];
  agentBreakdown: { agentId: string; agentName: string; agentEmail?: string; activeTicketsCount: number }[];
  weeklyResolutionTrend: { weekStart: string; weekLabel: string; resolvedCount: number }[];
  averageCsatRating?: number;
  csatResponseCount?: number;
  csatRatingDistribution?: { rating: number; count: number }[];
  recentReviews?: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    ticket: {
      id: string;
      ticketNumber: number;
      subject: string;
      primaryAssignee?: { id: string; name: string } | null;
    };
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
}

export interface CustomerDashboardMetrics {
  totalTicketsCount: number;
  openTicketsCount: number;
  pendingOnCustomerCount: number;
  resolvedTicketsCount: number;
}

export interface AlertItem {
  id: string;
  ticketId: string;
  type: "DUE_SOON" | "BREACHED";
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  breachCycle: number;
  createdAt: string;
  ticket?: {
    id: string;
    ticketNumber: number;
    subject: string;
    priority: Priority;
    status: Status;
    slaDueAt: string;
    primaryAssignee?: { name: string } | null;
  };
}
