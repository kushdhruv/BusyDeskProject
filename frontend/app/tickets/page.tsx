"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Priority, Category, Status, SessionUser, BulkActionResponse } from "@/lib/types";
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
  Clock,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  RotateCcw,
  CheckCircle2,
  X,
  UserCheck,
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

  // Fetch Current User & Agents
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
  const handleExecuteBulk = async (actionType: "REASSIGN" | "CLOSE", targetAssignee?: string) => {
    if (selectedIds.length === 0) return;
    if (actionType === "REASSIGN" && !targetAssignee) {
      alert("Please select an agent to reassign to.");
      return;
    }

    setBulkLoading(true);
    try {
      const res = await fetch("/api/tickets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketIds: selectedIds,
          action: actionType,
          targetAssigneeId: targetAssignee,
        }),
      });

      const data = await res.json();
      setBulkResultData(data);
      setBulkModalOpen(true);
      setSelectedIds([]);
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

  const isSupervisor = user?.role === "SUPERVISOR";

  const formatRelativeTime = (isoDate: string) => {
    const ms = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {isSupervisor ? "All Tickets" : "My Tickets"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSupervisor
              ? "View and manage all support tickets across the organization."
              : "Tickets assigned to you or where you are a collaborator."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <a
            href="/tickets/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Ticket</span>
          </a>
        </div>
      </div>

      {/* Scope Filter Tabs (All, Open, Pending, Breaching, Resolved, Closed, Archived) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
        <button
          onClick={() => {
            setScope("all");
            setStatus("");
            setPage(1);
          }}
          className={`px-3 py-1.5 font-semibold transition border-b-2 -mb-px whitespace-nowrap ${
            scope === "all" && !status
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          All
        </button>

        <button
          onClick={() => {
            setScope("all");
            setStatus("OPEN");
            setPage(1);
          }}
          className={`px-3 py-1.5 font-semibold transition border-b-2 -mb-px whitespace-nowrap ${
            status === "OPEN"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Open
        </button>

        <button
          onClick={() => {
            setScope("awaiting_customer");
            setStatus("");
            setPage(1);
          }}
          className={`px-3 py-1.5 font-semibold transition border-b-2 -mb-px whitespace-nowrap ${
            scope === "awaiting_customer"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Pending
        </button>

        <button
          onClick={() => {
            setScope("breached");
            setStatus("");
            setPage(1);
          }}
          className={`px-3 py-1.5 font-semibold transition border-b-2 -mb-px whitespace-nowrap ${
            scope === "breached"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Breaching SLA
        </button>

        <button
          onClick={() => {
            setScope("all");
            setStatus("RESOLVED");
            setPage(1);
          }}
          className={`px-3 py-1.5 font-semibold transition border-b-2 -mb-px whitespace-nowrap ${
            status === "RESOLVED"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Resolved
        </button>

        <button
          onClick={() => {
            setScope("all");
            setStatus("CLOSED");
            setPage(1);
          }}
          className={`px-3 py-1.5 font-semibold transition border-b-2 -mb-px whitespace-nowrap ${
            status === "CLOSED"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Closed
        </button>

        <button
          onClick={() => {
            setScope("archived");
            setStatus("");
            setPage(1);
          }}
          className={`px-3 py-1.5 font-semibold transition border-b-2 -mb-px whitespace-nowrap ${
            scope === "archived"
              ? "border-slate-800 text-slate-900"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          Archived
        </button>
      </div>

      {/* Filter Toolbar & Search */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Field */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tickets (subject, requester, ID)..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
            />
          </div>

          {/* Priority Pill Filter */}
          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
            className="text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white text-slate-700 outline-none cursor-pointer"
          >
            <option value="">Priority: All</option>
            <option value="URGENT">Urgent (2h)</option>
            <option value="HIGH">High (8h)</option>
            <option value="MEDIUM">Medium (24h)</option>
            <option value="LOW">Low (72h)</option>
          </select>

          {/* Category Pill Filter */}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white text-slate-700 outline-none cursor-pointer"
          >
            <option value="">Category: All</option>
            <option value="BUG">Bug</option>
            <option value="BILLING">Billing</option>
            <option value="FEATURE">Feature</option>
            <option value="QUESTION">Question</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeId}
            onChange={(e) => {
              setAssigneeId(e.target.value);
              setPage(1);
            }}
            className="text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white text-slate-700 outline-none cursor-pointer"
          >
            <option value="">Assignee: All</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Sort Controller */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 text-xs text-slate-500 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-xs py-1 px-2 border-0 bg-transparent text-slate-700 font-semibold outline-none cursor-pointer"
            >
              <option value="createdAt">Created Date</option>
              <option value="updatedAt">Last Updated</option>
              <option value="slaDueAt">SLA Deadline</option>
            </select>
            <button
              onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 uppercase px-1 py-0.5"
            >
              {order}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Operations Sticky Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#0F172A] text-white px-5 py-3 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fade-in border border-slate-700">
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="bg-blue-600 px-2.5 py-1 rounded-md text-white">
              {selectedIds.length} selected
            </span>
            <span>Bulk actions:</span>
          </div>

          <div className="flex items-center gap-2">
            {isSupervisor && (
              <>
                <div className="relative flex items-center gap-1.5">
                  <select
                    id="bulk-target-agent-select"
                    className="text-xs py-1.5 px-3 rounded-lg bg-slate-800 text-white border border-slate-700 outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Assign to...
                    </option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      const select = document.getElementById(
                        "bulk-target-agent-select"
                      ) as HTMLSelectElement;
                      if (select?.value) {
                        handleExecuteBulk("REASSIGN", select.value);
                      } else {
                        alert("Please pick an agent first.");
                      }
                    }}
                    disabled={bulkLoading}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Reassign
                  </button>
                </div>

                <button
                  onClick={() => handleExecuteBulk("CLOSE")}
                  disabled={bulkLoading}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  Close Tickets
                </button>
              </>
            )}

            {!isSupervisor && (
              <span className="text-xs text-slate-400">
                Bulk reassignments & closures require Supervisor role.
              </span>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-white underline pl-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* High-Density Data Grid */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-600">
                    {selectedIds.length > 0 && selectedIds.length === tickets.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3 w-16">#</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-3">Requester</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">SLA Clock</th>
                <th className="py-3 px-3 text-right">Updated</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400">
                    Loading support tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400">
                    No tickets found matching current view parameters.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const isSelected = selectedIds.includes(t.id);

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-blue-50/40 transition cursor-pointer ${
                        isSelected ? "bg-blue-50/60" : ""
                      }`}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                    >
                      {/* Checkbox */}
                      <td
                        className="p-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectOne(t.id);
                        }}
                      >
                        <button className="text-slate-400 hover:text-blue-600">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Number */}
                      <td className="py-3 px-3 font-mono font-semibold text-slate-500">
                        {t.ticketNumber}
                      </td>

                      {/* Subject */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 truncate hover:text-blue-600">
                            {t.subject}
                          </span>
                          {t._count.replies > 0 && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 flex-shrink-0">
                              <MessageSquare className="w-3 h-3" />
                              {t._count.replies}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Requester */}
                      <td className="py-3 px-3 text-slate-600 max-w-[140px] truncate">
                        {t.requesterName}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3">
                        <PriorityBadge priority={t.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <StatusBadge status={t.status} size="sm" />
                      </td>

                      {/* Assignee */}
                      <td className="py-3 px-4">
                        {t.primaryAssignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                              {getInitials(t.primaryAssignee.name)}
                            </div>
                            <span className="truncate text-slate-800 font-medium">
                              {t.primaryAssignee.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* SLA Clock */}
                      <td className="py-3 px-4">
                        <SlaCountdown
                          slaDueAt={t.slaDueAt}
                          status={t.status}
                          slaPausedRemainingSeconds={t.slaPausedRemainingSeconds}
                          size="sm"
                        />
                      </td>

                      {/* Updated Relative */}
                      <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(t.updatedAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{tickets.length}</span> of{" "}
            <span className="font-semibold text-slate-800">{pagination.totalCount}</span> tickets
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-semibold text-slate-700">
              {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
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
