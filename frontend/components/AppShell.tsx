"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User as SessionUser } from "@/lib/types";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CustomerPortalLayout } from "./customer/CustomerPortalLayout";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (isAuthPage) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, isAuthPage, router]);

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-100 flex flex-col justify-center">{children}</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading SupportDesk...</span>
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
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Dark Navy Sidebar */}
      <Sidebar user={user} />

      {/* Main Content Area with TopBar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          <div className="max-w-[1600px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
