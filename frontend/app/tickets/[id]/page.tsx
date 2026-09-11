"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Priority, Category, Status, TicketPermissions, TimelineItem } from "@/lib/types";
import { useSession } from "@/lib/session-context";
import { TicketWorkspaceSkeleton } from "@/components/ui/Skeletons";
import { AttachmentDisplay, AttachedFileChip } from "@/components/ui/AttachmentView";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge, CategoryBadge } from "@/components/PriorityBadge";
import { SlaCountdown } from "@/components/SlaCountdown";
import { SimulateCustomerReplyModal } from "@/components/SimulateCustomerReplyModal";
import { AddCollaboratorModal } from "@/components/AddCollaboratorModal";
import { CustomerTicketDetail } from "@/components/customer/CustomerTicketDetail";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import {
  ArrowLeft,
  Clock,
  Send,
  Lock,
  MessageSquare,
  Users,
  UserPlus,
  Archive,
  Tag,
  History,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Paperclip,
  Loader2,
} from "lucide-react";

export default function TicketWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const { user, agents } = useSession();
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

  // Attachment State
  const [attachedFile, setAttachedFile] = useState<{
    url: string;
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Actions
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
    loadTicket();
  }, [loadTicket]);

  // Real-time EventSource connection for live chat updates across screens
  useEffect(() => {
    if (!ticketId) return;

    const eventSource = new EventSource(`/api/tickets/${ticketId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "REPLY_ADDED" && data.reply) {
          const incoming = data.reply;
          setTimeline((prev) => {
            const exists = prev.some(
              (item) => item.reply?.id === incoming.id || item.id === `reply-${incoming.id}`
            );
            if (exists) return prev;
            const newItem: TimelineItem = {
              id: `reply-${incoming.id}`,
              type: "REPLY",
              createdAt: incoming.createdAt || new Date().toISOString(),
              reply: {
                id: incoming.id,
                authorId: incoming.authorId,
                authorType: incoming.authorType,
                authorName: incoming.authorName,
                authorEmail: incoming.authorEmail,
                body: incoming.body,
                isInternal: incoming.isInternal,
                attachmentUrl: incoming.attachmentUrl,
                attachmentName: incoming.attachmentName,
                attachmentSize: incoming.attachmentSize,
                attachmentType: incoming.attachmentType,
              },
            };
            return [...prev, newItem];
          });
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [ticketId]);

  // Handle Attachment Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed.");
      }
      const uploaded = await res.json();
      setAttachedFile(uploaded);
    } catch (err: any) {
      alert(err.message || "Failed to upload file.");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Submit Agent Reply / Internal Note
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyBody.trim();
    if (!text && !attachedFile) return;

    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text || (attachedFile?.name ? `Attached file: ${attachedFile.name}` : "Attachment"),
          isInternal,
          attachmentUrl: attachedFile?.url,
          attachmentName: attachedFile?.name,
          attachmentSize: attachedFile?.size,
          attachmentType: attachedFile?.type,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit reply.");
      }

      const result = await res.json();
      if (result.reply) {
        const incoming = result.reply;
        setTimeline((prev) => {
          if (prev.some((item) => item.reply?.id === incoming.id || item.id === `reply-${incoming.id}`)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `reply-${incoming.id}`,
              type: "REPLY",
              createdAt: incoming.createdAt || new Date().toISOString(),
              reply: incoming,
            },
          ];
        });
      }

      setReplyBody("");
      setAttachedFile(null);
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
    return <TicketWorkspaceSkeleton />;
  }

  if (error || !ticketData) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-10 h-10 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Unable to access ticket</h2>
        <p className="text-xs text-slate-500 mt-1">{error || "Ticket not found or permission denied."}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push("/tickets")}>
          Return to Queue
        </Button>
      </div>
    );
  }

  // Render Customer Portal View if user is a CUSTOMER
  if (user?.role === "CUSTOMER") {
    return (
      <CustomerTicketDetail
        user={user}
        ticket={ticketData}
        timeline={timeline}
        onRefresh={loadTicket}
      />
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
    <div className="space-y-4 pb-16">
      {/* Breadcrumb & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => router.push("/tickets")}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            aria-label="Back to queue"
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="hover:text-slate-800 cursor-pointer" onClick={() => router.push("/tickets")}>
                Tickets
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="font-mono font-medium text-slate-700">#{ticketData.ticketNumber}</span>
              <StatusBadge status={ticketData.status} size="sm" />
              <PriorityBadge priority={ticketData.priority} />
            </div>
            <h1 className="text-base font-semibold text-slate-900 truncate mt-0.5 tracking-tight">
              {ticketData.subject}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setSimulateModalOpen(true)}
            icon={<Sparkles className="w-3.5 h-3.5 text-slate-500" />}
          >
            Simulate Inbound Reply
          </Button>

          {permissions?.canManageCollaborators && (
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setAddCollabModalOpen(true)}
              icon={<UserPlus className="w-3.5 h-3.5 text-slate-500" />}
            >
              Collaborators
            </Button>
          )}

          {ticketData.status === "RESOLVED" && permissions?.canClose && (
            <Button
              variant="primary"
              size="xs"
              onClick={() => handleStatusChange("CLOSED")}
              loading={actionLoading}
            >
              Close Ticket
            </Button>
          )}

          {permissions?.canArchive && (
            <Button
              variant="secondary"
              size="xs"
              onClick={handleToggleArchive}
              loading={actionLoading}
              icon={<Archive className="w-3.5 h-3.5 text-slate-500" />}
            >
              {ticketData.archivedAt ? "Restore" : "Archive"}
            </Button>
          )}
        </div>
      </div>

      {/* 2-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Columns: Conversation & Timeline */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-4 border-b border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveTab("conversation")}
              className={`pb-2.5 transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
                activeTab === "conversation"
                  ? "border-slate-900 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Conversation</span>
            </button>

            <button
              onClick={() => setActiveTab("details")}
              className={`pb-2.5 transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
                activeTab === "details"
                  ? "border-slate-900 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>

            <button
              onClick={() => setActiveTab("collaborators")}
              className={`pb-2.5 transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
                activeTab === "collaborators"
                  ? "border-slate-900 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Collaborators ({collaboratorList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2.5 transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
                activeTab === "history"
                  ? "border-slate-900 text-slate-900 font-semibold"
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
              {/* Initial Customer Description */}
              <div className="bg-white p-5 rounded-md border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center border border-slate-200 flex-shrink-0">
                      {getInitials(ticketData.requesterName)}
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-slate-900">{ticketData.requesterName}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">Requester</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {new Date(ticketData.createdAt).toLocaleDateString()} {new Date(ticketData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {ticketData.description}
                </div>
              </div>

              {/* Timeline Messages & Events */}
              <div className="space-y-3">
                {timeline.map((item) => {
                  if (item.type === "REPLY" && item.reply) {
                    const isNote = item.reply.isInternal;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 sm:p-5 rounded-md border text-sm shadow-xs ${
                          isNote
                            ? "bg-amber-50/40 border-amber-200 border-l-[3px] border-l-amber-500"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded font-medium text-xs flex items-center justify-center flex-shrink-0 ${
                                isNote
                                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                                  : "bg-slate-900 text-white"
                              }`}
                            >
                              {item.reply.authorName ? getInitials(item.reply.authorName) : "C"}
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-slate-900">
                                {item.reply.authorName || "Customer"}
                              </span>
                              {isNote && (
                                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100/70 border border-amber-200 px-1.5 py-0.2 rounded">
                                  <Lock className="w-2.5 h-2.5" /> Staff Internal Note
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {item.reply.body}
                        </div>
                        {item.reply.attachmentUrl && (
                          <AttachmentDisplay
                            url={item.reply.attachmentUrl}
                            name={item.reply.attachmentName || "Attachment"}
                            size={item.reply.attachmentSize}
                            type={item.reply.attachmentType}
                          />
                        )}
                      </div>
                    );
                  }

                  if (item.type === "AUDIT" && item.audit) {
                    return (
                      <div key={item.id} className="py-1.5 px-3 text-xs text-slate-500 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-700 font-medium">{item.audit.actorName}</strong>:{" "}
                          {item.audit.eventType === "STATUS_CHANGED" &&
                            `changed status to ${item.audit.newValue?.status}`}
                          {item.audit.eventType === "REASSIGNED" &&
                            `reassigned ticket to ${item.audit.newValue?.assigneeName || "Unassigned"}`}
                          {item.audit.eventType === "COLLABORATOR_ADDED" &&
                            `added collaborator ${item.audit.newValue?.userName}`}
                          {item.audit.eventType === "COLLABORATOR_REMOVED" &&
                            `removed collaborator ${item.audit.oldValue?.userName}`}
                          {item.audit.eventType === "TICKET_CREATED" && "created this ticket"}
                          {item.audit.eventType === "TICKET_ARCHIVED" && "archived this ticket"}
                          {item.audit.eventType === "TICKET_RESTORED" && "restored this ticket"}
                        </span>
                        <span className="text-slate-400 tabular-nums ml-auto flex-shrink-0 text-[11px]">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>

              {/* Reply Composer */}
              {permissions?.canReply && (
                <div className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden mt-6">
                  <div className="flex items-center gap-4 px-4 pt-3 border-b border-slate-100 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setIsInternal(false)}
                      className={`pb-2.5 border-b-2 -mb-px transition-colors cursor-pointer ${
                        !isInternal
                          ? "border-slate-900 text-slate-900 font-semibold"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Public Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInternal(true)}
                      className={`pb-2.5 border-b-2 -mb-px transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isInternal
                          ? "border-amber-600 text-amber-800 font-semibold"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Internal Note</span>
                    </button>
                  </div>

                  <form onSubmit={handleSendReply} className="p-4 space-y-3">
                    <Textarea
                      rows={5}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder={
                        isInternal
                          ? "Write an internal note (visible to team only)..."
                          : "Type your reply to the customer..."
                      }
                      className={`min-h-[130px] ${isInternal ? "bg-amber-50/20 border-amber-200" : ""}`}
                    />

                    {/* Attached File Chip Preview */}
                    {attachedFile && (
                      <div className="pt-1">
                        <AttachedFileChip
                          name={attachedFile.name}
                          size={attachedFile.size}
                          onRemove={() => setAttachedFile(null)}
                        />
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={uploadingAttachment || submittingReply}
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200/70 border border-slate-200 transition-colors cursor-pointer"
                        >
                          {uploadingAttachment ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                          ) : (
                            <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{uploadingAttachment ? "Uploading..." : "Attach file"}</span>
                        </button>
                        <span className="text-xs text-slate-400">
                          {isInternal
                            ? "Internal notes are private and never sent to the customer."
                            : "Customer will receive an email notification."}
                        </span>
                      </div>

                      <Button
                        type="submit"
                        variant={isInternal ? "secondary" : "primary"}
                        size="sm"
                        loading={submittingReply}
                        disabled={(!replyBody.trim() && !attachedFile) || uploadingAttachment}
                        icon={isInternal ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                      >
                        {isInternal ? "Add Internal Note" : "Send Reply"}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DETAILS */}
          {activeTab === "details" && (
            <div className="bg-white p-5 rounded-md border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Ticket Specifications</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Ticket Number</span>
                  <span className="font-mono font-medium text-slate-900">#{ticketData.ticketNumber}</span>
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
                  <span className="text-slate-400 block mb-1">Status</span>
                  <StatusBadge status={ticketData.status} />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Created At</span>
                  <span className="text-slate-800 tabular-nums">{new Date(ticketData.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Last Updated</span>
                  <span className="text-slate-800 tabular-nums">{new Date(ticketData.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COLLABORATORS */}
          {activeTab === "collaborators" && (
            <div className="bg-white p-5 rounded-md border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Collaborators</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Team members with full access to view, reply, and add internal notes.
                  </p>
                </div>
                {permissions?.canManageCollaborators && (
                  <Button variant="secondary" size="xs" onClick={() => setAddCollabModalOpen(true)}>
                    + Add Collaborator
                  </Button>
                )}
              </div>

              <div className="divide-y divide-slate-100 mt-2">
                {/* Primary Assignee */}
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-slate-900 text-white font-medium text-xs flex items-center justify-center">
                      {ticketData.primaryAssignee ? getInitials(ticketData.primaryAssignee.name) : "U"}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-900">
                        {ticketData.primaryAssignee?.name || "Unassigned"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {ticketData.primaryAssignee?.email || "No assignee"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Primary Assignee
                  </span>
                </div>

                {/* Secondary Collaborators */}
                {collaboratorList.map((c: any) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center">
                        {getInitials(c.user.name)}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-900">{c.user.name}</p>
                        <p className="text-[11px] text-slate-500">{c.user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                        Collaborator
                      </span>
                      {permissions?.canManageCollaborators && (
                        <button
                          onClick={() => handleRemoveCollaborator(c.userId)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
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

          {/* TAB 4: HISTORY */}
          {activeTab === "history" && (
            <div className="bg-white p-5 rounded-md border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Audit History</h3>
              <p className="text-xs text-slate-500">
                Immutable chronological log of all ticket events and state transitions.
              </p>

              <div className="divide-y divide-slate-100 mt-2">
                {timeline
                  .filter((t) => t.type === "AUDIT" && t.audit)
                  .map((item) => (
                    <div key={item.id} className="py-2 flex items-start justify-between text-xs">
                      <div>
                        <span className="font-medium text-slate-900">{item.audit?.actorName}</span>
                        <span className="text-slate-600 ml-1.5">
                          {item.audit?.eventType === "STATUS_CHANGED" &&
                            `changed status from ${item.audit.oldValue?.status} to ${item.audit.newValue?.status}`}
                          {item.audit?.eventType === "REASSIGNED" &&
                            `reassigned ticket to ${item.audit.newValue?.assigneeName || "Unassigned"}`}
                          {item.audit?.eventType === "COLLABORATOR_ADDED" &&
                            `added collaborator ${item.audit.newValue?.userName}`}
                          {item.audit?.eventType === "COLLABORATOR_REMOVED" &&
                            `removed collaborator ${item.audit.oldValue?.userName}`}
                          {item.audit?.eventType === "TICKET_CREATED" && "created this ticket"}
                          {item.audit?.eventType === "REPLY_ADDED" && "added a comment"}
                          {item.audit?.eventType === "TICKET_ARCHIVED" && "archived this ticket"}
                          {item.audit?.eventType === "TICKET_RESTORED" && "restored this ticket"}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Columns: Inspector & Lifecycle Controls */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5 lg:sticky lg:top-4">
          {/* Metadata Inspector Card */}
          <div className="bg-white p-5 rounded-md border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2.5">
              Ticket Details
            </h3>

            {/* Requester */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Requester</span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-medium text-[11px] flex items-center justify-center border border-slate-200">
                    {getInitials(ticketData.requesterName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{ticketData.requesterName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{ticketData.requesterEmail}</p>
                  </div>
                </div>
                <button
                  onClick={copyEmailToClipboard}
                  title="Copy email"
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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
              <StatusBadge status={ticketData.status} size="md" />
            </div>

            {/* Primary Assignee */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 block mb-1">Primary Assignee</span>
              {permissions?.canReassign ? (
                <Select
                  value={ticketData.primaryAssigneeId || ""}
                  onChange={(e) => handleReassign(e.target.value)}
                  disabled={actionLoading}
                  className="w-full"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="flex items-center gap-2 p-1.5 rounded bg-slate-50 border border-slate-200 text-xs">
                  <div className="w-5 h-5 rounded bg-slate-200 text-slate-700 font-medium text-[10px] flex items-center justify-center">
                    {ticketData.primaryAssignee ? getInitials(ticketData.primaryAssignee.name) : "U"}
                  </div>
                  <span className="font-medium text-slate-800">
                    {ticketData.primaryAssignee?.name || "Unassigned"}
                  </span>
                </div>
              )}
            </div>

            {/* SLA Clock Widget */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-[11px] text-slate-400 block">SLA Target</span>
              <div className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                <SlaCountdown
                  slaDueAt={ticketData.slaDueAt}
                  status={ticketData.status}
                  slaPausedRemainingSeconds={ticketData.slaPausedRemainingSeconds}
                  size="sm"
                />
                <span className="text-[10px] text-slate-400 font-mono">Cycle #{ticketData.slaCycle}</span>
              </div>
              {activeAlert && permissions?.canAcknowledgeAlert && (
                <Button
                  variant="danger"
                  size="xs"
                  className="w-full mt-1.5"
                  onClick={() => handleAcknowledgeAlert(activeAlert.id)}
                  loading={actionLoading}
                  icon={<CheckCircle2 className="w-3 h-3" />}
                >
                  Acknowledge SLA Alert
                </Button>
              )}
            </div>
          </div>

          {/* Lifecycle State Controls */}
          <div className="bg-white p-5 rounded-md border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2.5">
              Lifecycle Transitions
            </h3>

            <div className="space-y-1.5">
              {ticketData.status === "NEW" && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleStatusChange("OPEN")}
                  loading={actionLoading}
                >
                  Move to Open
                </Button>
              )}

              {ticketData.status === "OPEN" && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusChange("PENDING")}
                    loading={actionLoading}
                  >
                    Pause SLA (Pending Customer)
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusChange("RESOLVED")}
                    loading={actionLoading}
                  >
                    Mark as Resolved
                  </Button>
                </>
              )}

              {ticketData.status === "PENDING" && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusChange("OPEN")}
                    loading={actionLoading}
                  >
                    Resume SLA (Move to Open)
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusChange("RESOLVED")}
                    loading={actionLoading}
                  >
                    Mark as Resolved
                  </Button>
                </>
              )}

              {ticketData.status === "RESOLVED" && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusChange("OPEN")}
                    loading={actionLoading}
                  >
                    Reopen Ticket
                  </Button>
                  {permissions?.canClose && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleStatusChange("CLOSED")}
                      loading={actionLoading}
                    >
                      Close Ticket (Supervisor)
                    </Button>
                  )}
                </>
              )}

              {ticketData.status === "CLOSED" && (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusChange("OPEN")}
                    disabled={actionLoading || !permissions?.canReopen}
                    loading={actionLoading}
                  >
                    {permissions?.canReopen ? "Reopen Ticket (Supervisor)" : "Reopen Expired (> 7 days)"}
                  </Button>
                  {!permissions?.canReopen && (
                    <p className="text-[10px] text-rose-600 mt-1">
                      7-day supervisor reopen window expired.
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
