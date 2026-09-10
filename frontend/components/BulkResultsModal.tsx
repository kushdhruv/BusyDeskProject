"use client";

import React from "react";
import { BulkActionResponse } from "@/lib/types";
import { CheckCircle2, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface BulkResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BulkActionResponse | null;
}

export function BulkResultsModal({ isOpen, onClose, data }: BulkResultsModalProps) {
  if (!isOpen || !data) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Operation Summary"
      description={`${data.succeededCount} of ${data.totalRequested} tickets updated successfully`}
      maxWidth="md"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {data.results.map((r) => (
          <div
            key={r.ticketId}
            className={`p-2.5 rounded-md border text-xs flex items-start gap-2.5 ${
              r.status === "SUCCESS"
                ? "bg-emerald-50/50 border-emerald-200 text-slate-800"
                : "bg-rose-50/50 border-rose-200 text-slate-800"
            }`}
          >
            {r.status === "SUCCESS" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="font-mono text-slate-500">#{r.ticketNumber}</span>
                <span className="truncate text-slate-900">{r.subject}</span>
              </div>
              {r.status === "FAILED" && (
                <p className="text-[11px] text-rose-700 mt-1 font-normal bg-rose-100/60 px-2 py-0.5 rounded inline-block">
                  Refused: {r.reason}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
