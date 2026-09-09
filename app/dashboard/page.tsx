import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { DashboardService } from "@/lib/services/DashboardService";
import { Role, Status } from "@prisma/client";
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
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const metrics = await DashboardService.getMetrics();
  const isSupervisor = user.role === Role.SUPERVISOR;

  // Find max resolved in 8 weeks for scaling the bar chart
  const maxWeeklyResolved = Math.max(
    1,
    ...metrics.weeklyResolutionTrend.map((w) => w.resolvedCount)
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                isSupervisor
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {isSupervisor ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <Headphones className="w-3.5 h-3.5" />
              )}
              {isSupervisor ? "Supervisor View" : "Support Agent View"}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">Live Team Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isSupervisor
              ? "Here is the operational overview across the entire support queue."
              : "Track active queue SLAs, customer response times, and team resolution progress."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/tickets"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <span>Open Queue</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* 4 Headline Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Open Tickets */}
        <a
          href="/tickets?status=OPEN"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Open Tickets
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {metrics.openTicketsCount}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <span>Active tickets currently in progress</span>
          </div>
        </a>

        {/* Card 2: Pending on Customer */}
        <a
          href="/tickets?scope=awaiting_customer"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending on Customer
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {metrics.pendingOnCustomerCount}
          </div>
          <div className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
            <span>SLA clock paused awaiting response</span>
          </div>
        </a>

        {/* Card 3: Resolved This Week */}
        <a
          href="/tickets?status=RESOLVED"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Resolved This Week
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {metrics.resolvedThisWeekCount}
          </div>
          <div className="text-xs text-indigo-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Resolutions since Monday</span>
          </div>
        </a>

        {/* Card 4: SLA Breaches */}
        <a
          href="/alerts"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Breaching SLA
            </span>
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-600 mt-2">
            {metrics.breachingSlaCount}
          </div>
          <div className="text-xs text-rose-700 font-medium mt-1">
            {metrics.breachingSlaCount > 0 ? "Requires immediate agent action" : "All active queues on target"}
          </div>
        </a>
      </div>

      {/* 8-Week Historical Resolution Trend Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span>Resolved Tickets Trend (Last 8 Weeks)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Weekly resolution volume aggregated in PostgreSQL over continuous weekly cohorts
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
            8-Week Total:{" "}
            <span className="text-indigo-600 font-bold">
              {metrics.weeklyResolutionTrend.reduce((acc, curr) => acc + curr.resolvedCount, 0)}
            </span>{" "}
            tickets
          </div>
        </div>

        {/* CSS / SVG Bar Chart */}
        <div className="grid grid-cols-8 gap-2 sm:gap-4 items-end h-56 pt-8 pb-4 border-b border-slate-100">
          {metrics.weeklyResolutionTrend.map((week, idx) => {
            const heightPercent = Math.max(8, (week.resolvedCount / maxWeeklyResolved) * 100);
            const isLatest = idx === metrics.weeklyResolutionTrend.length - 1;

            return (
              <div key={week.weekStart} className="flex flex-col items-center h-full justify-end group">
                <div className="text-xs font-bold text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition">
                  {week.resolvedCount}
                </div>
                <div className="w-full max-w-[48px] bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-full">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isLatest
                        ? "bg-indigo-600 group-hover:bg-indigo-700"
                        : "bg-indigo-400 group-hover:bg-indigo-500"
                    }`}
                  />
                </div>
                <div className="text-[11px] font-medium text-slate-500 mt-2 text-center whitespace-nowrap">
                  {week.weekLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Status Distribution & Agent Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Distribution */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-600" />
            <span>Queue Breakdown by Status</span>
          </h2>

          <div className="space-y-3">
            {metrics.statusBreakdown.map((sb) => {
              const totalActive = metrics.statusBreakdown.reduce((a, b) => a + b.count, 0) || 1;
              const pct = Math.round((sb.count / totalActive) * 100);

              return (
                <div
                  key={sb.status}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={sb.status} size="sm" />
                    <span className="text-xs text-slate-500">{pct}% of total</span>
                  </div>
                  <div className="text-sm font-bold text-slate-800">{sb.count} tickets</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agent Workload Distribution */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Active Agent Workload</span>
            </h2>
            <span className="text-xs text-slate-400">Assigned Open Tickets</span>
          </div>

          <div className="space-y-3">
            {metrics.agentBreakdown.map((agent) => (
              <div
                key={agent.agentId}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    {agent.agentName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{agent.agentName}</div>
                    <div className="text-xs text-slate-500">{agent.agentEmail}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-slate-800">
                    {agent.activeTicketsCount} active
                  </div>
                  <a
                    href={`/tickets?assigneeId=${agent.agentId}`}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-0.5"
                  >
                    View Queue &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
