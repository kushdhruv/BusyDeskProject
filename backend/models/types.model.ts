/**
 * Models & Types Layer
 * Exports domain data contracts, interfaces, and Prisma enums.
 */

import {
  Role,
  Priority,
  Category,
  Status,
  AuthorType,
  AuditEventType,
  SlaAlertType,
  SlaAlertStatus,
} from "@prisma/client";

export {
  Role,
  Priority,
  Category,
  Status,
  AuthorType,
  AuditEventType,
  SlaAlertType,
  SlaAlertStatus,
};

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
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
    authorType: AuthorType;
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
    eventType: AuditEventType;
    oldValue: any;
    newValue: any;
    metadata: any;
  };
}

export interface BulkActionResultItem {
  ticketId: string;
  ticketNumber: number;
  subject: string;
  status: "SUCCESS" | "FAILED";
  reason?: string;
}

export interface BulkActionResponse {
  totalRequested: number;
  succeededCount: number;
  failedCount: number;
  results: BulkActionResultItem[];
}

export interface DashboardMetrics {
  openTicketsCount: number;
  pendingOnCustomerCount: number;
  resolvedThisWeekCount: number;
  breachingSlaCount: number;
  slaComplianceRate: number;
  statusBreakdown: { status: Status; count: number }[];
  agentBreakdown: {
    agentId: string;
    agentName: string;
    agentEmail: string;
    activeTicketsCount: number;
  }[];
  weeklyResolutionTrend: {
    weekLabel: string;
    weekStart: string;
    resolvedCount: number;
  }[];
  averageCsatRating: number;
  csatResponseCount: number;
  csatRatingDistribution: { rating: number; count: number }[];
}

export interface CustomerDashboardMetrics {
  totalTicketsCount: number;
  openTicketsCount: number;
  pendingOnCustomerCount: number;
  resolvedTicketsCount: number;
}
