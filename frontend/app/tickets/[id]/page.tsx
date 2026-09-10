"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Priority, Category, Status, SessionUser, TicketPermissions, TimelineItem } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge, CategoryBadge } from "@/components/PriorityBadge";
import { SlaCountdown } from "@/components/SlaCountdown";
import { SimulateCustomerReplyModal } from "@/components/SimulateCustomerReplyModal";
import { AddCollaboratorModal } from "@/components/AddCollaboratorModal";
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
  User,
  Paperclip,
  Smile,
  Copy,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
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

  // Active Tab: Conversation, Details, Collaborators, History
  const [activeTab, setActiveTab] = useState<"conversation" | "details" | "collaborators" | "history">("conversation");

  // Reply Composer State
  const [replyBody, setReplyBody] = useState<string>("");
  const [isInternal, setIsInternal] = useState<boolean>(false);
  const [submittingReply, setSubmittingReply] = useState<boolean>(false);

  // Modals & Popovers
  const [simulateModalOpen, setSimulateModalOpen] = useState<boolean>(false);
  const [addCollabModalOpen, setAddCollabModalOpen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

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

  // Remove Collaborator
  const handleRemoveCollaborator = async (userId: string) => {
    if (!confirm("Remove this collaborator from the ticket?")) return;

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

  const copyEmailToClipboard = () => {
    if (ticketData?.requesterEmail) {
      navigator.clipboard.writeText(ticketData.requesterEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  if (loading) {
    return <div className="text-center py-24 text-slate-400 text-xs">Loading ticket workspace...</div>;
  }

  if (error || !ticketData) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Unable to access ticket</h2>
        <p className="text-xs text-slate-500 mt-1">{error || "Ticket not found or permission denied."}</p>
        <button
          onClick={() => router.push("/tickets")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm"
        >
          Return to Queue
        </button>
      </div>
    );
  }

  const activeAlert = ticketData.slaAlerts?.find(
    (a: any) => a.status === "ACTIVE" && a.breachCycle === ticketData.slaCycle
  );

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const collaboratorList = ticketData.collaborators || [];
  const collaboratorIds = collaboratorList.map((c: any) => c.userId);

  return (
    <div className="space-y-4 pb-16 animate-fade-in">
      {/* Breadcrumb Navigation & Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/tickets")}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            title="Back to Tickets Queue"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Tickets</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono font-bold text-slate-900">#{ticketData.ticketNumber}</span>
              <StatusBadge status={ticketData.status} size="sm" />
              <PriorityBadge priority={ticketData.priority} />
            </div>
            <h1 className="text-lg font-bold text-slate-900 truncate mt-0.5">{ticketData.subject}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Created {new Date(ticketData.createdAt).toLocaleDateString()} by {ticketData.requesterName} • Updated{" "}
              {new Date(ticketData.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setSimulateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Customer Reply</span>
          </button>

          {permissions?.canManageCollaborators && (
            <button
              onClick={() => setAddCollabModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>Add Collaborators</span>
            </button>
          )}

          {ticketData.status === "RESOLVED" && permissions?.canClose && (
            <button
              onClick={() => handleStatusChange("CLOSED")}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <span>Close Ticket</span>
            </button>
          )}

          {permissions?.canArchive && (
            <button
              onClick={handleToggleArchive}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-medium transition"
              title={ticketData.archivedAt ? "Restore Ticket" : "Archive Ticket"}
            >
              <Archive className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* 3-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Conversation & Activity Stream */}
        <div className="lg:col-span-8 space-y-4">
          {/* Navigation Tabs (Conversation | Details | Collaborators | History) */}
          <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("conversation")}
              className={`pb-2.5 transition border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === "conversation"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Conversation</span>
            </button>

            <button
              onClick={() => setActiveTab("details")}
              className={`pb-2.5 transition border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === "details"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>

            <button
              onClick={() => setActiveTab("collaborators")}
              className={`pb-2.5 transition border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === "collaborators"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Collaborators ({collaboratorList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2.5 transition border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit History</span>
            </button>
          </div>

          {/* TAB 1: CONVERSATION */}
          {activeTab === "conversation" && (
            <div className="space-y-4">
              {/* Initial Customer Ticket Body */}
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                      {getInitials(ticketData.requesterName)}
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-slate-900">{ticketData.requesterName}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">(Customer)</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(ticketData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {ticketData.description}
                </div>
              </div>

              {/* Timeline Messages & Events */}
              <div className="space-y-3">
                {timeline.map((item) => {
                  if (item.type === "REPLY" && item.reply) {
                    const isNote = item.reply.isInternal;
                    const isCustomer = item.reply.authorType === "CUSTOMER";

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition ${
                          isNote
                            ? "internal-note-box shadow-xs"
                            : isCustomer
                            ? "bg-white border-slate-200/90 shadow-2xs"
                            : "bg-blue-50/50 border-blue-200/80 shadow-2xs"
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-black/5 mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xs ${
                                isNote ? "bg-amber-600" : isCustomer ? "bg-slate-600" : "bg-blue-600"
                              }`}
                            >
                              {getInitials(item.reply.authorName)}
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-slate-900">
                                {item.reply.authorName}
                              </span>
                              <span className="text-[11px] text-slate-500 ml-1">
                                {isNote ? "(Internal Note)" : isCustomer ? "(Customer)" : "(Agent)"}
                              </span>
                            </div>
                            {isNote && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full ml-1">
                                <Lock className="w-2.5 h-2.5" /> Team Note
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Body */}
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
                        className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-slate-500 bg-slate-50 rounded-lg border border-slate-200/60"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="font-semibold text-slate-700">{item.audit.actorName}</span>
                        <span className="text-slate-500 truncate">
                          {item.audit.eventType === "STATUS_CHANGED" && (
                            <span>
                              changed status from <strong>{item.audit.oldValue?.status}</strong> to{" "}
                              <strong className="text-blue-600">{item.audit.newValue?.status}</strong>
                            </span>
                          )}
                          {item.audit.eventType === "REASSIGNED" && (
                            <span>
                              reassigned ticket to{" "}
                              <strong className="text-blue-600">{item.audit.newValue?.assigneeName || "Unassigned"}</strong>
                            </span>
                          )}
                          {item.audit.eventType === "COLLABORATOR_ADDED" && (
                            <span>added collaborator {item.audit.newValue?.userName}</span>
                          )}
                          {item.audit.eventType === "COLLABORATOR_REMOVED" && (
                            <span>removed collaborator {item.audit.oldValue?.userName}</span>
                          )}
                          {item.audit.eventType === "TICKET_CREATED" && <span>created ticket</span>}
                          {item.audit.eventType === "REPLY_ADDED" && (
                            <span>posted a {item.audit.metadata?.isInternal ? "team note" : "customer reply"}</span>
                          )}
                        </span>
                        <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>

              {/* Reply Composer Box */}
              {permissions?.canReply && (
                <div
                  className={`p-4 rounded-xl border transition shadow-2xs ${
                    isInternal ? "internal-note-box" : "bg-white border-slate-200/90"
                  }`}
                >
                  {/* Segmented Composer Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsInternal(false)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                          !isInternal
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        Public Reply
                      </button>

                      {permissions.canAddInternalNote && (
                        <button
                          type="button"
                          onClick={() => setIsInternal(true)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                            isInternal
                              ? "bg-amber-600 text-white shadow-2xs"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Lock className="w-3 h-3" />
                          <span>Internal Note</span>
                        </button>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400">
                      {isInternal ? "Visible only to team agents" : "Visible to customer"}
                    </span>
                  </div>

                  <form onSubmit={handleSendReply} className="mt-3 space-y-3">
                    <textarea
                      rows={3}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder={
                        isInternal
                          ? "Type internal note for team collaboration..."
                          : "Type your public reply to the customer..."
                      }
                      className="w-full text-xs p-3 bg-transparent border-0 outline-none resize-y placeholder-slate-400 text-slate-800"
                      required
                    />

                    <div className="flex items-center justify-between pt-2 border-t border-black/5">
                      <div className="flex items-center gap-2 text-slate-400">
                        <button type="button" className="p-1 hover:text-slate-600 rounded">
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1 hover:text-slate-600 rounded">
                          <Smile className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingReply || !replyBody.trim()}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 ${
                          isInternal
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submittingReply ? "Posting..." : isInternal ? "Add Note" : "Send Reply"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DETAILS */}
          {activeTab === "details" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Ticket Specifications</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Ticket Number</span>
                  <span className="font-mono font-bold text-slate-900">#{ticketData.ticketNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Category</span>
                  <CategoryBadge category={ticketData.category} />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Priority</span>
                  <PriorityBadge priority={ticketData.priority} />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Current Status</span>
                  <StatusBadge status={ticketData.status} />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Created At</span>
                  <span className="text-slate-800">{new Date(ticketData.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Last Updated</span>
                  <span className="text-slate-800">{new Date(ticketData.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COLLABORATORS */}
          {activeTab === "collaborators" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ticket Collaborators</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Team members who can view, reply, and add internal notes to this ticket.
                  </p>
                </div>
                {permissions?.canManageCollaborators && (
                  <button
                    onClick={() => setAddCollabModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                  >
                    + Add Collaborator
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {/* Primary Assignee */}
                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                      {ticketData.primaryAssignee ? getInitials(ticketData.primaryAssignee.name) : "U"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {ticketData.primaryAssignee?.name || "Unassigned"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {ticketData.primaryAssignee?.email || "No assignee"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Primary Assignee
                  </span>
                </div>

                {/* Secondary Collaborators */}
                {collaboratorList.map((c: any) => (
                  <div key={c.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center">
                        {getInitials(c.user.name)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{c.user.name}</p>
                        <p className="text-[11px] text-slate-500">{c.user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Collaborator
                      </span>
                      {permissions?.canManageCollaborators && (
                        <button
                          onClick={() => handleRemoveCollaborator(c.userId)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: HISTORY (AUDIT LOGS) */}
          {activeTab === "history" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Immutable Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Append-only ledger recording all state changes, reassignments, and replies.
              </p>

              <div className="divide-y divide-slate-100 mt-4">
                {timeline
                  .filter((t) => t.type === "AUDIT" && t.audit)
                  .map((item) => (
                    <div key={item.id} className="py-3 flex items-start justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-900">{item.audit?.actorName}</p>
                        <p className="text-slate-600 mt-0.5">
                          {item.audit?.eventType === "STATUS_CHANGED" &&
                            `Changed status from ${item.audit.oldValue?.status} to ${item.audit.newValue?.status}`}
                          {item.audit?.eventType === "REASSIGNED" &&
                            `Reassigned ticket to ${item.audit.newValue?.assigneeName || "Unassigned"}`}
                          {item.audit?.eventType === "COLLABORATOR_ADDED" &&
                            `Added collaborator ${item.audit.newValue?.userName}`}
                          {item.audit?.eventType === "COLLABORATOR_REMOVED" &&
                            `Removed collaborator ${item.audit.oldValue?.userName}`}
                          {item.audit?.eventType === "TICKET_CREATED" && "Ticket created"}
                          {item.audit?.eventType === "REPLY_ADDED" && "Posted a reply or internal note"}
                          {item.audit?.eventType === "TICKET_ARCHIVED" && "Archived ticket"}
                          {item.audit?.eventType === "TICKET_RESTORED" && "Restored ticket"}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Columns: Ticket Information & Quick Actions Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Ticket Information Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Ticket Information
            </h3>

            {/* Requester */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Requester</span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                    {getInitials(ticketData.requesterName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{ticketData.requesterName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{ticketData.requesterEmail}</p>
                  </div>
                </div>
                <button
                  onClick={copyEmailToClipboard}
                  title="Copy email"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Priority & Category */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Priority</span>
                <PriorityBadge priority={ticketData.priority} />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Category</span>
                <CategoryBadge category={ticketData.category} />
              </div>
            </div>

            {/* Status */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 block mb-1">Status</span>
              <StatusBadge status={ticketData.status} />
            </div>

            {/* Primary Assignee */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-slate-400">Primary Assignee</span>
                {permissions?.canReassign && (
                  <span className="text-[10px] text-blue-600 font-semibold">(Supervisor Reassign)</span>
                )}
              </div>

              {permissions?.canReassign ? (
                <select
                  value={ticketData.primaryAssigneeId || ""}
                  onChange={(e) => handleReassign(e.target.value)}
                  disabled={actionLoading}
                  className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                    {ticketData.primaryAssignee ? getInitials(ticketData.primaryAssignee.name) : "U"}
                  </div>
                  <span className="font-semibold text-slate-800">
                    {ticketData.primaryAssignee?.name || "Unassigned"}
                  </span>
                </div>
              )}
            </div>

            {/* Collaborators Overlapping Avatars */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-400">Collaborators</span>
                {permissions?.canManageCollaborators && (
                  <button
                    onClick={() => setAddCollabModalOpen(true)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Add
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {collaboratorList.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No secondary collaborators</span>
                ) : (
                  collaboratorList.map((c: any) => (
                    <div
                      key={c.id}
                      title={c.user.name}
                      className="w-7 h-7 rounded-full bg-slate-700 text-white font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-2xs"
                    >
                      {getInitials(c.user.name)}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SLA Clock Widget */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-[11px] text-slate-400 block">SLA Response Countdown</span>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <SlaCountdown
                  slaDueAt={ticketData.slaDueAt}
                  status={ticketData.status}
                  slaPausedRemainingSeconds={ticketData.slaPausedRemainingSeconds}
                  size="md"
                />
              </div>
              {activeAlert && permissions?.canAcknowledgeAlert && (
                <button
                  onClick={() => handleAcknowledgeAlert(activeAlert.id)}
                  disabled={actionLoading}
                  className="w-full mt-2 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Acknowledge SLA Alert</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Lifecycle State Controls
            </h3>

            <div className="space-y-2">
              {ticketData.status === "NEW" && (
                <button
                  onClick={() => handleStatusChange("OPEN")}
                  disabled={actionLoading}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Move to Open
                </button>
              )}

              {ticketData.status === "OPEN" && (
                <>
                  <button
                    onClick={() => handleStatusChange("PENDING")}
                    disabled={actionLoading}
                    className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    Pause SLA (Mark Pending on Customer)
                  </button>
                  <button
                    onClick={() => handleStatusChange("RESOLVED")}
                    disabled={actionLoading}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    Mark as Resolved
                  </button>
                </>
              )}

              {ticketData.status === "PENDING" && (
                <>
                  <button
                    onClick={() => handleStatusChange("OPEN")}
                    disabled={actionLoading}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    Resume SLA (Move to Open)
                  </button>
                  <button
                    onClick={() => handleStatusChange("RESOLVED")}
                    disabled={actionLoading}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    Mark as Resolved
                  </button>
                </>
              )}

              {ticketData.status === "RESOLVED" && (
                <>
                  <button
                    onClick={() => handleStatusChange("OPEN")}
                    disabled={actionLoading}
                    className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    Reopen Ticket
                  </button>
                  {permissions?.canClose && (
                    <button
                      onClick={() => handleStatusChange("CLOSED")}
                      disabled={actionLoading}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      Close Ticket (Supervisor)
                    </button>
                  )}
                </>
              )}

              {ticketData.status === "CLOSED" && (
                <div>
                  <button
                    onClick={() => handleStatusChange("OPEN")}
                    disabled={actionLoading || !permissions?.canReopen}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    {permissions?.canReopen ? "Reopen Ticket (Supervisor)" : "Reopen Expired (Closed > 7 days)"}
                  </button>
                  {!permissions?.canReopen && (
                    <p className="text-[10px] text-rose-600 mt-1">
                      7-day reopen window expired.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <SimulateCustomerReplyModal
        isOpen={simulateModalOpen}
        onClose={() => setSimulateModalOpen(false)}
        ticketId={ticketId}
        requesterName={ticketData.requesterName}
        requesterEmail={ticketData.requesterEmail}
        onSuccess={loadTicket}
      />

      <AddCollaboratorModal
        isOpen={addCollabModalOpen}
        onClose={() => setAddCollabModalOpen(false)}
        ticketId={ticketId}
        existingCollaboratorIds={collaboratorIds}
        primaryAssigneeId={ticketData.primaryAssigneeId}
        onSuccess={loadTicket}
      />
    </div>
  );
}
