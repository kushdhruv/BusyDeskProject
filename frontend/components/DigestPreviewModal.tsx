"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/lib/session-context";
import { Button } from "@/components/ui/Button";
import { Mail, Send, Check, AlertCircle, X, RefreshCw, Smartphone, Monitor } from "lucide-react";

interface DigestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DigestPreviewModal: React.FC<DigestPreviewModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useSession();
  const isSupervisor = user?.role === "SUPERVISOR";

  const [digestType, setDigestType] = useState<"agent" | "supervisor">(
    isSupervisor ? "supervisor" : "agent"
  );
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams({
        type: digestType,
        period,
      });

      const res = await fetch(`/api/digest/preview?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load preview.");

      setPreviewHtml(data.html || "");
      setPreviewData(data.data || null);
    } catch (err: any) {
      setError(err.message || "Failed to render preview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, digestType, period]);

  const handleSendTestDispatch = async () => {
    try {
      setSendingTest(true);
      setError(null);

      const res = await fetch("/api/cron/digest?force=true", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger dispatch.");

      const isSandboxRestricted = data.results?.deliveries?.some(
        (d: any) => d.status === "FAILED" && d.reason?.includes("only send testing emails")
      );

      if (isSandboxRestricted) {
        setSendSuccess(
          `Processed ${data.results?.totalEligible || 0} digests. (Sandbox notice: free tier only delivers to registered account owner; use Preview tab to view HTML rendering.)`
        );
      } else {
        setSendSuccess(
          `Dispatched: ${data.results?.sentCount || 0} sent, ${data.results?.suppressedCount || 0} suppressed, ${data.results?.failedCount || 0} failed.`
        );
      }
      setTimeout(() => setSendSuccess(null), 6000);
    } catch (err: any) {
      setError(err.message || "Failed to dispatch test digest.");
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendToMyInbox = async () => {
    try {
      setSendingTest(true);
      setError(null);

      const res = await fetch("/api/digest/send-now", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send digest.");

      setSendSuccess(data.message || `Live digest sent to your inbox (${user?.email})!`);
      setTimeout(() => setSendSuccess(null), 6000);
    } catch (err: any) {
      setError(err.message || "Failed to send digest to inbox.");
    } finally {
      setSendingTest(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xl max-w-3xl w-full h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-slate-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Email Queue Digest Preview
              </h3>
              <p className="text-[11px] text-slate-500">
                Responsive HTML preview generated with live queue data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Type selector (Supervisor only) */}
            {isSupervisor && (
              <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
                <button
                  onClick={() => setDigestType("agent")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    digestType === "agent" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Agent View
                </button>
                <button
                  onClick={() => setDigestType("supervisor")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    digestType === "supervisor" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Team View
                </button>
              </div>
            )}

            {/* Period selector */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "daily" | "weekly")}
              className="text-xs py-1 px-2 rounded border border-slate-200 bg-white text-slate-700 focus:outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>

            <Button
              variant="secondary"
              size="xs"
              onClick={loadPreview}
              icon={<RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />}
            >
              Refresh
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Banners */}
        {error && (
          <div className="p-2.5 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {sendSuccess && (
          <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{sendSuccess}</span>
          </div>
        )}

        {/* Smart Suppression Notice if triggered */}
        {previewData?.shouldSuppress && (
          <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded">
                Smart Suppression
              </span>
              <span>This email would normally be suppressed: {previewData.suppressReason}</span>
            </div>
            <span className="text-[10px] text-amber-700 font-mono">Keeps inboxes clean</span>
          </div>
        )}

        {/* Email Preview Frame */}
        <div className="flex-1 bg-slate-100 p-4 overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
              <p>Rendering email briefing...</p>
            </div>
          ) : (
            <iframe
              title="Email Digest Preview"
              srcDoc={previewHtml}
              className="w-full h-full rounded border border-slate-300 bg-white shadow-sm"
              sandbox="allow-same-origin"
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-white flex-shrink-0 text-xs">
          <div className="text-slate-500 text-[11px]">
            {isSupervisor
              ? "Supervisors can trigger a dry-run or manual dispatch to all opted-in staff."
              : "Dispatches automatically according to your frequency schedule."}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSendToMyInbox}
              loading={sendingTest}
              icon={<Send className="w-3.5 h-3.5" />}
              title="Dispatches this preview to your email inbox"
            >
              Send to My Inbox
            </Button>
            {isSupervisor && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendTestDispatch}
                loading={sendingTest}
                icon={<Send className="w-3.5 h-3.5" />}
                title="Dispatches to all opted-in staff members"
              >
                Dispatch All Staff
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigestPreviewModal;
