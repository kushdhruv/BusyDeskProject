"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { User as SessionUser } from "@/lib/types";
import { Search, Bell, Plus, Command } from "lucide-react";

export function TopBar({ user }: { user: SessionUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/sla/alerts");
        if (res.ok) {
          const data = await res.json();
          setUnreadAlerts(data.count || 0);
        }
      } catch {
        // ignore
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle Ctrl+K shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("global-search-input");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/tickets?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  if (!user) return null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search tickets, subject, description, requester... (Ctrl+K)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-14 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
            <Command className="w-2.5 h-2.5" /> K
          </div>
        </div>
      </form>

      {/* Action Center */}
      <div className="flex items-center gap-3">
        {/* SLA Alert Notification Bell */}
        <a
          href="/alerts"
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          title="SLA Alerts"
        >
          <Bell className="w-4 h-4" />
          {unreadAlerts > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center rounded-full shadow-sm">
              {unreadAlerts}
            </span>
          )}
        </a>

        {/* New Ticket CTA */}
        <a
          href="/tickets/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm hover:shadow transition active:scale-98"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Ticket</span>
        </a>
      </div>
    </header>
  );
}
