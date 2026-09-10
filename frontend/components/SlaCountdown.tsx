"use client";

import React, { useEffect, useState } from "react";
import { Status } from "@/lib/types";
import { Clock, AlertTriangle, AlertCircle, PauseCircle, CheckCircle2 } from "lucide-react";

interface SlaCountdownProps {
  slaDueAt: string | Date | null;
  status: Status;
  slaPausedRemainingSeconds?: number | null;
  size?: "sm" | "md";
}

export function SlaCountdown({
  slaDueAt,
  status,
  slaPausedRemainingSeconds,
  size = "md",
}: SlaCountdownProps) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (status !== "NEW" && status !== "OPEN") {
      return;
    }
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1 font-medium";

  // 1. Paused in PENDING status
  if (status === "PENDING") {
    const remainingSec = slaPausedRemainingSeconds || 0;
    const hours = Math.floor(remainingSec / 3600);
    const mins = Math.floor((remainingSec % 3600) / 60);

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 ${sizeClass}`}
      >
        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
        <span>SLA Paused ({hours > 0 ? `${hours}h ` : ""}{mins}m left)</span>
      </span>
    );
  }

  // 2. Completed in RESOLVED or CLOSED status
  if (status === "RESOLVED" || status === "CLOSED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 ${sizeClass}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>SLA Completed</span>
      </span>
    );
  }

  // 3. No deadline set
  if (!slaDueAt) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md bg-gray-50 text-gray-500 ${sizeClass}`}>
        <Clock className="w-3.5 h-3.5" />
        <span>No SLA target</span>
      </span>
    );
  }

  const dueTime = new Date(slaDueAt).getTime();
  const diffMs = dueTime - now;

  // 4. Breached
  if (diffMs <= 0) {
    const overdueSec = Math.abs(Math.floor(diffMs / 1000));
    const hours = Math.floor(overdueSec / 3600);
    const mins = Math.floor((overdueSec % 3600) / 60);
    const secs = overdueSec % 60;

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-bold ${sizeClass} animate-pulse`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        <span>
          Breached ({hours > 0 ? `-${hours}h ` : "-"}{mins}m {secs}s)
        </span>
      </span>
    );
  }

  // 5. Due Soon (within 60 mins)
  const remainingSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(remainingSec / 3600);
  const mins = Math.floor((remainingSec % 3600) / 60);
  const secs = remainingSec % 60;

  if (diffMs <= 60 * 60 * 1000) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-orange-100 text-orange-800 border border-orange-300 font-semibold ${sizeClass}`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
        <span>
          Due Soon ({hours > 0 ? `${hours}h ` : ""}{mins}m {secs}s)
        </span>
      </span>
    );
  }

  // 6. Healthy Active Clock
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClass}`}
    >
      <Clock className="w-3.5 h-3.5 text-emerald-600" />
      <span>
        {hours > 0 ? `${hours}h ` : ""}{mins}m {secs}s remaining
      </span>
    </span>
  );
}
