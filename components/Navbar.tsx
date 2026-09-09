"use client";

import React, { useEffect, useState } from "react";
import Link from "next/navigation";
import { usePathname, useRouter } from "next/navigation";
import { SessionUser } from "@/lib/types";
import { Role } from "@prisma/client";
import {
  Inbox,
  LayoutDashboard,
  AlertTriangle,
  PlusCircle,
  LogOut,
  User,
  ShieldCheck,
  Headphones,
} from "lucide-react";

export function Navbar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState<number>(0);

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
    const interval = setInterval(fetchAlerts, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (!user) {
    return (
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/login" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <Inbox className="w-6 h-6 text-indigo-600" />
            <span>BusyDesk</span>
          </a>
          <a
            href="/login"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
          >
            Sign In
          </a>
        </div>
      </header>
    );
  }

  const isSupervisor = user.role === Role.SUPERVISOR;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Nav links */}
        <div className="flex items-center gap-8">
          <a href="/dashboard" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <Inbox className="w-6 h-6 text-indigo-600" />
            <span>BusyDesk</span>
          </a>

          <nav className="hidden md:flex items-center gap-1">
            <a
              href="/dashboard"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                pathname === "/dashboard"
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{isSupervisor ? "Supervisor Dashboard" : "Dashboard"}</span>
            </a>

            <a
              href="/tickets"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                pathname.startsWith("/tickets") && pathname !== "/tickets/new"
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>{isSupervisor ? "All Tickets Queue" : "My Tickets"}</span>
            </a>

            <a
              href="/alerts"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition relative ${
                pathname === "/alerts"
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>SLA Alerts</span>
              {alertCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-rose-600 rounded-full animate-bounce">
                  {alertCount}
                </span>
              )}
            </a>
          </nav>
        </div>

        {/* Right side Actions & Profile */}
        <div className="flex items-center gap-3">
          <a
            href="/tickets/new"
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Ticket</span>
          </a>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              {isSupervisor ? (
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
              ) : (
                <Headphones className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-tight">{user.name}</div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    isSupervisor ? "bg-indigo-600" : "bg-emerald-500"
                  }`}
                />
                {isSupervisor ? "Supervisor" : "Support Agent"}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
