"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SessionUser } from "@/lib/types";
import { Role } from "@prisma/client";
import {
  LayoutDashboard,
  Inbox,
  AlertTriangle,
  Users,
  BarChart3,
  LogOut,
  User,
  Users2,
  Clock,
  AlertCircle,
  ShieldAlert,
  Archive,
  ChevronRight,
  Headphones,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export function Sidebar({
  user,
  collapsed = false,
}: {
  user: SessionUser | null;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState<number>(0);

  const currentScope = searchParams.get("scope") || "all";

  useEffect(() => {
    if (!user) return;

    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/sla/alerts");
        if (res.ok) {
          const data = await res.json();
          setAlertCount(data.count || 0);
        }
      } catch {
        // ignore
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (!user) return null;

  const isSupervisor = user.role === Role.SUPERVISOR;

  // Helper to get initials
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800 select-none h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/80 gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
          <Inbox className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
            SupportDesk
            <span className="text-[10px] uppercase font-semibold tracking-wider bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
              v1.0
            </span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            {isSupervisor ? "Supervisor Workspace" : "Agent Workspace"}
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Main Section */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation
          </div>
          <nav className="space-y-1">
            <a
              href="/dashboard"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === "/dashboard"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              <span>{isSupervisor ? "Dashboard" : "My Dashboard"}</span>
            </a>

            <a
              href="/tickets"
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname.startsWith("/tickets") && pathname !== "/tickets/new" && currentScope === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4 h-4 text-cyan-400" />
                <span>{isSupervisor ? "All Tickets" : "My Tickets"}</span>
              </div>
            </a>

            <a
              href="/alerts"
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === "/alerts"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>SLA Alerts</span>
              </div>
              {alertCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold text-white bg-rose-500 rounded-full animate-pulse">
                  {alertCount}
                </span>
              )}
            </a>
          </nav>
        </div>

        {/* Filter Sub-views for Agents & Quick Views */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {isSupervisor ? "Quick Queues" : "My Views"}
          </div>
          <nav className="space-y-1">
            <a
              href="/tickets?scope=assigned_to_me"
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentScope === "assigned_to_me"
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Assigned to Me</span>
              </div>
            </a>

            <a
              href="/tickets?scope=collaborating"
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentScope === "collaborating"
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Collaborating</span>
              </div>
            </a>

            <a
              href="/tickets?scope=awaiting_customer"
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentScope === "awaiting_customer"
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Awaiting Customer</span>
              </div>
            </a>

            <a
              href="/tickets?scope=due_soon"
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentScope === "due_soon"
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                <span>Due Soon (1h)</span>
              </div>
            </a>

            <a
              href="/tickets?scope=breached"
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentScope === "breached"
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>SLA Breached</span>
              </div>
            </a>

            <a
              href="/tickets?scope=archived"
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentScope === "archived"
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 text-slate-400" />
                <span>Archived Tickets</span>
              </div>
            </a>
          </nav>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-[#090E1A]">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow ${
                isSupervisor ? "bg-indigo-600" : "bg-emerald-600"
              }`}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSupervisor ? "bg-indigo-400" : "bg-emerald-400"
                  }`}
                />
                {isSupervisor ? "Supervisor" : "Support Agent"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition ml-1 flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
