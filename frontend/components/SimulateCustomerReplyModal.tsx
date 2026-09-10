"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Send, UserCircle } from "lucide-react";

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simulate Inbound Customer Reply"
      description={`Sender: ${requesterName} (${requesterEmail})`}
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={loading}
            disabled={!message.trim()}
            icon={<Send className="w-3.5 h-3.5" />}
          >
            Submit Reply
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
          Inbound customer replies will move <strong>Pending</strong> tickets back to <strong>Open</strong>, resume paused SLA timers, and record an immutable timeline entry.
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Quick Presets</label>
          <div className="grid grid-cols-1 gap-1">
            {PRESET_MESSAGES.map((preset, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => setMessage(preset)}
                className="text-left text-xs p-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors truncate cursor-pointer"
              >
                "{preset}"
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-700 mb-1">Message Body</label>
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type customer reply message..."
            required
          />
        </div>

        {error && (
          <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
