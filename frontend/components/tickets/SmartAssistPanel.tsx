"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Lock,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Check,
} from "lucide-react";
import { SolutionPreviewDrawer } from "./SolutionPreviewDrawer";

export interface SolutionRecommendation {
  sourceType: "TICKET" | "KB";
  sourceId: string;
  title: string;
  solutionText: string;
  similarity: number;
  ticketNumber?: number;
  csatRating?: number | null;
  category: string;
  resolvedBy?: string | null;
}

interface SmartAssistPanelProps {
  ticketId: string;
  onApplyDraft: (text: string) => void;
  onApplyInternalDraft: (text: string) => void;
}

export const SmartAssistPanel: React.FC<SmartAssistPanelProps> = ({
  ticketId,
  onApplyDraft,
  onApplyInternalDraft,
}) => {
  const [data, setData] = useState<{
    highConfidence: SolutionRecommendation[];
    related: SolutionRecommendation[];
    scannedCount: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedRelated, setExpandedRelated] = useState<boolean>(true);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, "up" | "down">>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<SolutionRecommendation | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(`/api/tickets/${ticketId}/recommendations`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Smart Assist fetch error:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [ticketId]);

  const handleSendFeedback = async (
    item: SolutionRecommendation,
    type: "up" | "down"
  ) => {
    setFeedbackSent((prev) => ({ ...prev, [item.sourceId]: type }));

    try {
      await fetch("/api/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTicketId: ticketId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          similarityScore: item.similarity,
          actionTaken: type === "up" ? "INSERTED" : "DISMISSED",
        }),
      });
    } catch (e) {
      console.error("Failed to log feedback:", e);
    }
  };

  const handleApplyWithFeedback = (
    item: SolutionRecommendation,
    isInternalNote: boolean = false
  ) => {
    if (isInternalNote) {
      onApplyInternalDraft(item.solutionText);
    } else {
      onApplyDraft(item.solutionText);
    }

    setCopiedId(item.sourceId);
    setTimeout(() => setCopiedId(null), 2500);

    // Automatically record positive feedback on insertion
    handleSendFeedback(item, "up");
  };

  // State 1: Silent fallback if loading failed or zero relevant matches
  if (
    !loading &&
    (!data || (data.highConfidence.length === 0 && data.related.length === 0))
  ) {
    return null;
  }

  // State 2: Shimmer loading state
  if (loading) {
    return (
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3.5 animate-pulse mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
          <span className="text-xs text-indigo-600 font-medium">
            Knowledge Copilot: Scanning verified resolutions & KB articles...
          </span>
        </div>
      </div>
    );
  }

  const topMatch = data?.highConfidence[0] || null;
  const otherHigh = data?.highConfidence.slice(1) || [];
  const relatedMatches = [...otherHigh, ...(data?.related || [])];

  return (
    <>
      <div className="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 p-4 shadow-xs mb-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-indigo-100/80 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                Knowledge Copilot
                <span className="text-[10px] font-normal text-indigo-600 bg-indigo-100/70 px-1.5 py-0.2 rounded border border-indigo-200">
                  AI Solution Assist
                </span>
              </h4>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">
            Scanned {data?.scannedCount || 0} resolutions
          </span>
        </div>

        {/* State 3: High-Confidence Primary Solution Card */}
        {topMatch && (
          <div className="bg-white rounded-md border border-indigo-200 p-3.5 shadow-xs mb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  {Math.round(topMatch.similarity * 100)}% Semantic Match
                </span>
                <span className="text-xs font-semibold text-slate-900">
                  {topMatch.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {topMatch.csatRating && (
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    ★ {topMatch.csatRating}.0 CSAT
                  </span>
                )}
                {topMatch.resolvedBy && (
                  <span className="text-[11px] text-slate-400">
                    by {topMatch.resolvedBy}
                  </span>
                )}
              </div>
            </div>

            {/* Solution Excerpt */}
            <div className="bg-slate-50 rounded p-2.5 text-xs text-slate-700 font-mono whitespace-pre-wrap border border-slate-200/80 leading-relaxed mb-3 max-h-32 overflow-y-auto">
              {topMatch.solutionText}
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyWithFeedback(topMatch, false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors shadow-xs cursor-pointer"
                >
                  {copiedId === topMatch.sourceId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Inserted into Reply!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Insert as Public Reply</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyWithFeedback(topMatch, true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-900 bg-amber-100/70 hover:bg-amber-100 border border-amber-200 rounded transition-colors cursor-pointer"
                  title="Insert into reply composer and switch to internal note tab"
                >
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Insert as Note</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewItem(topMatch)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Full Context</span>
                </button>
              </div>

              {/* Feedback Telemetry */}
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[11px] mr-1">Helpful?</span>
                <button
                  type="button"
                  onClick={() => handleSendFeedback(topMatch, "up")}
                  className={`p-1 rounded hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer ${
                    feedbackSent[topMatch.sourceId] === "up"
                      ? "text-emerald-600 font-bold bg-emerald-50"
                      : ""
                  }`}
                  title="Helpful recommendation"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendFeedback(topMatch, "down")}
                  className={`p-1 rounded hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer ${
                    feedbackSent[topMatch.sourceId] === "down"
                      ? "text-rose-600 font-bold bg-rose-50"
                      : ""
                  }`}
                  title="Not relevant"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* State 4: Related Matches Accordion */}
        {relatedMatches.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setExpandedRelated(!expandedRelated)}
              className="flex items-center justify-between w-full text-xs font-medium text-slate-600 hover:text-slate-900 py-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  {topMatch ? "Other Related Historical Solutions" : "Related Solutions & Guides"} ({relatedMatches.length})
                </span>
              </div>
              {expandedRelated ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {expandedRelated && (
              <div className="space-y-2 mt-2">
                {relatedMatches.map((item) => (
                  <div
                    key={item.sourceId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white/80 hover:bg-white rounded border border-slate-200 text-xs transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                          {Math.round(item.similarity * 100)}% Match
                        </span>
                        <span className="font-medium text-slate-900 truncate">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.solutionText}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyWithFeedback(item, false)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded hover:bg-indigo-50 cursor-pointer"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-over Preview Drawer */}
      {previewItem && (
        <SolutionPreviewDrawer
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onApplyDraft={(text) => {
            handleApplyWithFeedback(previewItem, false);
            setPreviewItem(null);
          }}
        />
      )}
    </>
  );
};
