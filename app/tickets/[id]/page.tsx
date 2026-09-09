"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Role, Priority, Category, Status, AuthorType, AuditEventType } from "@prisma/client";
import { SessionUser, TicketPermissions, TimelineItem } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge, CategoryBadge } from "@/components/PriorityBadge";
import { SlaCountdown } from "@/components/SlaCountdown";
import { SimulateCustomerReplyModal } from "@/components/SimulateCustomerReplyModal";
import {
  ArrowLeft,
  Clock,
  Send,
  Lock,
  MessageSquare,
  Users,
  UserPlus,
  Shield,
  AlertTriangle,
  CheckCircle,
  Archive,
  RotateCcw,
  Sparkles,
  HelpCircle,
  AlertCircle,
  History,
  Tag,
  UserCheck,
} from "lucide-react";

export default function TicketWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [user, setUser] = useState<SessionUser | null>(null);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [ticketData, setTicketData] = useState<any | null>(null);
  const [permissions, setPermissions] = useState<TicketPermissions | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reply Composer State
  const [replyBody, setReplyBody] = useState<string>("");
  const [isInternal, setIsInternal] = useState<boolean>(false);
  const [submittingReply, setSubmittingReply] = useState<boolean>(false);

  // Modals & Popovers
  const [simulateModalOpen, setSimulateModalOpen] = useState<boolean>(false);
  const [addCollabUserId, setAddCollabUserId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Load Ticket Workspace Data
  const loadTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load ticket.");
      }
      const data = await res.json();
      setTicketData(data.ticket);
      setPermissions(data.permissions);
      setTimeline(data.timeline);
    } catch (err: any) {
      setError(err.message || "Failed to load ticket.");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((d) => setUser(d.user));

    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((d) => setAgents(d.users || []));

    loadTicket();
  }, [loadTicket]);

  // Submit Agent Reply / Internal Note
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody.trim(), isInternal }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit reply.");
      }

      setReplyBody("");
      loadTicket();
    } catch (err: any) {
      alert(err.message || "Failed to submit reply.");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Status Change Transition
  const handleStatusChange = async (targetStatus: Status) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Status change failed.");
      }

      loadTicket();
    } catch (err: any) {
      alert(err.message || "Status change failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reassign Primary Assignee
  const handleReassign = async (newAssigneeId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryAssigneeId: newAssigneeId || null }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Reassignment failed.");
      }

      loadTicket();
    } catch (err: any) {
      alert(err.message || "Reassignment failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Add Collaborator
  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCollabUserId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addCollabUserId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add collaborator.");
      }

      setAddCollabUserId("");
      loadTicket();
    } catch (err: any) {
      alert(err.message || "Failed to add collaborator.");
    } finally {
      setActionLoading(false);
    }
  };

  // Remove Collaborator
  const handleRemoveCollaborator = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this collaborator?")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/collaborators?userId=${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove collaborator.");
      }

      loadTicket();
    } catch (err: any) {
      alert(err.message || "Failed to remove collaborator.");
    } finally {
      setActionLoading(false);
    }
  };

  // Archive / Restore
  const handleToggleArchive = async () => {
    const isArchived = Boolean(ticketData?.archivedAt);
    const endpoint = isArchived ? `/api/tickets/${ticketId}/restore` : `/api/tickets/${ticketId}/archive`;

    setActionLoading(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Archive operation failed.");
      }
      loadTicket();
    } catch (err: any) {
      alert(err.message || "Archive operation failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Acknowledge SLA Alert
  const handleAcknowledgeAlert = async (alertId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/acknowledge-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to acknowledge SLA alert.");
      }

      loadTicket();
    } catch (err: any) {
      alert(err.message || "Failed to acknowledge SLA alert.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-400">Loading ticket workspace...</div>;
  }

  if (error || !ticketData) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Unable to access ticket</h2>
        <p className="text-sm text-slate-600 mt-1">{error || "Ticket not found or permission denied."}</p>
        <button
          onClick={() => router.push("/tickets")}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg"
        >
          Return to Queue
        </button>
      </div>
    );
  }

  const activeAlert = ticketData.slaAlerts?.find(
    (a: any) => a.status === "ACTIVE" && a.breachCycle === ticketData.slaCycle
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/tickets")}
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg text-indigo-600">
                #{ticketData.ticketNumber}
              </span>
              <StatusBadge status={ticketData.status} />
              <PriorityBadge priority={ticketData.priority} />
              <CategoryBadge category={ticketData.category} />
              {ticketData.archivedAt && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                  Archived
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{ticketData.subject}</h1>
          </div>
        </div>

        {/* Top Right Quick Triggers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSimulateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Customer Reply</span>
          </button>

          {permissions?.canArchive && (
            <button
              onClick={handleToggleArchive}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Archive className="w-3.5 h-3.5 text-slate-500" />
              <span>{ticketData.archivedAt ? "Restore Ticket" : "Archive"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Conversation & Immutable Activity Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Initial Ticket Description Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                  {ticketData.requesterName.charAt(0)}
                </div>
                <div>
                  <span className="font-semibold text-xs text-slate-900">{ticketData.requesterName}</span>
                  <span className="text-[11px] text-slate-500 ml-1.5">&lt;{ticketData.requesterEmail}&gt;</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                Created {new Date(ticketData.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {ticketData.description}
            </div>
          </div>

          {/* Unified Chronological Timeline Feed */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Activity & Conversation History</span>
            </div>

            {timeline.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                No replies or activity events recorded yet.
              </div>
            ) : (
              timeline.map((item) => {
                if (item.type === "REPLY" && item.reply) {
                  const isInternalNote = item.reply.isInternal;
                  const isCustomer = item.reply.authorType === AuthorType.CUSTOMER;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition ${
                        isInternalNote
                          ? "bg-amber-50/80 border-amber-300 shadow-sm"
                          : isCustomer
                          ? "bg-white border-slate-200 shadow-sm"
                          : "bg-indigo-50/60 border-indigo-200 shadow-sm"
                      }`}
                    >
                      {/* Reply Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-black/5 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isInternalNote
                                ? "bg-amber-200 text-amber-800"
                                : isCustomer
                                ? "bg-slate-200 text-slate-700"
                                : "bg-indigo-200 text-indigo-800"
                            }`}
                          >
                            {item.reply.authorName.charAt(0)}
                          </span>
                          <span className="font-semibold text-xs text-slate-900">
                            {item.reply.authorName}
                          </span>
                          {isInternalNote ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded-full">
                              <Lock className="w-3 h-3" />
                              Internal Note (Team Only)
                            </span>
                          ) : isCustomer ? (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              Customer Reply
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                              Public Agent Reply
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {/* Reply Body */}
                      <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {item.reply.body}
                      </div>
                    </div>
                  );
                }

                if (item.type === "AUDIT" && item.audit) {
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-1.5 text-xs text-slate-500 bg-slate-100/70 rounded-lg border border-slate-200/70"
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-700">{item.audit.actorName}</span>
                      <span className="text-slate-500">
                        {item.audit.eventType === AuditEventType.STATUS_CHANGED && (
                          <span>
                            changed status from{" "}
                            <strong className="text-slate-700">{item.audit.oldValue?.status}</strong> to{" "}
                            <strong className="text-indigo-600">{item.audit.newValue?.status}</strong>
                          </span>
                        )}
                        {item.audit.eventType === AuditEventType.REASSIGNED && (
                          <span>
                            reassigned primary owner to{" "}
                            <strong className="text-indigo-600">{item.audit.newValue?.assigneeName || "Unassigned"}</strong>
                          </span>
                        )}
                        {item.audit.eventType === AuditEventType.COLLABORATOR_ADDED && (
                          <span>
                            added collaborator <strong className="text-slate-700">{item.audit.newValue?.userName}</strong>
                          </span>
                        )}
                        {item.audit.eventType === AuditEventType.COLLABORATOR_REMOVED && (
                          <span>
                            removed collaborator <strong className="text-slate-700">{item.audit.oldValue?.userName}</strong>
                          </span>
                        )}
                        {item.audit.eventType === AuditEventType.TICKET_CREATED && (
                          <span>created this ticket</span>
                        )}
                        {item.audit.eventType === AuditEventType.TICKET_EDITED && (
                          <span>edited ticket details</span>
                        )}
                        {item.audit.eventType === AuditEventType.TICKET_ARCHIVED && (
                          <span>archived this ticket</span>
                        )}
                        {item.audit.eventType === AuditEventType.TICKET_RESTORED && (
                          <span>restored this ticket</span>
                        )}
                        {item.audit.eventType === AuditEventType.REPLY_ADDED && (
                          <span>posted a {item.audit.metadata?.isInternal ? "internal note" : "reply"}</span>
                        )}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-400">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                }

                return null;
              })
            )}
          </div>

          {/* Reply Composer Form */}
          {permissions?.canReply && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              {/* Tab Selector: Public Reply vs Internal Note */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setIsInternal(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    !isInternal
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Public Reply to Customer</span>
                </button>

                {permissions.canAddInternalNote && (
                  <button
                    type="button"
                    onClick={() => setIsInternal(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isInternal
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Internal Note (Team Only)</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleSendReply} className="space-y-3">
                <textarea
                  rows={4}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={
                    isInternal
                      ? "Type an internal note visible only to support agents and supervisors..."
                      : "Type your customer-visible response..."
                  }
                  className={`w-full text-xs p-3 rounded-lg border outline-none focus:ring-2 ${
                    isInternal
                      ? "bg-amber-50/50 border-amber-300 focus:ring-amber-500"
                      : "bg-white border-slate-300 focus:ring-indigo-500"
                  }`}
                  required
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {isInternal
                      ? "Note: Internal notes will NOT trigger customer notifications or SLA resumption."
                      : "Replying to customer will move NEW tickets to OPEN."}
                  </span>

                  <button
                    type="submit"
                    disabled={submittingReply || !replyBody.trim()}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50 ${
                      isInternal
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingReply ? "Submitting..." : isInternal ? "Post Internal Note" : "Send Customer Reply"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Metadata, SLA, Assignment, and Lifecycle Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* SLA Status Widget */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Response SLA Target</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Cycle #{ticketData.slaCycle}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
              <div className="text-xs text-slate-500">Live SLA Response Countdown:</div>
              <div>
                <SlaCountdown
                  slaDueAt={ticketData.slaDueAt}
                  status={ticketData.status}
                  slaPausedRemainingSeconds={ticketData.slaPausedRemainingSeconds}
                  size="md"
                />
              </div>

              {ticketData.slaDueAt && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  Target Deadline: <span className="font-semibold text-slate-700">{new Date(ticketData.slaDueAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Acknowledge SLA Alert Button */}
            {activeAlert && permissions?.canAcknowledgeAlert && (
              <button
                onClick={() => handleAcknowledgeAlert(activeAlert.id)}
                disabled={actionLoading}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Acknowledge SLA Breach Alert</span>
              </button>
            )}
          </div>

          {/* Lifecycle Action Buttons */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Lifecycle Stage Transitions
            </span>

            <div className="space-y-2">
              {/* NEW -> OPEN */}
              {ticketData.status === Status.NEW && (
                <button
                  onClick={() => handleStatusChange(Status.OPEN)}
                  disabled={actionLoading}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Start Working (Move to Open)
                </button>
              )}

              {/* OPEN -> PENDING */}
              {ticketData.status === Status.OPEN && (
                <button
                  onClick={() => handleStatusChange(Status.PENDING)}
                  disabled={actionLoading}
                  className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Pause SLA Clock (Mark Pending on Customer)
                </button>
              )}

              {/* PENDING -> OPEN */}
              {ticketData.status === Status.PENDING && (
                <button
                  onClick={() => handleStatusChange(Status.OPEN)}
                  disabled={actionLoading}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Resume SLA Clock (Return to Open)
                </button>
              )}

              {/* OPEN/PENDING -> RESOLVED */}
              {(ticketData.status === Status.OPEN || ticketData.status === Status.PENDING) && (
                <button
                  onClick={() => handleStatusChange(Status.RESOLVED)}
                  disabled={actionLoading}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Mark as Resolved
                </button>
              )}

              {/* RESOLVED -> OPEN */}
              {ticketData.status === Status.RESOLVED && (
                <button
                  onClick={() => handleStatusChange(Status.OPEN)}
                  disabled={actionLoading}
                  className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Reopen Ticket (Move to Open)
                </button>
              )}

              {/* RESOLVED -> CLOSED (Supervisor Only) */}
              {ticketData.status === Status.RESOLVED && (
                <button
                  onClick={() => handleStatusChange(Status.CLOSED)}
                  disabled={actionLoading || !permissions?.canClose}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  {permissions?.canClose ? "Permanently Close Ticket (Supervisor)" : "Close Ticket (Supervisor Only)"}
                </button>
              )}

              {/* CLOSED -> OPEN (Supervisor Only, within 7 days) */}
              {ticketData.status === Status.CLOSED && (
                <div>
                  <button
                    onClick={() => handleStatusChange(Status.OPEN)}
                    disabled={actionLoading || !permissions?.canReopen}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    {permissions?.canReopen ? "Reopen Closed Ticket (Supervisor)" : "Reopen Expired (Closed > 7 days)"}
                  </button>
                  {!permissions?.canReopen && (
                    <p className="text-[11px] text-rose-600 mt-1.5">
                      This ticket cannot be reopened: the 7-day reopen window has expired.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Primary Assignee Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Primary Assignee
            </span>

            {permissions?.canReassign ? (
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Reassign to Agent (Supervisor)</label>
                <select
                  value={ticketData.primaryAssigneeId || ""}
                  onChange={(e) => handleReassign(e.target.value)}
                  disabled={actionLoading}
                  className="w-full text-xs py-2 px-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-slate-900">
                  {ticketData.primaryAssignee?.name || "Unassigned"}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto">(Agent cannot reassign)</span>
              </div>
            )}
          </div>

          {/* Collaborators Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Collaborator Agents</span>
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {ticketData.collaborators?.length || 0}
              </span>
            </div>

            <div className="space-y-1.5">
              {ticketData.collaborators?.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No secondary collaborators added.</div>
              ) : (
                ticketData.collaborators.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <span className="font-medium text-slate-800">{c.user.name}</span>
                    {permissions?.canManageCollaborators && (
                      <button
                        onClick={() => handleRemoveCollaborator(c.userId)}
                        className="text-slate-400 hover:text-rose-600 text-[10px] font-bold underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add Collaborator Picker */}
            {permissions?.canManageCollaborators && (
              <form onSubmit={handleAddCollaborator} className="pt-2 border-t border-slate-100 flex gap-2">
                <select
                  value={addCollabUserId}
                  onChange={(e) => setAddCollabUserId(e.target.value)}
                  className="flex-1 text-xs py-1.5 px-2 border border-slate-300 rounded-lg bg-white text-slate-700 outline-none"
                >
                  <option value="">+ Select Agent to Add...</option>
                  {agents
                    .filter(
                      (a) =>
                        a.id !== ticketData.primaryAssigneeId &&
                        !ticketData.collaborators?.some((c: any) => c.userId === a.id)
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  disabled={!addCollabUserId || actionLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                >
                  Add
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Simulate Customer Reply Modal */}
      <SimulateCustomerReplyModal
        isOpen={simulateModalOpen}
        onClose={() => setSimulateModalOpen(false)}
        ticketId={ticketId}
        requesterName={ticketData.requesterName}
        requesterEmail={ticketData.requesterEmail}
        onSuccess={loadTicket}
      />
    </div>
  );
}
