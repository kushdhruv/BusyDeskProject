"use client";

import React from "react";
import { X, Sparkles, CheckCircle2, Copy, BookOpen, User, Star } from "lucide-react";
import { SolutionRecommendation } from "./SmartAssistPanel";

interface SolutionPreviewDrawerProps {
  item: SolutionRecommendation;
  onClose: () => void;
  onApplyDraft: (text: string) => void;
}

export const SolutionPreviewDrawer: React.FC<SolutionPreviewDrawerProps> = ({
  item,
  onClose,
  onApplyDraft,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.solutionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              {item.sourceType === "KB" ? (
                <BookOpen className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {item.sourceType === "KB" ? "Knowledge Base Guide" : "Historical Ticket Resolution"}
              </h3>
              <span className="text-xs text-indigo-600 font-medium">
                {Math.round(item.similarity * 100)}% Semantic Match
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Metadata Card */}
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 text-sm">{item.title}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {item.category}
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-500 pt-1">
              {item.csatRating && (
                <div className="flex items-center gap-1 text-amber-600 font-medium">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{item.csatRating}.0 CSAT Rating</span>
                </div>
              )}
              {item.resolvedBy && (
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Resolved by {item.resolvedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* Solution Body */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 uppercase tracking-wider text-[11px]">
              Verified Solution & Troubleshooting Steps:
            </h4>
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap shadow-inner">
              {item.solutionText}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? "Copied to Clipboard!" : "Copy Snippet"}</span>
          </button>

          <button
            onClick={() => onApplyDraft(item.solutionText)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Apply as Response Draft</span>
          </button>
        </div>
      </div>
    </div>
  );
};
