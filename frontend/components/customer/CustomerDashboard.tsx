"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User, Ticket, CustomerDashboardMetrics } from "@/lib/types";
import { ApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CustomerDashboardSkeleton } from "@/components/ui/Skeletons";
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

interface CustomerDashboardProps {
  user: User;
}

export function CustomerDashboard({ user }: CustomerDashboardProps) {
  const [metrics, setMetrics] = useState<CustomerDashboardMetrics | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "open" | "pending" | "resolved">("all");

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Metrics
      const metricData = await ApiClient.getDashboard();
      setMetrics(metricData);

      // 2. Fetch Customer Queue
      const queueParams: any = {};
      if (search.trim()) queueParams.search = search.trim();
      if (filterTab === "open") queueParams.status = "OPEN";
      if (filterTab === "pending") queueParams.status = "PENDING";
      if (filterTab === "resolved") queueParams.status = "RESOLVED";

      const queueRes = await ApiClient.getQueue(queueParams);
      setTickets(queueRes.tickets || []);
    } catch (err) {
      console.error("Failed to load customer dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  if (loading && !metrics) {
    return <CustomerDashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      {/* Welcome Header */}
      <div className="bg-white rounded-md p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Customer Help Center
          </span>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight mt-0.5">
            Welcome back, {user.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track your open support requests, reply to inquiries, and view resolution history.
          </p>
        </div>

        <Link href="/tickets/new">
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
            Submit a Request
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-md p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Requests</span>
            <Inbox className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics?.totalTicketsCount ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">all-time</span>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">In Progress</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics?.openTicketsCount ?? 0}
            </span>
            <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
              Active
            </span>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Action Needed</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics?.pendingOnCustomerCount ?? 0}
            </span>
            <span className="text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
              Awaiting reply
            </span>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics?.resolvedTicketsCount ?? 0}
            </span>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              Completed
            </span>
          </div>
        </div>
      </div>

      {/* Ticket List Section */}
      <div className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto text-xs">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                filterTab === "all"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Requests
            </button>
            <button
              onClick={() => setFilterTab("open")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                filterTab === "open"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilterTab("pending")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                filterTab === "pending"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Awaiting You
            </button>
            <button
              onClick={() => setFilterTab("resolved")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                filterTab === "resolved"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Resolved
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="w-full sm:w-64 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your requests..."
              className="pl-8 h-8"
            />
          </form>
        </div>

        {/* Tickets Feed */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading requests...</div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-8 h-8 text-slate-400" />}
            title="No support requests found"
            description="You do not have any requests matching your current filter criteria."
            action={
              <Link href="/tickets/new">
                <Button variant="primary" size="xs">
                  Submit a Request
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors block text-xs"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500">#{t.ticketNumber}</span>
                    <StatusBadge status={t.status} size="sm" />
                    <span className="text-[11px] text-slate-400 font-medium">{t.category}</span>
                  </div>
                  <h3 className="font-medium text-slate-900 truncate">{t.subject}</h3>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>Opened {new Date(t.createdAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {(t as any)._count?.replies ?? 0} replies
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-400 flex-shrink-0">
                  <span className="text-xs text-slate-500 hidden sm:inline">View details</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
