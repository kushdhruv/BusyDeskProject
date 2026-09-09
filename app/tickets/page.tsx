"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Role, Priority, Category, Status } from "@prisma/client";
import { SessionUser, BulkActionResponse } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge, CategoryBadge } from "@/components/PriorityBadge";
import { SlaCountdown } from "@/components/SlaCountdown";
import { BulkResultsModal } from "@/components/BulkResultsModal";
import {
  Search,
  Filter,
  Download,
  Plus,
  Users,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Shield,
  Layers,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";

interface TicketItem {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  priority: Priority;
  category: Category;
  status: Status;
  primaryAssigneeId: string | null;
  primaryAssignee: { id: string; name: string; email: string } | null;
  collaborators: { user: { id: string; name: string; email: string } }[];
  slaDueAt: string | null;
  slaPausedRemainingSeconds: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { replies: number };
}

function TicketsQueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalCount: 0,
    totalPages: 1,
  });

  // Filter States
  const [search, setSearch] = useState<string>(searchParams.get("search") || "");
  const [status, setStatus] = useState<string>(searchParams.get("status") || "");
  const [priority, setPriority] = useState<string>(searchParams.get("priority") || "");
  const [category, setCategory] = useState<string>(searchParams.get("category") || "");
  const [assigneeId, setAssigneeId] = useState<string>(searchParams.get("assigneeId") || "");
  const [scope, setScope] = useState<string>(searchParams.get("scope") || "all");
  const [sort, setSort] = useState<string>(searchParams.get("sort") || "createdAt");
  const [order, setOrder] = useState<string>(searchParams.get("order") || "desc");
  const [page, setPage] = useState<number>(
    searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1
  );

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"REASSIGN" | "CLOSE" | "">("");
  const [bulkTargetAssignee, setBulkTargetAssignee] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkResultData, setBulkResultData] = useState<BulkActionResponse | null>(null);

  // Fetch Current User
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((d) => setUser(d.user));

    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((d) => setAgents(d.users || []));
  }, []);

  // Fetch Queue Data
  const loadQueue = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (priority) query.set("priority", priority);
    if (category) query.set("category", category);
    if (assigneeId) query.set("assigneeId", assigneeId);
    if (scope) query.set("scope", scope);
    if (sort) query.set("sort", sort);
    if (order) query.set("order", order);
    query.set("page", page.toString());
    query.set("limit", "15");

    try {
      const res = await fetch(`/api/tickets?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        setPagination(data.pagination);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, status, priority, category, assigneeId, scope, sort, order, page]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Handle Bulk Selection
  const toggleSelectAll = () => {
    if (selectedIds.length === tickets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tickets.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Execute Bulk Action
  const handleExecuteBulk = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "REASSIGN" && !bulkTargetAssignee) {
      alert("Please select a target agent to reassign to.");
      return;
    }

    setBulkLoading(true);
    try {
      const res = await fetch("/api/tickets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketIds: selectedIds,
          action: bulkAction,
          targetAssigneeId: bulkAction === "REASSIGN" ? bulkTargetAssignee : undefined,
        }),
      });

      const data = await res.json();
      setBulkResultData(data);
      setBulkModalOpen(true);
      setSelectedIds([]);
      setBulkAction("");
      setBulkTargetAssignee("");
      loadQueue();
    } catch (err: any) {
      alert(err.message || "Bulk action failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  // CSV Export Trigger
  const handleExportCsv = () => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (priority) query.set("priority", priority);
    if (category) query.set("category", category);
    if (assigneeId) query.set("assigneeId", assigneeId);
    if (scope) query.set("scope", scope);

    window.open(`/api/tickets/export?${query.toString()}`, "_blank");
  };

  const isSupervisor = user?.role === Role.SUPERVISOR;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support Ticket Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSupervisor
              ? "Global company queue — filter, reassign, and manage support workloads"
              : "Your active ticket assignments and collaborations"}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <a
            href="/tickets/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Ticket</span>
          </a>
        </div>
      </div>

      {/* Scope Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => {
            setScope("all");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            scope === "all"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          {isSupervisor ? "All Active Tickets" : "All My Work"}
        </button>

        {!isSupervisor && (
          <>
            <button
              onClick={() => {
                setScope("assigned_to_me");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                scope === "assigned_to_me"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/60"
              }`}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => {
                setScope("collaborating");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                scope === "collaborating"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/60"
              }`}
            >
              Collaborating
            </button>
          </>
        )}

        <button
          onClick={() => {
            setScope("awaiting_customer");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            scope === "awaiting_customer"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          Awaiting Customer (Pending)
        </button>

        <button
          onClick={() => {
            setScope("due_soon");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            scope === "due_soon"
              ? "bg-orange-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          SLA Due Soon
        </button>

        <button
          onClick={() => {
            setScope("breached");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            scope === "breached"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          SLA Breached
        </button>

        <button
          onClick={() => {
            setScope("archived");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            scope === "archived"
              ? "bg-slate-700 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-200/60"
          }`}
        >
          Archived Tickets
        </button>
      </div>

      {/* Filter Toolbar & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search subject, description, customer..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 border border-slate-300 rounded-lg bg-white text-slate-700 outline-none"
            >
              <option value="">All Statuses</option>
              <option value={Status.NEW}>New</option>
              <option value={Status.OPEN}>Open</option>
              <option value={Status.PENDING}>Pending</option>
              <option value={Status.RESOLVED}>Resolved</option>
              <option value={Status.CLOSED}>Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 border border-slate-300 rounded-lg bg-white text-slate-700 outline-none"
            >
              <option value="">All Priorities</option>
              <option value={Priority.URGENT}>Urgent (2h SLA)</option>
              <option value={Priority.HIGH}>High (8h SLA)</option>
              <option value={Priority.MEDIUM}>Medium (24h SLA)</option>
              <option value={Priority.LOW}>Low (72h SLA)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 border border-slate-300 rounded-lg bg-white text-slate-700 outline-none"
            >
              <option value="">All Categories</option>
              <option value={Category.BUG}>Bug</option>
              <option value={Category.BILLING}>Billing</option>
              <option value={Category.FEATURE}>Feature</option>
              <option value={Category.QUESTION}>Question</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div>
            <select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 border border-slate-300 rounded-lg bg-white text-slate-700 outline-none"
            >
              <option value="">All Assignees</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sorting controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort by:</span>
            <button
              onClick={() => setSort("createdAt")}
              className={`font-semibold hover:text-indigo-600 ${
                sort === "createdAt" ? "text-indigo-600 underline" : ""
              }`}
            >
              Created Date
            </button>
            <span>•</span>
            <button
              onClick={() => setSort("updatedAt")}
              className={`font-semibold hover:text-indigo-600 ${
                sort === "updatedAt" ? "text-indigo-600 underline" : ""
              }`}
            >
              Last Updated
            </button>
            <span>•</span>
            <button
              onClick={() => setSort("slaDueAt")}
              className={`font-semibold hover:text-indigo-600 ${
                sort === "slaDueAt" ? "text-indigo-600 underline" : ""
              }`}
            >
              SLA Deadline
            </button>
          </div>

          <button
            onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
            className="hover:text-indigo-600 font-semibold uppercase"
          >
            Order: {order}
          </button>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when tickets are selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-900 text-white px-5 py-3 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="bg-indigo-800 px-2.5 py-1 rounded-md">
              {selectedIds.length} tickets selected
            </span>
            <span>Choose bulk operation:</span>
          </div>

          <div className="flex items-center gap-2">
            {isSupervisor && (
              <>
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value as any)}
                  className="text-xs py-1.5 px-3 rounded-lg bg-indigo-800 text-white border border-indigo-700 outline-none"
                >
                  <option value="">Select Action...</option>
                  <option value="REASSIGN">Bulk Reassign Agent</option>
                  <option value="CLOSE">Bulk Close Tickets</option>
                </select>

                {bulkAction === "REASSIGN" && (
                  <select
                    value={bulkTargetAssignee}
                    onChange={(e) => setBulkTargetAssignee(e.target.value)}
                    className="text-xs py-1.5 px-3 rounded-lg bg-indigo-800 text-white border border-indigo-700 outline-none"
                  >
                    <option value="">Select Target Agent...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={handleExecuteBulk}
                  disabled={bulkLoading || !bulkAction}
                  className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition"
                >
                  {bulkLoading ? "Executing..." : "Apply Bulk Action"}
                </button>
              </>
            )}

            {!isSupervisor && (
              <span className="text-xs text-indigo-200">
                Bulk reassignments and closures require Supervisor role permissions.
              </span>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-indigo-300 hover:text-white underline pl-2"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Tickets Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600">
                    {selectedIds.length > 0 && selectedIds.length === tickets.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3 w-20"># Number</th>
                <th className="py-3 px-4">Subject & Requester</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Response SLA Clock</th>
                <th className="py-3 px-3 text-right">Replies</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Loading queue tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    No tickets match the selected filters.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const isSelected = selectedIds.includes(t.id);

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-indigo-50/40 transition cursor-pointer ${
                        isSelected ? "bg-indigo-50/60" : ""
                      }`}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                    >
                      {/* Checkbox column */}
                      <td
                        className="p-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectOne(t.id);
                        }}
                      >
                        <button className="text-slate-400 hover:text-indigo-600">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Ticket Number */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        #{t.ticketNumber}
                      </td>

                      {/* Subject & Requester */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 line-clamp-1 hover:text-indigo-600">
                            {t.subject}
                          </span>
                          <CategoryBadge category={t.category} />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          From: <span className="text-slate-700 font-medium">{t.requesterName}</span> ({t.requesterEmail})
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3">
                        <PriorityBadge priority={t.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <StatusBadge status={t.status} size="sm" />
                      </td>

                      {/* Primary Assignee & Collaborators stack */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {t.primaryAssignee?.name || (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </div>
                        {t.collaborators.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>+{t.collaborators.length} collaborators</span>
                          </div>
                        )}
                      </td>

                      {/* SLA Countdown widget */}
                      <td className="py-3 px-4">
                        <SlaCountdown
                          slaDueAt={t.slaDueAt}
                          status={t.status}
                          slaPausedRemainingSeconds={t.slaPausedRemainingSeconds}
                          size="sm"
                        />
                      </td>

                      {/* Reply Count */}
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center gap-1 text-slate-500 font-medium text-xs">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t._count.replies}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server Pagination Toolbar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-bold">{tickets.length}</span> of{" "}
            <span className="font-bold">{pagination.totalCount}</span> tickets (Page{" "}
            {pagination.page} of {pagination.totalPages || 1})
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold flex items-center gap-1 transition"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Results Summary Modal */}
      <BulkResultsModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        data={bulkResultData}
      />
    </div>
  );
}

export default function TicketsQueuePage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-400">Loading queue...</div>}>
      <TicketsQueueContent />
    </Suspense>
  );
}

