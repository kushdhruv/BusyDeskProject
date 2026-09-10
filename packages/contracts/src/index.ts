export enum Role {
  SUPERVISOR = "SUPERVISOR",
  AGENT = "AGENT",
}

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum Category {
  BUG = "BUG",
  BILLING = "BILLING",
  FEATURE = "FEATURE",
  QUESTION = "QUESTION",
}

export enum Status {
  NEW = "NEW",
  OPEN = "OPEN",
  PENDING = "PENDING",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum AuthorType {
  AGENT = "AGENT",
  CUSTOMER = "CUSTOMER",
  SYSTEM = "SYSTEM",
}

export enum AuditEventType {
  TICKET_CREATED = "TICKET_CREATED",
  STATUS_CHANGED = "STATUS_CHANGED",
  REASSIGNED = "REASSIGNED",
  COLLABORATOR_ADDED = "COLLABORATOR_ADDED",
  COLLABORATOR_REMOVED = "COLLABORATOR_REMOVED",
  REPLY_ADDED = "REPLY_ADDED",
  TICKET_EDITED = "TICKET_EDITED",
  TICKET_ARCHIVED = "TICKET_ARCHIVED",
  TICKET_RESTORED = "TICKET_RESTORED",
  SLA_ALERT_ACKNOWLEDGED = "SLA_ALERT_ACKNOWLEDGED",
}

export enum AlertType {
  DUE_SOON = "DUE_SOON",
  BREACHED = "BREACHED",
}

export enum AlertStatus {
  ACTIVE = "ACTIVE",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  RESOLVED = "RESOLVED",
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface TicketDTO {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  priority: Priority;
  category: Category;
  status: Status;
  createdById: string;
  primaryAssigneeId: string | null;
  slaTargetMinutes: number;
  slaDueAt: Date | string | null;
  slaPausedAt: Date | string | null;
  slaPausedRemainingSeconds: number | null;
  slaCycle: number;
  resolvedAt: Date | string | null;
  closedAt: Date | string | null;
  archivedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTicketDTO {
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  priority?: Priority;
  category?: Category;
  primaryAssigneeId?: string | null;
}

export interface GetQueueParams {
  search?: string;
  status?: Status;
  priority?: Priority;
  category?: Category;
  assigneeId?: string;
  scope?: "all" | "assigned_to_me" | "collaborating" | "awaiting_customer" | "due_soon" | "breached" | "archived";
  sort?: "createdAt" | "updatedAt" | "priority" | "slaDueAt";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface BulkOperationDTO {
  ticketIds: string[];
  action: "reassign" | "close";
  newAssigneeId?: string;
}

export interface BulkOperationResult {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  results: {
    ticketId: string;
    success: boolean;
    error?: string;
  }[];
}

export interface TimelineItem {
  id: string;
  type: "reply" | "audit";
  timestamp: Date | string;
  data: any;
}
