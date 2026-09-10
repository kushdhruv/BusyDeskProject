"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Ticket, TimelineItem } from "@/lib/types";
import { ApiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Star,
  CheckCircle2,
  Clock,
  HelpCircle,
  Bug,
  CreditCard,
  Sparkles,
  ShieldCheck,
  UserCheck,
  AlertCircle,
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
    if (!replyBody.trim()) return;

    setSubmittingReply(true);
    setReplyError(null);

    try {
      await ApiClient.addReply(ticket.id, replyBody.trim(), false);
      setReplyBody("");
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "BUG":
        return <Bug className="w-4 h-4 text-rose-500" />;
      case "BILLING":
        return <CreditCard className="w-4 h-4 text-amber-500" />;
      case "FEATURE":
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      default:
        return <HelpCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const renderStatusPill = (status: string) => {
    switch (status) {
      case "NEW":
      case "OPEN":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Being worked on</span>
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Waiting for your response</span>
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Resolved</span>
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span>Closed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getRatingLabel = (val: number) => {
    switch (val) {
      case 1:
        return "1 - Poor experience";
      case 2:
        return "2 - Fair, could be improved";
      case 3:
        return "3 - Good service";
      case 4:
        return "4 - Great experience";
      case 5:
        return "5 - Outstanding & exceptional!";
      default:
        return "";
    }
  };

  const isResolvedOrClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Back Link */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Tickets</span>
        </Link>
      </div>

      {/* Ticket Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              Ticket #{ticket.ticketNumber}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              {getCategoryIcon(ticket.category)}
              <span>{ticket.category}</span>
            </span>
          </div>
          <div>{renderStatusPill(ticket.status)}</div>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {ticket.subject}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Submitted on {new Date(ticket.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Status guidance message */}
        {ticket.status === "PENDING" && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Our support team has requested additional information.</strong>
              <p className="text-amber-800/90 mt-0.5">
                Please add a reply below with details so we can continue resolving your issue. Your reply will automatically alert the assigned support agents.
              </p>
            </div>
          </div>
        )}

        {ticket.status === "RESOLVED" && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">This ticket has been marked as Resolved.</strong>
              <p className="text-emerald-800/90 mt-0.5">
                If the solution solved your problem, please take a moment to rate our support below. If you still have questions, you can reply below to reopen discussion.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CSAT Rating Widget for Resolved / Closed Tickets */}
      {isResolvedOrClosed && (
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {csatSubmitted || csatData ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Feedback Received</span>
              </div>
              <h2 className="text-lg font-bold">Thank You for Your Rating!</h2>
              <p className="text-xs text-slate-300">
                Your feedback helps us continuously improve our product and customer support service.
              </p>
              <div className="p-4 bg-white/10 rounded-2xl border border-white/10 mt-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-5 h-5 ${
                        s <= (csatData?.rating || rating)
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-500"
                      }`}
                    />
                  ))}
                  <span className="text-xs font-semibold text-slate-200 ml-2">
                    {getRatingLabel(csatData?.rating || rating)}
                  </span>
                </div>
                {csatData?.comment && (
                  <p className="text-xs text-slate-300 italic pt-1 border-t border-white/10">
                    "{csatData.comment}"
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitCsat} className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold mb-2">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Customer Satisfaction Survey</span>
                </div>
                <h2 className="text-lg font-bold">How was your support experience?</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Please rate the quality of service you received for Ticket #{ticket.ticketNumber}.
                </p>
              </div>

              {/* Star Selector */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
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
                        className="p-1 hover:scale-110 transition cursor-pointer"
                        aria-label={`Rate ${starValue} stars`}
                      >
                        <Star
                          className={`w-8 h-8 transition ${
                            isFilled
                              ? "text-amber-400 fill-amber-400 drop-shadow-md"
                              : "text-slate-600 hover:text-slate-400"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-medium text-amber-300">
                  {getRatingLabel(hoverRating || rating)}
                </p>
              </div>

              {/* Optional Comment */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Additional comments or suggestions (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what we did well or what could be improved..."
                  rows={2}
                  className="w-full text-xs rounded-xl p-3 bg-white/10 border border-white/15 text-white placeholder-slate-400 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition resize-none"
                />
              </div>

              {csatError && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs rounded-xl">
                  {csatError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingCsat}
                className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <span>{submittingCsat ? "Submitting Rating..." : "Submit CSAT Rating"}</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Conversation Feed */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-4 border-b border-slate-100">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          <span>Conversation History</span>
        </h2>

        {/* Initial Customer Request Description */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                {user.name ? user.name.charAt(0).toUpperCase() : "C"}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900">{user.name} (You)</span>
                <span className="text-[11px] text-slate-400 ml-2">Original Request</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-400">
              {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed pt-1">
            {ticket.description}
          </p>
        </div>

        {/* Chronological Replies Feed */}
        <div className="space-y-4 pt-2">
          {timeline
            .filter((item) => item.type === "REPLY" && item.reply && !item.reply.isInternal)
            .map((item) => {
              const r = item.reply!;
              const isMe = r.authorId === user.id || r.authorType === "CUSTOMER";

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition ${
                    isMe
                      ? "bg-indigo-50/40 border-indigo-100 ml-4 sm:ml-12"
                      : "bg-white border-slate-200 mr-4 sm:mr-12 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          isMe
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {isMe ? "You" : "ST"}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900">
                          {isMe ? "You" : r.authorName || "Support Team"}
                        </span>
                        {!isMe && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md ml-2">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Support Specialist</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed pl-9">
                    {r.body}
                  </p>
                </div>
              );
            })}
        </div>

        {/* Customer Reply Composer */}
        <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-100 space-y-3">
          <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
            <span>Send a Reply to Support</span>
            {ticket.status === "PENDING" && (
              <span className="text-[11px] text-amber-700 font-medium">
                Replying moves ticket back to active investigation
              </span>
            )}
          </label>
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Type your reply, answer questions from support, or attach more context..."
            rows={4}
            required
            className="w-full text-xs rounded-2xl p-4 border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none leading-relaxed"
          />

          {replyError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {replyError}
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={submittingReply || !replyBody.trim()}
              className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <span>{submittingReply ? "Sending..." : "Send Message"}</span>
              <Send className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
