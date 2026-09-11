"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { User, Ticket, TimelineItem } from "@/lib/types";
import { ApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryBadge } from "@/components/PriorityBadge";
import { AttachmentDisplay, AttachedFileChip } from "@/components/ui/AttachmentView";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Star,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Paperclip,
  Loader2,
} from "lucide-react";

interface CustomerTicketDetailProps {
  user: User;
  ticket: Ticket;
  timeline: TimelineItem[];
  onRefresh: () => void;
}

export function CustomerTicketDetail({
  user,
  ticket,
  timeline,
  onRefresh,
}: CustomerTicketDetailProps) {
  // Reply State
  const [replyBody, setReplyBody] = useState<string>("");
  const [submittingReply, setSubmittingReply] = useState<boolean>(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Attachment State
  const [attachedFile, setAttachedFile] = useState<{
    url: string;
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time EventSource connection for live customer updates
  useEffect(() => {
    if (!ticket?.id) return;

    const eventSource = new EventSource(`/api/tickets/${ticket.id}/events`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "REPLY_ADDED") {
          onRefresh();
        }
      } catch (err) {
        console.error("Customer SSE parse error:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [ticket?.id, onRefresh]);

  // Handle Attachment Selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    try {
      const uploaded = await ApiClient.uploadFile(file);
      setAttachedFile(uploaded);
    } catch (err: any) {
      alert(err.message || "Failed to upload attachment.");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // CSAT Rating State
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submittingCsat, setSubmittingCsat] = useState<boolean>(false);
  const [csatSubmitted, setCsatSubmitted] = useState<boolean>(!!ticket.satisfaction);
  const [csatData, setCsatData] = useState<any>(ticket.satisfaction || null);
  const [csatError, setCsatError] = useState<string | null>(null);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyBody.trim();
    if (!text && !attachedFile) return;

    setSubmittingReply(true);
    setReplyError(null);

    try {
      await ApiClient.addReply(
        ticket.id,
        text || (attachedFile?.name ? `Attached file: ${attachedFile.name}` : "Attachment"),
        false,
        attachedFile
      );
      setReplyBody("");
      setAttachedFile(null);
      onRefresh();
    } catch (err: any) {
      setReplyError(err.message || "Failed to send reply.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSubmitCsat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCsat(true);
    setCsatError(null);

    try {
      const res = await ApiClient.submitCsat(ticket.id, {
        rating,
        comment: comment.trim() || undefined,
      });
      setCsatSubmitted(true);
      setCsatData(res.satisfaction);
      onRefresh();
    } catch (err: any) {
      setCsatError(err.message || "Failed to submit rating.");
    } finally {
      setSubmittingCsat(false);
    }
  };

  const getRatingLabel = (val: number) => {
    switch (val) {
      case 1:
        return "1 - Poor experience";
      case 2:
        return "2 - Could be improved";
      case 3:
        return "3 - Satisfactory service";
      case 4:
        return "4 - Great experience";
      case 5:
        return "5 - Outstanding support!";
      default:
        return "";
    }
  };

  const isResolvedOrClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* Top Back Link */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Requests</span>
        </Link>
      </div>

      {/* Ticket Header Card */}
      <div className="bg-white rounded-md p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500 font-medium">
              Ticket #{ticket.ticketNumber}
            </span>
            <CategoryBadge category={ticket.category} />
          </div>
          <div>
            <StatusBadge status={ticket.status} size="md" />
          </div>
        </div>

        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
            {ticket.subject}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Submitted on {new Date(ticket.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Status guidance message */}
        {ticket.status === "PENDING" && (
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Action needed from you:</strong>
              <p className="text-amber-800 mt-0.5">
                Our support team has requested additional information. Please reply below so we can continue resolving your request.
              </p>
            </div>
          </div>
        )}

        {ticket.status === "RESOLVED" && (
          <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Request marked as Resolved:</strong>
              <p className="text-emerald-800 mt-0.5">
                If your issue was resolved, please submit a rating below. You can also reply to reopen the discussion.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CSAT Rating Widget for Resolved / Closed Tickets */}
      {isResolvedOrClosed && (
        <div className="bg-white rounded-md p-5 border border-slate-200 shadow-xs">
          {csatSubmitted || csatData ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Customer Satisfaction Feedback Received</span>
              </div>
              <p className="text-xs text-slate-500">
                Thank you for your rating. Your feedback helps us continuously improve our product and service.
              </p>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200 mt-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= (csatData?.rating || rating)
                          ? "text-amber-500 fill-amber-500"
                          : "text-slate-200"
                      }`}
                    />
                  ))}
                  <span className="text-xs font-medium text-slate-700 ml-2">
                    {getRatingLabel(csatData?.rating || rating)}
                  </span>
                </div>
                {csatData?.comment && (
                  <p className="text-xs text-slate-600 italic pt-1 border-t border-slate-200">
                    "{csatData.comment}"
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitCsat} className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  How was your support experience?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Please rate the quality and speed of service for Ticket #{ticket.ticketNumber}.
                </p>
              </div>

              {/* Star Selector */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const activeRating = hoverRating || rating;
                    const isFilled = starValue <= activeRating;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => setRating(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition cursor-pointer"
                        aria-label={`Rate ${starValue} stars`}
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            isFilled
                              ? "text-amber-500 fill-amber-500"
                              : "text-slate-200 hover:text-slate-400"
                          }`}
                        />
                      </button>
                    );
                  })}
                  <span className="text-xs font-medium text-slate-600 ml-2">
                    {getRatingLabel(hoverRating || rating)}
                  </span>
                </div>
              </div>

              {/* Optional Comment */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Additional comments (optional)
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what went well or what could be improved..."
                  rows={2}
                />
              </div>

              {csatError && (
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                  {csatError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={submittingCsat}
              >
                Submit Rating
              </Button>
            </form>
          )}
        </div>
      )}

      {/* Conversation Feed */}
      <div className="bg-white rounded-md p-5 border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
          <span>Conversation</span>
        </h2>

        {/* Initial Customer Request Description */}
        <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center text-xs font-medium">
                {user.name ? user.name.charAt(0).toUpperCase() : "C"}
              </div>
              <span className="font-semibold text-xs text-slate-900">{user.name} (Original Request)</span>
            </div>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>
        </div>

        {/* Chronological Replies Feed */}
        <div className="space-y-3 pt-1">
          {timeline
            .filter((item) => item.type === "REPLY" && item.reply && !item.reply.isInternal)
            .map((item) => {
              const r = item.reply!;
              const isMe = r.authorId === user.id || r.authorType === "CUSTOMER";

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-4.5 rounded-md border text-sm shadow-xs ${
                    isMe
                      ? "bg-slate-50/80 border-slate-200 ml-4 sm:ml-8"
                      : "bg-white border-slate-200 mr-4 sm:mr-8"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${
                          isMe
                            ? "bg-slate-700 text-white"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {isMe ? "You" : "ST"}
                      </div>
                      <span className="font-semibold text-xs text-slate-900">
                        {isMe ? "You" : r.authorName || "Support Team"}
                      </span>
                      {!isMe && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                          <ShieldCheck className="w-2.5 h-2.5" /> Support Engineer
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {r.body}
                  </p>
                  {r.attachmentUrl && (
                    <AttachmentDisplay
                      url={r.attachmentUrl}
                      name={r.attachmentName || "Attachment"}
                      size={r.attachmentSize}
                      type={r.attachmentType}
                    />
                  )}
                </div>
              );
            })}
        </div>

        {/* Customer Reply Composer */}
        <form onSubmit={handleSendReply} className="pt-3 border-t border-slate-100 space-y-2.5">
          <label className="block text-xs font-semibold text-slate-800 flex items-center justify-between">
            <span>Send a Reply</span>
            {ticket.status === "PENDING" && (
              <span className="text-[11px] text-amber-700 font-medium">
                Sending a reply resumes active investigation
              </span>
            )}
          </label>
          <Textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Type your reply or additional details..."
            rows={4}
          />

          {attachedFile && (
            <div className="pt-1">
              <AttachedFileChip
                name={attachedFile.name}
                size={attachedFile.size}
                onRemove={() => setAttachedFile(null)}
              />
            </div>
          )}

          {replyError && (
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
              {replyError}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
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
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submittingReply}
              disabled={(!replyBody.trim() && !attachedFile) || uploadingAttachment}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Send Reply
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
