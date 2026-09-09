"use client";

import React, { useState } from "react";
import { X, Send, UserCircle, Sparkles } from "lucide-react";

interface SimulateCustomerReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  requesterName: string;
  requesterEmail: string;
  onSuccess: () => void;
}

const PRESET_MESSAGES = [
  "Hi, I followed the steps you provided and the issue is still happening. Here is the latest log output.",
  "Attached is our Okta metadata XML file as requested. Let me know once certificate validation is done.",
  "Thanks for checking on this! I tried again this morning and the payment went through successfully.",
  "We are still getting the 500 Internal Server Error when clicking complete purchase.",
];

export function SimulateCustomerReplyModal({
  isOpen,
  onClose,
  ticketId,
  requesterName,
  requesterEmail,
  onSuccess,
}: SimulateCustomerReplyModalProps) {
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tickets/${ticketId}/customer-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: message.trim(),
          customerName: requesterName,
          customerEmail: requesterEmail,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to post customer reply.");
      }

      setMessage("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to post customer reply.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Simulate Inbound Customer Reply</h3>
              <p className="text-xs text-slate-500">
                From: <span className="font-medium text-slate-700">{requesterName}</span> ({requesterEmail})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-800 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              Posting a customer reply will automatically move a <strong>Pending</strong> ticket back to <strong>Open</strong>, unpause its SLA clock, and record an immutable timeline entry.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Quick Preset Message</label>
            <div className="grid grid-cols-1 gap-1.5">
              {PRESET_MESSAGES.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setMessage(preset)}
                  className="text-left text-xs p-2 rounded border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition line-clamp-1"
                >
                  "{preset}"
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Reply Body</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type the simulated customer message..."
              className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              required
            />
          </div>

          {error && <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? "Sending..." : "Submit Customer Reply"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
