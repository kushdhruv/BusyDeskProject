/**
 * Central API Route Registry
 * Exports all HTTP route handlers and documents the entire backend API surface in one location.
 */

export * from "./auth.routes";
export * from "./ticket.routes";
export * from "./reply.routes";
export * from "./collaboration.routes";
export * from "./sla.routes";
export * from "./csat.routes";
export * from "./bulk.routes";
export * from "./export.routes";
export * from "./dashboard.routes";
export * from "./user.routes";
export * from "./agent.routes";
export * from "./reviews.routes";
export * from "./health.routes";
export * from "./recommendation.routes";
export * from "./tag.routes";
export * from "./digest.routes";

/**
 * Overview of all system routes, methods, access requirements, and descriptions.
 */
export const API_ROUTE_REGISTRY = [
  // Health & System
  { method: "GET", path: "/api/health", handler: "getHealthRoute", authRequired: false, desc: "System and database connectivity health check" },

  // Authentication
  { method: "POST", path: "/api/auth/login", handler: "loginRoute", authRequired: false, desc: "User login with session cookie creation" },
  { method: "POST", path: "/api/auth/logout", handler: "logoutRoute", authRequired: false, desc: "User logout and clear session cookie" },
  { method: "GET", path: "/api/auth/me", handler: "meRoute", authRequired: true, desc: "Retrieve current authenticated user session" },
  { method: "POST", path: "/api/auth/register", handler: "registerRoute", authRequired: false, desc: "Register a new user account" },

  // Tickets
  { method: "GET", path: "/api/tickets", handler: "getTicketsRoute", authRequired: true, desc: "Retrieve filtered & paginated ticket queue" },
  { method: "POST", path: "/api/tickets", handler: "createTicketRoute", authRequired: true, desc: "Create a new support ticket" },
  { method: "GET", path: "/api/tickets/[id]", handler: "getTicketByIdRoute", authRequired: true, desc: "Get full ticket details and unified activity timeline" },
  { method: "PATCH", path: "/api/tickets/[id]", handler: "updateTicketRoute", authRequired: true, desc: "Update ticket metadata (subject, description, priority, category)" },
  { method: "POST", path: "/api/tickets/[id]/status", handler: "changeTicketStatusRoute", authRequired: true, desc: "Execute state-machine status transition" },
  { method: "POST", path: "/api/tickets/[id]/reassign", handler: "reassignTicketRoute", authRequired: true, desc: "Reassign ticket primary assignee" },
  { method: "POST", path: "/api/tickets/[id]/archive", handler: "archiveTicketRoute", authRequired: true, desc: "Archive a closed/resolved ticket" },
  { method: "POST", path: "/api/tickets/[id]/restore", handler: "restoreTicketRoute", authRequired: true, desc: "Restore an archived ticket" },

  // Replies & Conversation
  { method: "POST", path: "/api/tickets/[id]/replies", handler: "addAgentReplyRoute", authRequired: true, desc: "Post an agent public reply or internal note" },
  { method: "POST", path: "/api/tickets/[id]/customer-reply", handler: "addCustomerReplyRoute", authRequired: false, desc: "Simulate or receive customer response" },

  // Collaboration
  { method: "POST", path: "/api/tickets/[id]/collaborators", handler: "addCollaboratorRoute", authRequired: true, desc: "Add a secondary collaborator agent" },
  { method: "DELETE", path: "/api/tickets/[id]/collaborators", handler: "removeCollaboratorRoute", authRequired: true, desc: "Remove a collaborator agent" },

  // SLA & Alerts
  { method: "GET", path: "/api/sla/alerts", handler: "getSlaAlertsRoute", authRequired: true, desc: "Fetch active SLA breach & warning alerts" },
  { method: "POST", path: "/api/tickets/[id]/acknowledge-alert", handler: "acknowledgeAlertRoute", authRequired: true, desc: "Acknowledge an SLA warning/breach alert" },

  // CSAT
  { method: "POST", path: "/api/tickets/[id]/csat", handler: "submitCsatRoute", authRequired: true, desc: "Submit customer satisfaction rating and comment" },

  // AI & Semantic Knowledge Recommendations (Smart Assist)
  { method: "GET", path: "/api/tickets/[id]/recommendations", handler: "getTicketRecommendationsRoute", authRequired: true, desc: "Retrieve semantic resolution recommendations for an active ticket" },
  { method: "GET", path: "/api/kb/search", handler: "searchKnowledgeBaseRoute", authRequired: true, desc: "Search Knowledge Base articles" },
  { method: "POST", path: "/api/recommendations/feedback", handler: "logRecommendationFeedbackRoute", authRequired: true, desc: "Log agent telemetry feedback on recommended solutions" },

  // Bulk & Export & Metrics
  { method: "POST", path: "/api/tickets/bulk", handler: "bulkActionRoute", authRequired: true, desc: "Execute bulk reassignment or bulk close" },
  { method: "GET", path: "/api/tickets/export", handler: "exportTicketsRoute", authRequired: true, desc: "Export filtered tickets to CSV" },
  { method: "GET", path: "/api/dashboard", handler: "getDashboardRoute", authRequired: true, desc: "Retrieve operational dashboard metrics" },

  // Users & Staff
  { method: "GET", path: "/api/users", handler: "getUsersRoute", authRequired: true, desc: "List all users for assignment and collaboration" },
  { method: "GET", path: "/api/agents", handler: "getTeamDirectoryRoute", authRequired: true, desc: "Retrieve internal staff team directory with workload metrics" },
  { method: "POST", path: "/api/agents/invite", handler: "inviteAgentRoute", authRequired: true, desc: "Supervisor invites a new agent with 24-hour one-time token" },
  { method: "POST", path: "/api/agents/[id]/resend-invite", handler: "resendInviteRoute", authRequired: true, desc: "Supervisor resends invitation with freshly rotated token" },
  { method: "PATCH", path: "/api/agents/[id]", handler: "updateAgentRoute", authRequired: true, desc: "Supervisor updates agent role (Supervisor <-> Agent), suspends/reactivates account, and reassigns tickets" },
  { method: "DELETE", path: "/api/agents/[id]", handler: "cancelAgentInvitationRoute", authRequired: true, desc: "Supervisor cancels pending agent invitation" },
  { method: "GET", path: "/api/auth/invitation", handler: "validateInvitationRoute", authRequired: false, desc: "Validate one-time invitation token without consuming it" },
  { method: "POST", path: "/api/auth/setup-account", handler: "setupAccountRoute", authRequired: false, desc: "Consume invitation token, set password, and sign in" },

  // Reviews & Performance
  { method: "GET", path: "/api/reviews", handler: "getAllReviewsRoute", authRequired: true, desc: "Fetch all customer satisfaction reviews and filters" },
  { method: "GET", path: "/api/reviews/agents", handler: "getAgentPerformanceRoute", authRequired: true, desc: "Retrieve agent CSAT scorecards with sorting" },

  // Tags & Tag Groups
  { method: "GET", path: "/api/tag-groups", handler: "listTagGroupsRoute", authRequired: true, desc: "List all tag groups with tags" },
  { method: "POST", path: "/api/tag-groups", handler: "createTagGroupRoute", authRequired: true, desc: "Create new tag group (Supervisor only)" },
  { method: "GET", path: "/api/tag-groups/[id]", handler: "getTagGroupByIdRoute", authRequired: true, desc: "Get tag group by ID" },
  { method: "PATCH", path: "/api/tag-groups/[id]", handler: "updateTagGroupRoute", authRequired: true, desc: "Update tag group (Supervisor only)" },
  { method: "DELETE", path: "/api/tag-groups/[id]", handler: "deleteTagGroupRoute", authRequired: true, desc: "Delete tag group (Supervisor only)" },
  { method: "GET", path: "/api/tags", handler: "listTagsRoute", authRequired: true, desc: "List tags filtered by group or search" },
  { method: "POST", path: "/api/tags", handler: "createTagRoute", authRequired: true, desc: "Create a tag" },
  { method: "GET", path: "/api/tags/search", handler: "searchTagsRoute", authRequired: true, desc: "Typeahead autocomplete tag search" },
  { method: "GET", path: "/api/tags/[id]", handler: "getTagByIdRoute", authRequired: true, desc: "Get tag by ID" },
  { method: "PATCH", path: "/api/tags/[id]", handler: "updateTagRoute", authRequired: true, desc: "Update tag (Supervisor only)" },
  { method: "DELETE", path: "/api/tags/[id]", handler: "deleteTagRoute", authRequired: true, desc: "Delete tag (Supervisor only)" },
  { method: "POST", path: "/api/tags/[id]/merge", handler: "mergeTagsRoute", authRequired: true, desc: "Merge source tag into target (Supervisor only)" },
  { method: "GET", path: "/api/tickets/[id]/tags", handler: "getTicketTagsRoute", authRequired: true, desc: "Get tags applied to a ticket" },
  { method: "POST", path: "/api/tickets/[id]/tags", handler: "addTicketTagsRoute", authRequired: true, desc: "Add tags to a ticket" },
  { method: "DELETE", path: "/api/tickets/[id]/tags/[tagId]", handler: "removeTicketTagRoute", authRequired: true, desc: "Remove a tag from a ticket" },

  // Email Queue Digests & Cron
  { method: "GET", path: "/api/digest/preferences", handler: "getDigestPreferencesRoute", authRequired: true, desc: "Get current user email digest preferences" },
  { method: "PATCH", path: "/api/digest/preferences", handler: "updateDigestPreferencesRoute", authRequired: true, desc: "Update user email digest preferences (enabled, frequency)" },
  { method: "GET", path: "/api/digest/preview", handler: "previewDigestRoute", authRequired: true, desc: "Generate live HTML preview of Agent or Supervisor digest" },
  { method: "POST", path: "/api/cron/digest", handler: "triggerCronDigestRoute", authRequired: false, desc: "Scheduled Vercel Cron trigger for daily/weekly digest dispatch" },
] as const;
