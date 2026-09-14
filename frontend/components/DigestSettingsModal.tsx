"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
  Mail,
  Check,
  AlertCircle,
  X,
  Eye,
  Send,
  Clock,
  Calendar,
  Globe,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface DigestSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPreview?: () => void;
}

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const DAYS_OF_WEEK = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 7, label: "Sun", full: "Sunday" },
];

const TIME_PRESETS = [
  { time: "08:30", label: "08:30 AM", sub: "Early Standup" },
  { time: "09:00", label: "09:00 AM", sub: "Workday Start" },
  { time: "13:00", label: "01:00 PM", sub: "Midday Check" },
  { time: "17:30", label: "05:30 PM", sub: "Day Wrap-up" },
];

export const DigestSettingsModal: React.FC<DigestSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenPreview,
}) => {
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "NEVER">("DAILY");
  const [time, setTime] = useState<string>("09:00");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-detect browser timezone
  const browserTimezone =
    typeof Intl !== "undefined" && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    fetch("/api/digest/preferences")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.preferences) {
          setEnabled(data.preferences.digestEnabled);
          setFrequency(data.preferences.digestFrequency || "DAILY");
          setTime(data.preferences.digestTime || "09:00");
          setDayOfWeek(data.preferences.digestDayOfWeek ?? 1);
          setTimezone(data.preferences.digestTimezone || browserTimezone || "UTC");
          setLastSentAt(data.preferences.digestLastSentAt);
        }
      })
      .catch(() => setError("Failed to load digest settings."))
      .finally(() => setLoading(false));
  }, [isOpen, browserTimezone]);

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
          time,
          dayOfWeek,
          timezone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update preferences.");

      setSuccess("Email digest preferences saved successfully.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    try {
      setSendingNow(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/digest/send-now", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch digest.");

      setSuccess(data.message || "Live digest email dispatched to your inbox!");
      setLastSentAt(new Date().toISOString());
      setTimeout(() => setSuccess(null), 6000);
    } catch (err: any) {
      setError(err.message || "Failed to dispatch email digest.");
    } finally {
      setSendingNow(false);
    }
  };

  const formatDisplayTime = (timeStr: string) => {
    try {
      const [hStr, mStr] = timeStr.split(":");
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      const ampm = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return `${displayH}:${m < 10 ? `0${m}` : m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const selectedDayName =
    DAYS_OF_WEEK.find((d) => d.id === dayOfWeek)?.full || "Monday";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Email Queue Digest</h3>
              <p className="text-[11px] text-slate-500">
                Personalized queue briefing and SLA alert delivery schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2.5">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
            <p>Loading your notification schedule...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Master Toggle */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="font-bold text-slate-900 block text-xs">
                  Queue Digest Briefing
                </span>
                <span className="text-slate-500 text-[11px] block mt-0.5 leading-relaxed">
                  Automated email briefing with assigned tickets, breaching SLAs, and customer replies.
                </span>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
            </div>

            {enabled && (
              <div className="space-y-4 pt-1">
                {/* Delivery Frequency */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Delivery Frequency</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFrequency("DAILY")}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        frequency === "DAILY"
                          ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-bold block text-xs">Daily Briefing</span>
                      <span
                        className={`text-[10px] block mt-0.5 ${
                          frequency === "DAILY" ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        Every morning at your set time
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFrequency("WEEKLY")}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        frequency === "WEEKLY"
                          ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-bold block text-xs">Weekly Summary</span>
                      <span
                        className={`text-[10px] block mt-0.5 ${
                          frequency === "WEEKLY" ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        Once a week recap & trend analysis
                      </span>
                    </button>
                  </div>
                </div>

                {/* Day of Week Selector (for Weekly) */}
                {frequency === "WEEKLY" && (
                  <div className="space-y-1.5">
                    <label className="block text-slate-700 font-semibold">Delivery Day</label>
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDayOfWeek(d.id)}
                          className={`py-2 text-center rounded-md border font-medium text-xs transition-colors cursor-pointer ${
                            dayOfWeek === d.id
                              ? "border-slate-900 bg-slate-900 text-white font-bold"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery Time Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Preferred Delivery Time</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">Custom:</span>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  {/* Preset Quick Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {TIME_PRESETS.map((preset) => (
                      <button
                        key={preset.time}
                        type="button"
                        onClick={() => setTime(preset.time)}
                        className={`p-2 rounded-md border text-center transition-all cursor-pointer ${
                          time === preset.time
                            ? "border-slate-900 bg-slate-100 text-slate-900 font-bold"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className="block text-xs">{preset.label}</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5">
                          {preset.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timezone */}
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-semibold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span>Your Timezone</span>
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full p-2 rounded-md border border-slate-200 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  >
                    {!COMMON_TIMEZONES.includes(timezone) && (
                      <option value={timezone}>{timezone} (Detected)</option>
                    )}
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz} {tz === browserTimezone ? "(Local Device)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Schedule Summary Pill */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center justify-between text-indigo-900 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      Scheduled:{" "}
                      <strong>
                        {frequency === "WEEKLY"
                          ? `Every ${selectedDayName} at ${formatDisplayTime(time)}`
                          : `Every day at ${formatDisplayTime(time)}`}
                      </strong>{" "}
                      <span className="text-indigo-600 font-mono text-[10px]">({timezone})</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {lastSentAt && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                <span>Last delivered:</span>
                <span className="font-medium text-slate-600">
                  {new Date(lastSentAt).toLocaleString()}
                </span>
              </p>
            )}

            {/* Modal Footer with Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onOpenPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPreview();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer py-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview HTML</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {enabled && (
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={handleSendNow}
                    loading={sendingNow}
                    icon={<Send className="w-3.5 h-3.5" />}
                    title="Sends an instant live test digest to your email inbox"
                  >
                    Send to My Inbox Now
                  </Button>
                )}
                <Button variant="primary" size="sm" type="submit" loading={saving}>
                  Save Settings
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
