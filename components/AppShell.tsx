"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SessionUser } from "@/lib/types";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  if (!user || isAuthPage) {
    return <div className="min-h-screen bg-slate-100 flex flex-col justify-center">{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
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
