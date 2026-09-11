"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionProvider, useSession } from "@/lib/session-context";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CustomerPortalLayout } from "./customer/CustomerPortalLayout";
import { Loader2 } from "lucide-react";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(240);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Restore user preferences for sidebar width and collapse state
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem("supportdesk_sidebar_collapsed");
      if (savedCollapsed !== null) {
        setSidebarCollapsed(savedCollapsed === "true");
      }
      const savedWidth = localStorage.getItem("supportdesk_sidebar_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 200 && parsed <= 380) {
          setSidebarWidth(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("supportdesk_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleWidthChange = (w: number) => {
    setSidebarWidth(w);
    try {
      localStorage.setItem("supportdesk_sidebar_width", String(w));
    } catch {
      // ignore
    }
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      router.push("/login");
    }
  }, [loading, user, isAuthPage, router]);

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50 flex flex-col justify-center">{children}</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          <span className="text-xs font-medium text-slate-500">Loading SupportDesk...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Render Customer Portal layout for customers
  if (user.role === "CUSTOMER") {
    return <CustomerPortalLayout user={user}>{children}</CustomerPortalLayout>;
  }

  // Render Staff (Agent & Supervisor) Layout
  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-900 font-sans">
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        width={sidebarWidth}
        onWidthChange={handleWidthChange}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          user={user}
          onToggleMobile={() => setMobileOpen((prev) => !prev)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          <div className="max-w-[1600px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppShellInner>{children}</AppShellInner>
    </SessionProvider>
  );
}
