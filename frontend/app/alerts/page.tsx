"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User as SessionUser } from "@/lib/types";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { SlaCountdown } from "@/components/SlaCountdown";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  User,
  ShieldAlert,
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

  const isSupervisor = user?.role === "SUPERVISOR";

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <span>SLA Response Alerts</span>
            <span className="text-xs font-normal text-slate-500 tabular-nums">({alerts.length})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSupervisor
              ? "All active tickets across the organization with breached or imminent response deadlines."
              : "Tickets assigned to you requiring immediate response action."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-xs tabular-nums">
            {alerts.filter((a) => a.type === "BREACHED").length} Breached ·{" "}
            {alerts.filter((a) => a.type === "IMMINENT").length} Imminent
          </span>
        </div>
      </div>

      {/* Alerts Feed */}
      {loading ? (
        <div className="text-center py-24 text-slate-400 text-xs">Loading active SLA alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-md border border-slate-200 shadow-xs">
          <EmptyState
            icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
            title="All Queue SLAs Healthy"
            description="All active tickets in the queue are currently within their response commitment windows."
            action={
              <Button variant="secondary" size="xs" onClick={() => router.push("/tickets")}>
                View Ticket Queue
              </Button>
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-md border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {alerts.map((a) => {
            const isBreached = a.type === "BREACHED";
            const t = a.ticket;

            return (
              <div
                key={a.id}
                className="p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                {/* Left: Ticket Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-medium text-slate-500">
                      #{t.ticketNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[11px] font-medium ${
                        isBreached
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {isBreached ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Breached</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Due Soon</span>
                        </>
                      )}
                    </span>
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} size="sm" />
                    <span className="text-[10px] text-slate-400 font-mono">Cycle #{t.slaCycle}</span>
                  </div>

                  <a
                    href={`/tickets/${t.id}`}
                    className="block font-medium text-xs text-slate-900 hover:underline truncate"
                  >
                    {t.subject}
                  </a>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>
                        Assignee: <strong className="text-slate-700 font-medium">{t.primaryAssignee?.name || "Unassigned"}</strong>
                      </span>
                    </div>
                    <span>·</span>
                    <div>
                      Requester: <span className="text-slate-700">{t.requesterName}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Countdown & Actions */}
                <div className="flex items-center gap-2.5 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <SlaCountdown
                    slaDueAt={t.slaDueAt}
                    status={t.status}
                    size="sm"
                  />

                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => handleAcknowledge(a.id, t.id)}
                    loading={actionLoading}
                  >
                    Acknowledge
                  </Button>

                  <a href={`/tickets/${t.id}`}>
                    <Button variant="primary" size="xs" icon={<ArrowRight className="w-3 h-3" />}>
                      Open
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
