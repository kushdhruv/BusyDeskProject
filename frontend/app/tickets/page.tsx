"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Priority, Category, Status, SessionUser, BulkActionResponse } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge, CategoryBadge } from "@/components/PriorityBadge";
import { SlaCountdown } from "@/components/SlaCountdown";
import { BulkResultsModal } from "@/components/BulkResultsModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Search,
  Download,
  Plus,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ArrowUpDown,
  RotateCcw,
  Inbox,
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

  // Synchronize state whenever URL query params change (sidebar navigation or browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    const urlStatus = searchParams.get("status") || "";
    const urlPriority = searchParams.get("priority") || "";
    const urlCategory = searchParams.get("category") || "";
    const urlAssigneeId = searchParams.get("assigneeId") || "";
    const urlScope = searchParams.get("scope") || "all";
    const urlSort = searchParams.get("sort") || "createdAt";
    const urlOrder = searchParams.get("order") || "desc";
    const urlPage = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;

    setSearch(urlSearch);
    setStatus(urlStatus);
    setPriority(urlPriority);
    setCategory(urlCategory);
    setAssigneeId(urlAssigneeId);
    setScope(urlScope);
    setSort(urlSort);
    setOrder(urlOrder);
    setPage(urlPage);
  }, [searchParams]);

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

  const hasActiveFilters = Boolean(search || status || priority || category || assigneeId || (scope && scope !== "all"));

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setCategory("");
    setAssigneeId("");
    setScope("all");
    setPage(1);
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

  const scopeTabs = [
    { id: "all", label: "All Tickets", scopeVal: "all", statusVal: "" },
    { id: "open", label: "Open", scopeVal: "all", statusVal: "OPEN" },
    { id: "pending", label: "Pending", scopeVal: "awaiting_customer", statusVal: "" },
    { id: "breached", label: "Breaching SLA", scopeVal: "breached", statusVal: "" },
    { id: "resolved", label: "Resolved", scopeVal: "all", statusVal: "RESOLVED" },
    { id: "closed", label: "Closed", scopeVal: "all", statusVal: "CLOSED" },
    { id: "archived", label: "Archived", scopeVal: "archived", statusVal: "" },
  ];

  const isTabActive = (tab: typeof scopeTabs[0]) => {
    if (tab.id === "all") return scope === "all" && !status;
    if (tab.statusVal) return status === tab.statusVal;
    return scope === tab.scopeVal;
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{isSupervisor ? "All Tickets" : "My Tickets"}</span>
            <span className="text-xs font-normal text-slate-500 tabular-nums">
              ({pagination.totalCount})
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSupervisor
              ? "Department-wide queue monitoring, prioritization, and SLA enforcement."
              : "Tickets currently assigned to you or shared with your team."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            icon={<Download className="w-3.5 h-3.5 text-slate-500" />}
          >
            Export CSV
          </Button>
          <a href="/tickets/new">
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
              New Ticket
            </Button>
          </a>
        </div>
      </div>

      {/* Scope Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 text-xs">
        {scopeTabs.map((tab) => {
          const active = isTabActive(tab);
          return (
            <button
              key={tab.id}
              onClick={() => {
                setScope(tab.scopeVal);
                setStatus(tab.statusVal);
                setPage(1);
                const params = new URLSearchParams();
                if (tab.scopeVal && tab.scopeVal !== "all") params.set("scope", tab.scopeVal);
                if (tab.statusVal) params.set("status", tab.statusVal);
                router.push(`/tickets${params.toString() ? `?${params.toString()}` : ""}`);
              }}
              className={`px-3 py-2 font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                active
                  ? "border-slate-900 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-2.5 rounded-md border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
        {/* Search Field */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search tickets by subject, requester, ID..."
            className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
        </div>

        {/* Priority Filter */}
        <Select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="">Priority: All</option>
          <option value="URGENT">Urgent (2h)</option>
          <option value="HIGH">High (8h)</option>
          <option value="MEDIUM">Medium (24h)</option>
          <option value="LOW">Low (72h)</option>
        </Select>

        {/* Category Filter */}
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="">Category: All</option>
          <option value="BUG">Bug</option>
          <option value="BILLING">Billing</option>
          <option value="FEATURE">Feature</option>
          <option value="QUESTION">Question</option>
        </Select>

        {/* Assignee Filter */}
        <Select
          value={assigneeId}
          onChange={(e) => {
            setAssigneeId(e.target.value);
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="">Assignee: All</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        {/* Sort Controller */}
        <div className="flex items-center gap-1 border-l border-slate-200 pl-2 text-xs text-slate-500 ml-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs py-1 px-1 bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Last Updated</option>
            <option value="slaDueAt">SLA Target</option>
          </select>
          <button
            onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
            className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 uppercase px-1 py-0.5 rounded hover:bg-slate-100 transition-colors"
          >
            {order}
          </button>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-xs px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            title="Reset filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white px-3.5 py-2 rounded-md shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-white/10 px-2 py-0.5 rounded font-mono font-medium text-slate-200">
              {selectedIds.length}
            </span>
            <span className="font-medium text-slate-200">tickets selected</span>
          </div>

          <div className="flex items-center gap-2">
            {isSupervisor ? (
              <>
                <div className="flex items-center gap-1.5">
                  <select
                    id="bulk-target-agent-select"
                    className="text-xs py-1 px-2.5 rounded bg-slate-800 text-slate-200 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
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

                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={bulkLoading}
                    onClick={() => {
                      const select = document.getElementById(
                        "bulk-target-agent-select"
                      ) as HTMLSelectElement;
                      if (select?.value) {
                        handleExecuteBulk("REASSIGN", select.value);
                      } else {
                        alert("Please select an agent first.");
                      }
                    }}
                  >
                    Reassign
                  </Button>
                </div>

                <Button
                  variant="danger"
                  size="xs"
                  disabled={bulkLoading}
                  onClick={() => handleExecuteBulk("CLOSE")}
                >
                  Close Tickets
                </Button>
              </>
            ) : (
              <span className="text-slate-400 text-xs">
                Bulk reassignments & closures require Supervisor role.
              </span>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white text-xs pl-2 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Data Grid / Table */}
      <div className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 min-w-[920px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-2.5 w-9 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-slate-900 cursor-pointer"
                    aria-label="Select all"
                  >
                    {selectedIds.length > 0 && selectedIds.length === tickets.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3 w-16">#</th>
                <th className="py-2.5 px-3">Subject</th>
                <th className="py-2.5 px-3">Requester</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Assignee</th>
                <th className="py-2.5 px-3">SLA Target</th>
                <th className="py-2.5 px-3 text-right">Updated</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400">
                    Loading support tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={<Inbox className="w-8 h-8 text-slate-400" />}
                      title="No tickets found"
                      description="There are no tickets matching your current filter criteria."
                      action={
                        hasActiveFilters ? (
                          <Button variant="secondary" size="xs" onClick={resetFilters}>
                            Clear filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const isSelected = selectedIds.includes(t.id);

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        isSelected ? "bg-slate-50/80" : ""
                      }`}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                    >
                      {/* Checkbox */}
                      <td
                        className="p-2.5 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectOne(t.id);
                        }}
                      >
                        <button className="text-slate-400 hover:text-slate-900 cursor-pointer">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* Number */}
                      <td className="py-2.5 px-3 font-mono text-slate-500 font-medium">
                        #{t.ticketNumber}
                      </td>

                      {/* Subject */}
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900 truncate hover:underline">
                            {t.subject}
                          </span>
                          {t._count.replies > 0 && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 flex-shrink-0 tabular-nums">
                              <MessageSquare className="w-3 h-3" />
                              {t._count.replies}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Requester */}
                      <td className="py-2.5 px-3 text-slate-600 max-w-[140px] truncate">
                        {t.requesterName}
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-3">
                        <PriorityBadge priority={t.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <StatusBadge status={t.status} size="sm" />
                      </td>

                      {/* Assignee */}
                      <td className="py-2.5 px-3">
                        {t.primaryAssignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[10px] flex items-center justify-center flex-shrink-0">
                              {getInitials(t.primaryAssignee.name)}
                            </div>
                            <span className="truncate text-slate-800">
                              {t.primaryAssignee.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* SLA Target */}
                      <td className="py-2.5 px-3">
                        <SlaCountdown
                          slaDueAt={t.slaDueAt}
                          status={t.status}
                          slaPausedRemainingSeconds={t.slaPausedRemainingSeconds}
                          size="sm"
                        />
                      </td>

                      {/* Updated Relative */}
                      <td className="py-2.5 px-3 text-right text-slate-400 tabular-nums whitespace-nowrap">
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
        <div className="p-2.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800 tabular-nums">{tickets.length}</span> of{" "}
            <span className="font-semibold text-slate-800 tabular-nums">{pagination.totalCount}</span> tickets
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="px-2 text-xs text-slate-600 tabular-nums">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
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
    <Suspense fallback={<div className="text-center py-20 text-slate-400 text-xs">Loading ticket queue...</div>}>
      <TicketsQueueContent />
    </Suspense>
  );
}
