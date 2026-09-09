"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Role, SlaAlertType, Status } from "@prisma/client";
import { SessionUser } from "@/lib/types";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { SlaCountdown } from "@/components/SlaCountdown";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Inbox,
  User,
} from "lucide-react";

export default function AlertsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/sla/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((d) => setUser(d.user));

    loadAlerts();
    const interval = setInterval(loadAlerts, 15000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const handleAcknowledge = async (alertId: string, ticketId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/acknowledge-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to acknowledge alert.");
      }

      loadAlerts();
    } catch (err: any) {
      alert(err.message || "Failed to acknowledge alert.");
    } finally {
      setActionLoading(false);
    }
  };

  const isSupervisor = user?.role === Role.SUPERVISOR;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>SLA Alerts Management</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Active SLA Breach & Risk Alerts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSupervisor
              ? "All active tickets across the company that have breached or are at risk of breaching customer response commitments."
              : "Active tickets assigned to you requiring immediate customer response."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
            {alerts.length} Active Alert{alerts.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Alerts Feed */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading active SLA alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No active SLA alerts</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All tickets in your queue are currently within safe response target windows.
          </p>
          <button
            onClick={() => router.push("/tickets")}
            className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition"
          >
            View Full Queue
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => {
            const isBreached = a.type === SlaAlertType.BREACHED;
            const t = a.ticket;

            return (
              <div
                key={a.id}
                className={`p-5 rounded-2xl border transition shadow-sm ${
                  isBreached
                    ? "bg-rose-50/50 border-rose-200 hover:border-rose-300"
                    : "bg-orange-50/40 border-orange-200 hover:border-orange-300"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Left: Ticket Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-sm text-indigo-600">
                        #{t.ticketNumber}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          isBreached
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : "bg-orange-100 text-orange-800 border border-orange-300"
                        }`}
                      >
                        {isBreached ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Breached Target</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-orange-600" />
                            <span>Due Soon (Within 60m)</span>
                          </>
                        )}
                      </span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} size="sm" />
                      <span className="text-[10px] text-slate-400 font-mono">
                        Cycle #{t.slaCycle}
                      </span>
                    </div>

                    <a
                      href={`/tickets/${t.id}`}
                      className="block font-bold text-base text-slate-900 hover:text-indigo-600 transition"
                    >
                      {t.subject}
                    </a>

                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Assignee:{" "}
                          <strong className="text-slate-800 font-semibold">
                            {t.primaryAssignee?.name || "Unassigned"}
                          </strong>
                        </span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Target:{" "}
                          <strong className="text-slate-800 font-semibold">
                            {t.slaDueAt ? new Date(t.slaDueAt).toLocaleTimeString() : "N/A"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Live Countdown & Acknowledge Button */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200">
                    <SlaCountdown
                      slaDueAt={t.slaDueAt}
                      status={t.status}
                      size="md"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcknowledge(a.id, t.id)}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition"
                      >
                        Acknowledge Alert
                      </button>

                      <a
                        href={`/tickets/${t.id}`}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                      >
                        <span>Open Ticket</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
