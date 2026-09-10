import React from "react";
import { Status } from "@/lib/types";

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-semibold";

  switch (status) {
    case "NEW":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          New
        </span>
      );
    case "OPEN":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Open
        </span>
      );
    case "PENDING":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pending Customer
        </span>
      );
    case "RESOLVED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
          Resolved
        </span>
      );
    case "CLOSED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Closed
        </span>
      );
    default:
      return <span className={`rounded-full bg-gray-100 text-gray-700 ${sizeClasses}`}>{status}</span>;
  }
}
