"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User as SessionUser } from "@/lib/types";
import { Search, Bell, Plus, Command, Menu, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TopBarProps {
  user: SessionUser | null;
  onToggleMobile?: () => void;
  sidebarCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function TopBar({
  user,
  onToggleMobile,
  sidebarCollapsed,
  onToggleCollapse,
}: TopBarProps) {
  const router = useRouter();
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
    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
      {/* Left side: Mobile Hamburger + Desktop Sidebar Toggle + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          onClick={onToggleMobile}
          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors lg:hidden cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop Collapse / Pop-up Sidebar Button (shows when collapsed for quick pop-out) */}
        {sidebarCollapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Expand sidebar (Pop up)"
            className="hidden lg:flex p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full max-w-md">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              placeholder="Search tickets (Ctrl+K)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-12 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 px-1 py-0.2 rounded">
              <Command className="w-2.5 h-2.5" /> K
            </div>
          </div>
        </form>
      </div>

      {/* Right side Action Center */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* SLA Alert Notification Bell */}
        <Link
          href="/alerts"
          prefetch={true}
          className="relative p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          title={unreadAlerts > 0 ? `${unreadAlerts} active SLA alerts` : "SLA Alerts"}
        >
          <Bell className="w-4 h-4" />
          {unreadAlerts > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          )}
        </Link>

        {/* New Ticket CTA */}
        <Link href="/tickets/new" prefetch={true}>
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
            <span className="hidden sm:inline">New Ticket</span>
            <span className="sm:hidden">New</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
