"use client";

import React, { useEffect, useState } from "react";
import { Status } from "@/lib/types";
import { Clock, AlertTriangle, PauseCircle, CheckCircle2 } from "lucide-react";

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
  size = "sm",
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

  const sizeClass = size === "sm" ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  // 1. Paused in PENDING status
  if (status === "PENDING") {
    const remainingSec = slaPausedRemainingSeconds || 0;
    const hours = Math.floor(remainingSec / 3600);
    const mins = Math.floor((remainingSec % 3600) / 60);

    return (
      <span
        className={`inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50/70 text-amber-800 font-medium tabular-nums ${sizeClass}`}
      >
        <PauseCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
        <span>Paused ({hours > 0 ? `${hours}h ` : ""}{mins}m left)</span>
      </span>
    );
  }

  // 2. Completed in RESOLVED or CLOSED status
  if (status === "RESOLVED" || status === "CLOSED") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 text-slate-600 font-medium ${sizeClass}`}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
        <span>Completed</span>
      </span>
    );
  }

  // 3. No deadline set
  if (!slaDueAt) {
    return (
      <span className={`inline-flex items-center gap-1 rounded text-slate-400 font-medium ${sizeClass}`}>
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span>No SLA</span>
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
        className={`inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 text-rose-700 font-medium tabular-nums ${sizeClass}`}
      >
        <AlertTriangle className="w-3 h-3 text-rose-600 flex-shrink-0" />
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
        className={`inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 text-amber-800 font-medium tabular-nums ${sizeClass}`}
      >
        <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
        <span>
          Due soon ({hours > 0 ? `${hours}h ` : ""}{mins}m {secs}s)
        </span>
      </span>
    );
  }

  // 6. Healthy Active Clock
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50/70 text-emerald-800 font-medium tabular-nums ${sizeClass}`}
    >
      <Clock className="w-3 h-3 text-emerald-600 flex-shrink-0" />
      <span>
        {hours > 0 ? `${hours}h ` : ""}{mins}m {secs}s left
      </span>
    </span>
  );
}
