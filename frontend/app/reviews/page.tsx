"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session-context";
import {
  Star,
  Search,
  Filter,
  Users,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Award,
  ExternalLink,
  MessageSquare,
  Shield,
  Loader2,
  X,
  ArrowUpDown,
  Ticket,
} from "lucide-react";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    status: string;
    primaryAssignee?: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface AgentPerformance {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  totalResolvedTickets: number;
  totalReviews: number;
  averageRating: number;
  satisfactionRate: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

interface ReviewsSummary {
  totalReviews: number;
  averageRating: number;
  satisfactionRate: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export default function ReviewsPage() {
  const { user } = useSession();

  // Data states
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingAgents, setLoadingAgents] = useState<boolean>(true);

  // Filter & Sort states
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [agentSort, setAgentSort] = useState<string>("rating_desc");

  // Fetch reviews based on active filters
  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedAgentId !== "all") params.append("agentId", selectedAgentId);
      if (selectedRating !== null) params.append("rating", selectedRating.toString());
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/reviews?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId, selectedRating, searchQuery]);

  // Fetch agent performance leaderboard with sorting
  const fetchAgentPerformance = useCallback(async (sortBy: string) => {
    try {
      setLoadingAgents(true);
      const res = await fetch(`/api/reviews/agents?sortBy=${sortBy}`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchAgentPerformance(agentSort);
  }, [agentSort, fetchAgentPerformance]);

  const handleSortChange = (newSort: string) => {
    setAgentSort(newSort);
  };

  const clearFilters = () => {
    setSelectedAgentId("all");
    setSelectedRating(null);
    setSearchQuery("");
  };

  const selectedAgentObj = agents.find((a) => a.id === selectedAgentId);
  const isSupervisor = user?.role === "SUPERVISOR";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customer Reviews & Agent CSAT</h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 rounded-md border border-amber-200 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              CSAT Analytics
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Analyze customer satisfaction scores, evaluate agent performance records, and inspect customer feedback.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors self-start sm:self-auto"
        >
          <span>← Back to Dashboard</span>
        </Link>
      </div>

      {/* Top Metric Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Overall CSAT Score</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{summary.averageRating.toFixed(1)}</p>
              <span className="text-xs text-slate-400 font-medium">/ 5.0</span>
            </div>
            <div className="flex items-center gap-0.5 mt-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= Math.round(summary.averageRating)
                      ? "text-amber-500 fill-amber-500"
                      : "text-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Reviews</span>
              <MessageSquare className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{summary.totalReviews}</p>
            <p className="text-[11px] text-slate-400 mt-1">Verified customer submissions</p>
          </div>

          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Satisfaction Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{summary.satisfactionRate}%</p>
            <p className="text-[11px] text-emerald-700 mt-1">4★ & 5★ positive reviews</p>
          </div>

          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">5-Star Ratings</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {summary.distribution[5]}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary.totalReviews > 0
                ? `${Math.round((summary.distribution[5] / summary.totalReviews) * 100)}% of total reviews`
                : "No ratings yet"}
            </p>
          </div>
        </div>
      )}

      {/* Supervisor Agent Performance & CSAT Scorecards */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Agent CSAT Performance & Rankings
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Rank agents by lowest average ratings for coaching or highest ratings for recognition.
            </p>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" /> Sort by:
            </span>
            <select
              value={agentSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
            >
              <option value="rating_desc">Highest Rating First (Top Performers)</option>
              <option value="rating_asc">Lowest Rating First (Needs Coaching / Low Avg)</option>
              <option value="reviews_desc">Most Reviews Received</option>
              <option value="resolved_desc">Most Resolved Tickets</option>
              <option value="name_asc">Agent Name (A-Z)</option>
            </select>
          </div>
        </div>

        {loadingAgents ? (
          <div className="p-8 flex items-center justify-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-slate-900" />
            Loading agent scorecards...
          </div>
        ) : agents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No support agents found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/30 text-[11px] font-semibold text-slate-500">
                  <th className="px-5 py-3">Support Agent</th>
                  <th className="px-5 py-3">Average CSAT Rating</th>
                  <th className="px-5 py-3">Rating Breakdown</th>
                  <th className="px-5 py-3">Positive Rate</th>
                  <th className="px-5 py-3">Total Reviews</th>
                  <th className="px-5 py-3">Resolved Tickets</th>
                  <th className="px-5 py-3 text-right">Filter Reviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {agents.map((agent) => {
                  const isFiltered = selectedAgentId === agent.id;
                  const isLowScore = agent.totalReviews > 0 && agent.averageRating < 3.5;
                  const isHighScore = agent.totalReviews > 0 && agent.averageRating >= 4.5;

                  return (
                    <tr
                      key={agent.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isFiltered ? "bg-blue-50/40" : ""
                      }`}
                    >
                      {/* Agent details */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0">
                            {agent.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900">{agent.name}</p>
                              {agent.role === "SUPERVISOR" && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Supervisor
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono">{agent.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Average Rating Score */}
                      <td className="px-5 py-3.5">
                        {agent.totalReviews > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tabular-nums border ${
                                isLowScore
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : isHighScore
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              <Star className="w-3 h-3 fill-current" />
                              {agent.averageRating.toFixed(1)}
                            </span>
                            {isLowScore && (
                              <span
                                title="Average rating is below 3.5 — coaching recommended"
                                className="text-[10px] text-rose-600 flex items-center gap-0.5 font-medium"
                              >
                                <TrendingDown className="w-3 h-3" /> Low
                              </span>
                            )}
                            {isHighScore && (
                              <span
                                title="Top tier customer satisfaction (4.5+)"
                                className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-medium"
                              >
                                <TrendingUp className="w-3 h-3" /> Top
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No reviews yet</span>
                        )}
                      </td>

                      {/* Star distribution bars */}
                      <td className="px-5 py-3.5">
                        {agent.totalReviews > 0 ? (
                          <div className="flex items-center gap-1 w-28" title={`5★: ${agent.distribution[5]} | 4★: ${agent.distribution[4]} | 3★: ${agent.distribution[3]} | 2★: ${agent.distribution[2]} | 1★: ${agent.distribution[1]}`}>
                            <div
                              style={{ width: `${(agent.distribution[5] / agent.totalReviews) * 100}%` }}
                              className="h-2 bg-emerald-500 rounded-xs"
                            />
                            <div
                              style={{ width: `${(agent.distribution[4] / agent.totalReviews) * 100}%` }}
                              className="h-2 bg-emerald-300 rounded-xs"
                            />
                            <div
                              style={{ width: `${(agent.distribution[3] / agent.totalReviews) * 100}%` }}
                              className="h-2 bg-amber-400 rounded-xs"
                            />
                            <div
                              style={{ width: `${(agent.distribution[2] / agent.totalReviews) * 100}%` }}
                              className="h-2 bg-rose-300 rounded-xs"
                            />
                            <div
                              style={{ width: `${(agent.distribution[1] / agent.totalReviews) * 100}%` }}
                              className="h-2 bg-rose-500 rounded-xs"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Positive Rate */}
                      <td className="px-5 py-3.5">
                        {agent.totalReviews > 0 ? (
                          <span className="text-xs font-semibold text-slate-800 tabular-nums">
                            {agent.satisfactionRate}%
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Reviews count */}
                      <td className="px-5 py-3.5 tabular-nums text-slate-700 font-medium">
                        {agent.totalReviews}
                      </td>

                      {/* Resolved Tickets */}
                      <td className="px-5 py-3.5 tabular-nums text-slate-700 font-medium">
                        {agent.totalResolvedTickets}
                      </td>

                      {/* Filter button */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedAgentId === agent.id) {
                              setSelectedAgentId("all");
                            } else {
                              setSelectedAgentId(agent.id);
                            }
                          }}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors cursor-pointer ${
                            isFiltered
                              ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {isFiltered ? "Showing Reviews ✓" : "Inspect Reviews"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Reviews Feed & Explorer */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Customer Reviews Explorer
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Browse detailed feedback comments submitted by customers upon ticket resolution.
              </p>
            </div>

            {/* Active filter count / Clear */}
            {(selectedAgentId !== "all" || selectedRating !== null || searchQuery.trim()) && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search feedback comment, customer, or ticket subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Agent Select Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Agent:</span>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                <option value="all">All Support Agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.totalReviews} reviews)
                  </option>
                ))}
              </select>
            </div>

            {/* Star Rating Pills */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedRating(null)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                  selectedRating === null
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                All Stars
              </button>
              {[5, 4, 3, 2, 1].map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(selectedRating === star ? null : star)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                    selectedRating === star
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Star className="w-3 h-3 fill-current" />
                  <span>{star}★</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Agent Filter Pill */}
          {selectedAgentObj && selectedAgentId !== "all" && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs font-medium">
              <span>Filtered by agent:</span>
              <strong className="font-semibold">{selectedAgentObj.name}</strong>
              <button
                onClick={() => setSelectedAgentId("all")}
                className="hover:text-blue-900 ml-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
            <span className="text-xs mt-2 font-medium">Loading reviews...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No customer reviews found matching your selected criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((rev) => (
              <div key={rev.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Rating Stars & Customer Info */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= rev.rating
                              ? "text-amber-500 fill-amber-500"
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-slate-800 ml-1.5 tabular-nums">
                        {rev.rating}.0
                      </span>
                    </div>

                    <span className="text-slate-300">•</span>

                    <div className="text-xs">
                      <span className="font-semibold text-slate-900">{rev.user.name}</span>
                      <span className="text-slate-400 font-mono text-[11px] ml-1.5">
                        ({rev.user.email})
                      </span>
                    </div>
                  </div>

                  {/* Date & Agent Tag */}
                  <div className="flex items-center gap-2 text-xs">
                    {rev.ticket.primaryAssignee ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <Users className="w-3 h-3 text-slate-400" />
                        Assigned: {rev.ticket.primaryAssignee.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Unassigned</span>
                    )}

                    <span className="text-slate-400 text-[11px] tabular-nums">
                      {new Date(rev.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Comment Quote */}
                {rev.comment ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 leading-relaxed italic">
                    &ldquo;{rev.comment}&rdquo;
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No written comment provided with rating.</p>
                )}

                {/* Linked Ticket Footer */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <Link
                    href={`/tickets/${rev.ticket.id}`}
                    className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-blue-600 transition-colors group"
                  >
                    <Ticket className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                    <span className="font-mono text-slate-500">#{rev.ticket.ticketNumber}</span>
                    <span className="underline decoration-slate-300 group-hover:decoration-blue-600">
                      {rev.ticket.subject}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </Link>

                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Ticket Status: {rev.ticket.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
