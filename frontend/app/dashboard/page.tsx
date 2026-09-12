"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { DashboardMetrics, Status } from "@/lib/types";
import { CustomerDashboard } from "@/components/customer/CustomerDashboard";
import { DashboardSkeleton } from "@/components/ui/Skeletons";
import { Button } from "@/components/ui/Button";
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Star,
  ExternalLink,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [metrics, setMetrics] = useState<DashboardMetrics | any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok && isMounted) {
          const dashData = await res.json();
          setMetrics(dashData);
        }
      } catch {
        // fallback handle
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  if (sessionLoading || loading || !user) {
    return <DashboardSkeleton />;
  }

  // If authenticated user is a CUSTOMER, render the tailored Customer Help Center Dashboard
  if (user.role === "CUSTOMER") {
    return <CustomerDashboard user={user} />;
  }

  if (!metrics || !metrics.statusBreakdown) {
    return <DashboardSkeleton />;
  }

  const isSupervisor = user.role === "SUPERVISOR";

  const totalTicketsCount = metrics.statusBreakdown.reduce((acc: number, curr: any) => acc + curr.count, 0) || 1;
  const onTimePercentage = metrics.slaComplianceRate ?? (
    totalTicketsCount > 0
      ? Math.max(0, Math.min(100, Math.round(((totalTicketsCount - metrics.breachingSlaCount) / totalTicketsCount) * 100)))
      : 100
  );
  const breachedPercentage = 100 - onTimePercentage;

  // Max value for agent workload chart scaling
  const maxAgentTickets = Math.max(1, ...metrics.agentBreakdown.map((a: any) => a.activeTicketsCount));

  // Max value for 8-week trend chart
  const maxWeeklyResolved = Math.max(
    1,
    ...metrics.weeklyResolutionTrend.map((w: any) => w.resolvedCount)
  );

  // Proportional multi-segment SVG Donut calculation (circumference = 2 * PI * 38 ≈ 238.76)
  const statusColors: Record<Status, string> = {
    NEW: "#3b82f6",
    OPEN: "#1e293b",
    PENDING: "#f59e0b",
    RESOLVED: "#059669",
    CLOSED: "#94a3b8",
  };

  let cumulativeLength = 0;
  const donutSegments = metrics.statusBreakdown.map((s: any) => {
    const segmentLength = (s.count / totalTicketsCount) * 238.76;
    const offset = -cumulativeLength;
    cumulativeLength += segmentLength;
    return {
      status: s.status as Status,
      count: s.count,
      color: statusColors[s.status as Status] || "#94a3b8",
      strokeDasharray: `${segmentLength} ${238.76 - segmentLength}`,
      strokeDashoffset: offset,
    };
  });

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            {isSupervisor ? "Supervisor Dashboard" : "Agent Dashboard"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSupervisor
              ? "Department-wide queue throughput, agent capacity, and SLA compliance metrics."
              : "Overview of your assigned workload and active customer requests."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>This Week</span>
          </div>
          <a href="/tickets">
            <Button variant="primary" size="sm" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
              View Queue
            </Button>
          </a>
        </div>
      </div>

      {/* 4 Headline Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Open Tickets */}
        <a
          href="/tickets?status=OPEN"
          className="bg-white p-4 rounded-md border border-slate-200 shadow-xs hover:border-slate-300 transition-colors block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {isSupervisor ? "Open Tickets" : "My Open Tickets"}
            </span>
            <Inbox className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
              {metrics.openTicketsCount}
            </div>
            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
              Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Tickets in progress</p>
        </a>

        {/* Card 2: Pending on Customer */}
        <a
          href="/tickets?scope=awaiting_customer"
          className="bg-white p-4 rounded-md border border-slate-200 shadow-xs hover:border-slate-300 transition-colors block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Customer</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
              {metrics.pendingOnCustomerCount}
            </div>
            <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
              Awaiting
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Waiting on customer response</p>
        </a>

        {/* Card 3: Resolved This Week */}
        <a
          href="/tickets?status=RESOLVED"
          className="bg-white p-4 rounded-md border border-slate-200 shadow-xs hover:border-slate-300 transition-colors block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Resolved This Week</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
              {metrics.resolvedThisWeekCount}
            </div>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              Resolved
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Successfully closed</p>
        </a>

        {/* Card 4: Breaching SLA */}
        <a
          href="/alerts"
          className="bg-white p-4 rounded-md border border-slate-200 shadow-xs hover:border-slate-300 transition-colors block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">SLA Breaches</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className={`text-2xl font-semibold tabular-nums tracking-tight ${metrics.breachingSlaCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {metrics.breachingSlaCount}
            </div>
            <span
              className={`text-[11px] font-medium px-1.5 py-0.2 rounded border ${
                metrics.breachingSlaCount > 0
                  ? "text-rose-700 bg-rose-50 border-rose-200"
                  : "text-slate-600 bg-slate-100 border-slate-200"
              }`}
            >
              {metrics.breachingSlaCount > 0 ? "Action required" : "Healthy"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Overdue response commitments</p>
        </a>
      </div>

      {/* CSAT Performance Card */}
      {metrics.csatResponseCount !== undefined && (
        <div className="bg-white rounded-md p-4 border border-slate-200 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {isSupervisor ? "Department Customer Satisfaction (CSAT)" : "My Customer Satisfaction (CSAT)"}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSupervisor ? (
                  <>Based on <span className="font-semibold text-slate-800">{metrics.csatResponseCount}</span> customer ratings submitted team-wide upon ticket resolution.</>
                ) : (
                  <>Based on <span className="font-semibold text-slate-800">{metrics.csatResponseCount}</span> customer ratings submitted on your assigned tickets.</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                  {metrics.averageCsatRating > 0 ? metrics.averageCsatRating.toFixed(1) : "N/A"}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ 5.0</span>
                <div className="flex items-center gap-0.5 ml-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= Math.round(metrics.averageCsatRating || 0)
                          ? "text-amber-500 fill-amber-500"
                          : "text-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Rating Distribution Bar */}
              {metrics.csatRatingDistribution && (
                <div className="hidden sm:flex flex-col gap-1 w-44 border-l border-slate-200 pl-4 text-[10px]">
                  {metrics.csatRatingDistribution.map((item: any) => {
                    const pct = metrics.csatResponseCount
                      ? Math.round((item.count / metrics.csatResponseCount) * 100)
                      : 0;
                    return (
                      <div key={item.rating} className="flex items-center gap-2">
                        <span className="w-4 text-slate-500 font-mono">{item.rating}★</span>
                        <div className="flex-1 bg-slate-100 rounded h-1.5 overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="bg-slate-700 h-1.5 rounded"
                          />
                        </div>
                        <span className="w-5 text-right font-medium text-slate-600 tabular-nums">{item.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mid Row: Tickets by Status & Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Status Distribution */}
        <div className="lg:col-span-6 bg-white p-4 rounded-md border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Queue by Status</h2>
            <span className="text-xs text-slate-500 tabular-nums font-medium">{totalTicketsCount} total</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
            {/* Accurate Proportional SVG Donut */}
            <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="text-slate-100"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                {donutSegments.map((seg: any) => (
                  <circle
                    key={seg.status}
                    cx="50"
                    cy="50"
                    r="38"
                    stroke={seg.color}
                    strokeWidth="8"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    fill="transparent"
                  />
                ))}
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-slate-900 tabular-nums">{totalTicketsCount}</span>
                <span className="text-[10px] text-slate-400 font-medium">Tickets</span>
              </div>
            </div>

            {/* Status Legend Breakdown */}
            <div className="flex-1 w-full space-y-2">
              {metrics.statusBreakdown.map((s: any) => {
                const statusLabels: Record<Status, { dot: string; label: string }> = {
                  NEW: { dot: "bg-blue-500", label: "New" },
                  OPEN: { dot: "bg-slate-800", label: "Open" },
                  PENDING: { dot: "bg-amber-500", label: "Pending" },
                  RESOLVED: { dot: "bg-emerald-600", label: "Resolved" },
                  CLOSED: { dot: "bg-slate-400", label: "Closed" },
                };
                const config = statusLabels[s.status as Status] || { dot: "bg-slate-400", label: s.status };

                return (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                      <span className="text-slate-700">{config.label}</span>
                    </div>
                    <span className="font-semibold text-slate-900 tabular-nums">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tickets by Agent Horizontal Bars */}
        <div className="lg:col-span-6 bg-white p-4 rounded-md border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Agent Workload</h2>
            <span className="text-xs text-slate-500">Active tickets</span>
          </div>

          <div className="space-y-3 pt-1">
            {metrics.agentBreakdown.map((agent: any) => {
              const widthPct = Math.max(6, Math.round((agent.activeTicketsCount / maxAgentTickets) * 100));

              return (
                <div key={agent.agentId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{agent.agentName}</span>
                    <span className="font-mono font-medium text-slate-900 tabular-nums">{agent.activeTicketsCount}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded h-2 overflow-hidden">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className="bg-slate-800 h-2 rounded transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lower Row: 8-Week Historical Trend & SLA Performance Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 8-Week Historical Resolution Trend Chart */}
        <div className="lg:col-span-7 bg-white p-4 rounded-md border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Weekly Resolution Volume
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                8-week rolling volume of resolved support tickets
              </p>
            </div>
            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 tabular-nums">
              Total:{" "}
              {metrics.weeklyResolutionTrend.reduce((acc: number, curr: any) => acc + curr.resolvedCount, 0)}
            </span>
          </div>

          {/* Minimal Bar Chart */}
          <div className="grid grid-cols-8 gap-2.5 items-end h-40 pt-4 pb-1 border-b border-slate-100">
            {metrics.weeklyResolutionTrend.map((week: any, idx: number) => {
              const heightPct = Math.max(8, Math.round((week.resolvedCount / maxWeeklyResolved) * 100));
              const isLatest = idx === metrics.weeklyResolutionTrend.length - 1;

              return (
                <div key={week.weekStart} className="flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] font-mono text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                    {week.resolvedCount}
                  </div>
                  <div className="w-full max-w-[28px] bg-slate-100 rounded-t overflow-hidden flex items-end h-full">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all ${
                        isLatest ? "bg-slate-900" : "bg-slate-400 group-hover:bg-slate-600"
                      }`}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 text-center truncate w-full">
                    {week.weekLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA Performance Compliance */}
        <div className="lg:col-span-5 bg-white p-4 rounded-md border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">SLA Compliance</h2>
              <span className="text-xs text-slate-500">Live commitments</span>
            </div>
            <p className="text-xs text-slate-500">
              Percentage of tickets currently meeting SLA response time targets.
            </p>
          </div>

          <div className="flex items-center justify-around py-3">
            {/* Minimal Donut Gauge */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="text-slate-100"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="text-emerald-600"
                  strokeWidth="8"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - onTimePercentage / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-slate-900 tabular-nums">{onTimePercentage}%</span>
                <span className="text-[10px] text-emerald-700 font-medium">On time</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span className="text-slate-600">On Time</span>
                <span className="font-semibold text-slate-900 ml-3 tabular-nums">{onTimePercentage}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600">Breached</span>
                <span className="font-semibold text-slate-900 ml-3 tabular-nums">{breachedPercentage}%</span>
              </div>
            </div>
          </div>

          <a href="/alerts">
            <Button variant="secondary" size="sm" className="w-full" icon={<ExternalLink className="w-3 h-3 text-slate-400" />}>
              View SLA Alerts
            </Button>
          </a>
        </div>
      </div>

      {/* Recent Customer Reviews Feed */}
      {metrics.recentReviews && metrics.recentReviews.length > 0 && (
        <div className="bg-white rounded-md p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Recent Customer Reviews
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Latest customer feedback and satisfaction ratings
              </p>
            </div>
            <span className="text-xs text-slate-500 tabular-nums font-medium">
              {metrics.recentReviews.length} latest reviews
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {metrics.recentReviews.map((rev: any) => (
              <div
                key={rev.id}
                className="p-3.5 rounded border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-colors flex flex-col justify-between text-xs space-y-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= rev.rating
                              ? "text-amber-500 fill-amber-500"
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-slate-800 ml-1">
                        {rev.rating}.0
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {rev.comment ? (
                    <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded border border-slate-100 line-clamp-3">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No written feedback provided.</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <a
                    href={`/tickets/${rev.ticket.id}`}
                    className="font-medium text-slate-900 hover:text-blue-600 truncate flex items-center gap-1 group max-w-[65%]"
                  >
                    <span className="font-mono text-slate-400">#{rev.ticket.ticketNumber}</span>
                    <span className="truncate group-hover:underline">{rev.ticket.subject}</span>
                  </a>
                  <span className="text-slate-500 truncate text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 max-w-[30%]">
                    {rev.user.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
