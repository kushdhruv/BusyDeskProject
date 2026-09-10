"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, DashboardMetrics, Status } from "@/lib/types";
import { CustomerDashboard } from "@/components/customer/CustomerDashboard";
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Headphones,
  Calendar,
  AlertCircle,
  ExternalLink,
  Loader2,
  Star,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, dashRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/dashboard"),
        ]);

        if (!meRes.ok) {
          router.push("/login");
          return;
        }

        const meData = await meRes.json();
        setUser(meData.user || null);

        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setMetrics(dashData);
        }
      } catch {
        // fallback handle
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-xs">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        Loading Dashboard...
      </div>
    );
  }

  // If authenticated user is a CUSTOMER, render the tailored Customer Help Center Dashboard
  if (user.role === "CUSTOMER") {
    return <CustomerDashboard user={user} />;
  }

  if (!metrics || !metrics.statusBreakdown) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-xs">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        Loading Dashboard metrics...
      </div>
    );
  }

  const isSupervisor = user.role === "SUPERVISOR";

  const totalTicketsCount = metrics.statusBreakdown.reduce((acc: number, curr: any) => acc + curr.count, 0) || 1;
  const onTimePercentage = Math.round(
    ((totalTicketsCount - metrics.breachingSlaCount) / totalTicketsCount) * 100
  );
  const breachedPercentage = 100 - onTimePercentage;

  // Max value for agent workload chart scaling
  const maxAgentTickets = Math.max(1, ...metrics.agentBreakdown.map((a: any) => a.activeTicketsCount));

  // Max value for 8-week trend chart
  const maxWeeklyResolved = Math.max(
    1,
    ...metrics.weeklyResolutionTrend.map((w: any) => w.resolvedCount)
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {isSupervisor ? "Supervisor Dashboard" : "Agent Dashboard"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSupervisor
              ? "Comprehensive overview of queue health, agent workloads, and SLA metrics."
              : "Here's a quick overview of your assigned and collaborative tickets."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>This Week</span>
          </div>
          <a
            href="/tickets"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <span>View All Queue</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 4 Headline Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Open Tickets */}
        <a
          href="/tickets?status=OPEN"
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 hover:shadow-md transition card-hover block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isSupervisor ? "Open Tickets" : "My Open Tickets"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-bold text-slate-900">{metrics.openTicketsCount}</div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active tickets in progress</p>
        </a>

        {/* Card 2: Pending on Customer */}
        <a
          href="/tickets?scope=awaiting_customer"
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-amber-300 hover:shadow-md transition card-hover block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-bold text-slate-900">{metrics.pendingOnCustomerCount}</div>
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              Awaiting
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Waiting on customer reply</p>
        </a>

        {/* Card 3: Resolved This Week */}
        <a
          href="/tickets?status=RESOLVED"
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 hover:shadow-md transition card-hover block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Resolved</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-bold text-slate-900">{metrics.resolvedThisWeekCount}</div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              Resolved
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Closed or resolved this week</p>
        </a>

        {/* Card 4: Breaching SLA */}
        <a
          href="/alerts"
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-rose-300 hover:shadow-md transition card-hover block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Breaching SLA</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-bold text-rose-600">{metrics.breachingSlaCount}</div>
            <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
              {metrics.breachingSlaCount > 0 ? "Action Required" : "Healthy"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Tickets overdue past response target</p>
        </a>
      </div>

      {/* Supervisor CSAT Card */}
      {isSupervisor && metrics.csatResponseCount !== undefined && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-indigo-500/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-semibold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>Customer Satisfaction (CSAT)</span>
              </div>
              <h2 className="text-base font-bold">Overall Customer CSAT Score</h2>
              <p className="text-xs text-slate-300">
                Aggregated from {metrics.csatResponseCount} customer ratings on resolved tickets.
              </p>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="flex items-center gap-1">
                  <span className="text-3xl font-extrabold text-white">
                    {metrics.averageCsatRating > 0 ? metrics.averageCsatRating.toFixed(1) : "N/A"}
                  </span>
                  <span className="text-xs text-amber-400 font-bold">/ 5.0</span>
                </div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= Math.round(metrics.averageCsatRating || 0)
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Rating Distribution Bar */}
              {metrics.csatRatingDistribution && (
                <div className="hidden sm:flex flex-col gap-1 w-48 border-l border-white/10 pl-6 text-[10px]">
                  {metrics.csatRatingDistribution.map((item: any) => {
                    const pct = metrics.csatResponseCount
                      ? Math.round((item.count / metrics.csatResponseCount) * 100)
                      : 0;
                    return (
                      <div key={item.rating} className="flex items-center gap-2">
                        <span className="w-5 text-slate-400 font-medium">{item.rating} ★</span>
                        <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="bg-amber-400 h-1.5 rounded-full"
                          />
                        </div>
                        <span className="w-6 text-right font-medium text-slate-300">{item.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mid Row: Tickets by Status Donut & Tickets by Agent Horizontal Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Distribution with SVG Donut */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Tickets by Status</h2>
            <span className="text-xs text-slate-400 font-medium">{totalTicketsCount} Total</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-8 py-2">
            {/* SVG Donut Visual */}
            <div className="relative w-40 h-40 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="text-slate-100"
                  strokeWidth="12"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="text-blue-500"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - (metrics.openTicketsCount / totalTicketsCount || 0.4))}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="text-amber-400"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - (metrics.pendingOnCustomerCount / totalTicketsCount || 0.15))}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-slate-900">{totalTicketsCount}</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Total
                </span>
              </div>
            </div>

            {/* Status Legend Breakdown */}
            <div className="flex-1 w-full space-y-2.5">
              {metrics.statusBreakdown.map((s: any) => {
                const statusColors: Record<Status, { dot: string; label: string }> = {
                  NEW: { dot: "bg-cyan-500", label: "New" },
                  OPEN: { dot: "bg-blue-600", label: "Open" },
                  PENDING: { dot: "bg-amber-500", label: "Pending" },
                  RESOLVED: { dot: "bg-emerald-500", label: "Resolved" },
                  CLOSED: { dot: "bg-slate-400", label: "Closed" },
                };
                const config = statusColors[s.status as Status] || { dot: "bg-slate-400", label: s.status };

                return (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                      <span className="font-medium text-slate-700">{config.label}</span>
                    </div>
                    <span className="font-bold text-slate-900">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tickets by Agent Horizontal Bars */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Tickets by Agent</h2>
            <span className="text-xs text-slate-400">Assigned Open Workload</span>
          </div>

          <div className="space-y-4 pt-1">
            {metrics.agentBreakdown.map((agent: any) => {
              const widthPct = Math.max(8, Math.round((agent.activeTicketsCount / maxAgentTickets) * 100));

              return (
                <div key={agent.agentId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{agent.agentName}</span>
                    <span className="font-bold text-slate-900">{agent.activeTicketsCount}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lower Row: 8-Week Historical Trend & SLA Performance Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 8-Week Historical Resolution Trend Chart */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span>Tickets Resolved per Week</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Weekly resolution volume over the past 8 continuous cohorts
              </p>
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              8-Week Total:{" "}
              {metrics.weeklyResolutionTrend.reduce((acc: number, curr: any) => acc + curr.resolvedCount, 0)}
            </span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="grid grid-cols-8 gap-3 items-end h-44 pt-6 pb-2 border-b border-slate-100">
            {metrics.weeklyResolutionTrend.map((week: any, idx: number) => {
              const heightPct = Math.max(10, Math.round((week.resolvedCount / maxWeeklyResolved) * 100));
              const isLatest = idx === metrics.weeklyResolutionTrend.length - 1;

              return (
                <div key={week.weekStart} className="flex flex-col items-center h-full justify-end group">
                  <div className="text-[11px] font-bold text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition">
                    {week.resolvedCount}
                  </div>
                  <div className="w-full max-w-[36px] bg-slate-100 rounded-t-md overflow-hidden flex items-end h-full">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isLatest
                          ? "bg-indigo-600 group-hover:bg-indigo-700"
                          : "bg-indigo-400/80 group-hover:bg-indigo-500"
                      }`}
                    />
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 mt-2 text-center whitespace-nowrap">
                    {week.weekLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA Performance Gauge */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-1">SLA Performance</h2>
            <p className="text-[11px] text-slate-500">Live response time target compliance</p>
          </div>

          <div className="flex items-center justify-around py-4">
            {/* Donut Gauge */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="text-slate-100"
                  strokeWidth="10"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="text-emerald-500"
                  strokeWidth="10"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - onTimePercentage / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-slate-900">{onTimePercentage}%</span>
                <span className="text-[10px] text-emerald-600 font-semibold">On Time</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-600">On Time</span>
                <span className="font-bold text-slate-900 ml-auto">{onTimePercentage}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-slate-600">Breached</span>
                <span className="font-bold text-slate-900 ml-auto">{breachedPercentage}%</span>
              </div>
            </div>
          </div>

          <a
            href="/alerts"
            className="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-lg border border-slate-200 transition flex items-center justify-center gap-1.5"
          >
            <span>View All SLA Alerts</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
