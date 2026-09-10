"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User, Ticket, CustomerDashboardMetrics } from "@/lib/types";
import { ApiClient } from "@/lib/api-client";
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  PlusCircle,
  ArrowUpRight,
  Filter,
  MessageSquare,
  HelpCircle,
  Bug,
  CreditCard,
  Sparkles,
  RefreshCw,
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "BUG":
        return <Bug className="w-3.5 h-3.5 text-rose-500" />;
      case "BILLING":
        return <CreditCard className="w-3.5 h-3.5 text-amber-500" />;
      case "FEATURE":
        return <Sparkles className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const renderStatusPill = (status: string) => {
    switch (status) {
      case "NEW":
      case "OPEN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>Being worked on</span>
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            <span>Waiting for your response</span>
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Resolved</span>
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span>Closed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium mb-3">
              <span>Customer Help Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {user.name}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-lg">
              Track your open support requests, provide additional context when needed, and review past solutions.
            </p>
          </div>
          <Link
            href="/tickets/new"
            className="self-start md:self-auto inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-5 py-3 rounded-2xl shadow-lg transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit a New Request</span>
          </Link>
        </div>
      </div>

      {/* Headline Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Requests</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {metrics?.totalTicketsCount ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">all-time</span>
          </div>
        </div>

        {/* Being Worked On */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Being Worked On</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-blue-600">
              {metrics?.openTicketsCount ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">active with our team</span>
          </div>
        </div>

        {/* Waiting On You */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs hover:border-amber-300 transition bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">Action Needed</span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-amber-700">
              {metrics?.pendingOnCustomerCount ?? 0}
            </span>
            <span className="text-xs text-amber-800/80 font-medium">awaiting your reply</span>
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resolved</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-emerald-600">
              {metrics?.resolvedTicketsCount ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">completed tickets</span>
          </div>
        </div>
      </div>

      {/* Ticket List Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setFilterTab("all")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterTab === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Requests
            </button>
            <button
              onClick={() => setFilterTab("open")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterTab === "open"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Being Worked On
            </button>
            <button
              onClick={() => setFilterTab("pending")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterTab === "pending"
                  ? "bg-white text-amber-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Awaiting You
            </button>
            <button
              onClick={() => setFilterTab("resolved")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterTab === "resolved"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Resolved
            </button>
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your requests..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </form>
            <button
              onClick={() => loadData()}
              title="Refresh tickets"
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Tickets Table / List */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium text-slate-500">Loading your support tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No requests found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search
                ? `No requests match "${search}". Try searching for another keyword.`
                : "You don't have any support requests in this view right now."}
            </p>
            <div className="mt-4">
              <Link
                href="/tickets/new"
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Submit New Ticket</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="group p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition block"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 font-mono">
                      #{t.ticketNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      {getCategoryIcon(t.category)}
                      <span>{t.category}</span>
                    </span>
                    {renderStatusPill(t.status)}
                    {t.status === "PENDING" && (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>Action Required</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                    {t.subject}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {t.description}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    Updated {new Date(t.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition flex items-center gap-1">
                    <span>View Conversation</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
