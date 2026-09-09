"use client";

import React from "react";
import { BulkActionResponse } from "@/lib/types";
import { CheckCircle2, XCircle, X } from "lucide-react";

interface BulkResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BulkActionResponse | null;
}

export function BulkResultsModal({ isOpen, onClose, data }: BulkResultsModalProps) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Bulk Operation Summary</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.succeededCount} of {data.totalRequested} tickets updated successfully
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto space-y-3">
          {data.results.map((r) => (
            <div
              key={r.ticketId}
              className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${
                r.status === "SUCCESS"
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : "bg-rose-50/70 border-rose-200 text-rose-900"
              }`}
            >
              {r.status === "SUCCESS" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2">
                  <span>Ticket #{r.ticketNumber}</span>
                  <span className="text-xs font-normal opacity-80 truncate">{r.subject}</span>
                </div>
                {r.status === "FAILED" && (
                  <p className="text-xs text-rose-700 mt-1 font-medium bg-rose-100/80 px-2 py-1 rounded">
                    Refused: {r.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
