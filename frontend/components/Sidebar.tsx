"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { User as SessionUser } from "@/lib/types";
import {
  LayoutDashboard,
  Inbox,
  AlertTriangle,
  User,
  Users2,
  Clock,
  AlertCircle,
  Archive,
  LogOut,
  Headphones,
  PanelLeftClose,
  X,
} from "lucide-react";

interface SidebarProps {
  user: SessionUser | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  width: number;
  onWidthChange: (w: number) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  user,
  collapsed,
  onToggleCollapse,
  width,
  onWidthChange,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState<number>(0);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const currentScope = searchParams.get("scope") || "all";

  // Alert count polling
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

  // Drag resize handler
  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
    },
    [collapsed]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(380, Math.max(200, e.clientX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  // Toggle in / toggle out when clicking on empty space
  const handleEmptySpaceClick = (e: React.MouseEvent) => {
    if (isResizing) return;
    const target = e.target as HTMLElement;
    // Do not toggle if clicking an interactive element (link, button, input)
    if (target.closest("a, button, input, select, textarea, [data-no-toggle]")) {
      return;
    }
    onToggleCollapse();
  };

  if (!user) return null;

  const isSupervisor = user.role === "SUPERVISOR";

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isTicketsActive =
    pathname.startsWith("/tickets") && pathname !== "/tickets/new" && currentScope === "all";

  const navItemClass = (isActive: boolean) =>
    `flex items-center ${
      collapsed ? "justify-center px-2 py-2" : "justify-between px-2.5 py-1.5"
    } rounded-md text-xs font-medium transition-colors cursor-pointer ${
      isActive
        ? "bg-slate-200/90 text-slate-900 font-semibold shadow-2xs"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const renderSidebarContent = (isMobile: boolean) => (
    <div
      className={`flex flex-col h-full select-none ${collapsed && !isMobile ? "cursor-pointer" : ""}`}
      onClick={handleEmptySpaceClick}
      title={collapsed && !isMobile ? "Click empty space to expand sidebar" : undefined}
    >
      {/* Brand Header */}
      <div
        className={`h-14 flex items-center border-b border-slate-200 flex-shrink-0 ${
          !isMobile && collapsed ? "justify-center px-2" : "justify-between px-3.5"
        }`}
      >
        <div
          className="flex items-center gap-2.5 min-w-0 cursor-pointer"
          onClick={(e) => {
            if (collapsed && !isMobile) {
              e.stopPropagation();
              onToggleCollapse();
            }
          }}
          title={collapsed && !isMobile ? "Click to expand sidebar" : "SupportDesk"}
        >
          <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white flex-shrink-0 shadow-2xs hover:bg-slate-800 transition-colors">
            <Headphones className="w-3.5 h-3.5" />
          </div>
          {(isMobile || !collapsed) && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-slate-900 tracking-tight leading-tight">
                SupportDesk
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate leading-tight">
                {isSupervisor ? "Supervisor" : "Agent"}
              </span>
            </div>
          )}
        </div>

        {/* Mobile: Close Drawer Button */}
        {isMobile && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseMobile();
            }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Desktop: Collapse Toggle Button (ONLY visible in expanded mode to eliminate overlap) */}
        {!isMobile && !collapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            title="Collapse sidebar (Go in)"
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Main Section */}
        <div>
          {!collapsed && (
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </div>
          )}
          <nav className="space-y-0.5">
            <Link
              href="/dashboard"
              prefetch={true}
              title={collapsed ? "Dashboard" : undefined}
              className={navItemClass(pathname === "/dashboard")}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-slate-500 flex-shrink-0" />
                {!collapsed && <span>Dashboard</span>}
              </div>
            </Link>

            <Link
              href="/tickets"
              prefetch={true}
              title={collapsed ? (isSupervisor ? "All Tickets" : "My Tickets") : undefined}
              className={navItemClass(isTicketsActive)}
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-slate-500 flex-shrink-0" />
                {!collapsed && <span>{isSupervisor ? "All Tickets" : "My Tickets"}</span>}
              </div>
            </Link>

            <Link
              href="/alerts"
              prefetch={true}
              title={collapsed ? `SLA Alerts (${alertCount})` : undefined}
              className={navItemClass(pathname === "/alerts")}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                {!collapsed && <span>SLA Alerts</span>}
              </div>
              {alertCount > 0 && (
                <span
                  className={`${
                    collapsed
                      ? "absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500"
                      : "px-1.5 py-0.2 text-[10px] font-semibold text-rose-700 bg-rose-100 rounded border border-rose-200 tabular-nums"
                  }`}
                >
                  {!collapsed && alertCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

        {/* Filter Sub-views for Agents & Quick Views */}
        <div>
          {!collapsed && (
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {isSupervisor ? "Quick Queues" : "My Views"}
            </div>
          )}
          <nav className="space-y-0.5">
            <Link
              href="/tickets?scope=assigned_to_me"
              prefetch={true}
              title={collapsed ? "Assigned to Me" : undefined}
              className={navItemClass(pathname.startsWith("/tickets") && currentScope === "assigned_to_me")}
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {!collapsed && <span>Assigned to Me</span>}
              </div>
            </Link>

            <Link
              href="/tickets?scope=collaborating"
              prefetch={true}
              title={collapsed ? "Collaborating" : undefined}
              className={navItemClass(pathname.startsWith("/tickets") && currentScope === "collaborating")}
            >
              <div className="flex items-center gap-2">
                <Users2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {!collapsed && <span>Collaborating</span>}
              </div>
            </Link>

            <Link
              href="/tickets?scope=awaiting_customer"
              prefetch={true}
              title={collapsed ? "Awaiting Customer" : undefined}
              className={navItemClass(pathname.startsWith("/tickets") && currentScope === "awaiting_customer")}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {!collapsed && <span>Awaiting Customer</span>}
              </div>
            </Link>

            <Link
              href="/tickets?scope=due_soon"
              prefetch={true}
              title={collapsed ? "Due Soon" : undefined}
              className={navItemClass(pathname.startsWith("/tickets") && currentScope === "due_soon")}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                {!collapsed && <span>Due Soon</span>}
              </div>
            </Link>

            <Link
              href="/tickets?scope=breached"
              prefetch={true}
              title={collapsed ? "SLA Breached" : undefined}
              className={navItemClass(pathname.startsWith("/tickets") && currentScope === "breached")}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                {!collapsed && <span>SLA Breached</span>}
              </div>
            </Link>

            <Link
              href="/tickets?scope=archived"
              prefetch={true}
              title={collapsed ? "Archived" : undefined}
              className={navItemClass(pathname.startsWith("/tickets") && currentScope === "archived")}
            >
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {!collapsed && <span>Archived</span>}
              </div>
            </Link>
          </nav>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="p-2 border-t border-slate-200 bg-slate-100/40 flex-shrink-0">
        <div
          className={`flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          } p-1.5 rounded-md hover:bg-slate-200/50 transition-colors`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              title={user.name}
              className="w-7 h-7 rounded bg-slate-900 text-white font-medium text-xs flex items-center justify-center flex-shrink-0"
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate leading-tight">
                  {isSupervisor ? "Supervisor" : "Agent"}
                </p>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors ml-1 flex-shrink-0 cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-out Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 shadow-xl transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent(true)}
      </div>

      {/* Desktop Sticky Sidebar */}
      <aside
        ref={sidebarRef}
        style={{ width: collapsed ? "60px" : `${width}px` }}
        className={`hidden lg:flex flex-col flex-shrink-0 bg-slate-50/70 border-r border-slate-200 h-screen sticky top-0 transition-[width] duration-150 ease-out relative group/sidebar ${
          isResizing ? "select-none pointer-events-none" : ""
        }`}
      >
        {renderSidebarContent(false)}

        {/* Resizer Handle Bar (Desktop only, visible on hover) */}
        {!collapsed && (
          <div
            onMouseDown={startResizing}
            title="Drag to resize sidebar"
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-slate-400/40 active:bg-slate-500 transition-colors z-20 flex items-center justify-center group-hover/sidebar:bg-slate-200/60"
          />
        )}
      </aside>
    </>
  );
}
