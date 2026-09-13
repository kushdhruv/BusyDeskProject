"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Mail, Bell, Check, AlertCircle, X, Sparkles, Eye } from "lucide-react";

interface DigestSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPreview?: () => void;
}

export const DigestSettingsModal: React.FC<DigestSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenPreview,
}) => {
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "NEVER">("DAILY");
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    fetch("/api/digest/preferences")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.preferences) {
          setEnabled(data.preferences.digestEnabled);
          setFrequency(data.preferences.digestFrequency || "DAILY");
          setLastSentAt(data.preferences.digestLastSentAt);
        }
      })
      .catch(() => setError("Failed to load digest settings."))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const res = await fetch("/api/digest/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          frequency,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update preferences.");

      setSuccess("Email digest preferences saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Email Queue Digest</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Loading notification preferences...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Enable/Disable Toggle */}
            <div className="flex items-start justify-between p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div>
                <span className="font-semibold text-slate-900 block">Queue Digest Briefing</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Receive an automated email summary with actionable tickets and SLA alerts.
                </span>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
            </div>

            {/* Frequency Selection */}
            {enabled && (
              <div className="space-y-2">
                <label className="block text-slate-700 font-medium">Delivery Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFrequency("DAILY")}
                    className={`p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                      frequency === "DAILY"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-bold block text-xs">Daily Briefing</span>
                    <span className={`text-[10px] block mt-0.5 ${frequency === "DAILY" ? "text-slate-300" : "text-slate-500"}`}>
                      8:30 AM weekdays
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrequency("WEEKLY")}
                    className={`p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                      frequency === "WEEKLY"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-bold block text-xs">Weekly Digest</span>
                    <span className={`text-[10px] block mt-0.5 ${frequency === "WEEKLY" ? "text-slate-300" : "text-slate-500"}`}>
                      Monday morning
                    </span>
                  </button>
                </div>
              </div>
            )}

            {lastSentAt && (
              <p className="text-[11px] text-slate-400">
                Last delivered: {new Date(lastSentAt).toLocaleString()}
              </p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {onOpenPreview ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPreview();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Email</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                  Close
                </Button>
                <Button variant="primary" size="sm" type="submit" loading={saving}>
                  Save Preferences
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default DigestSettingsModal;
