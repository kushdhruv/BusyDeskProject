"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User as SessionUser } from "@/lib/types";
import { Headphones, Plus, LogOut, Ticket as TicketIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CustomerPortalLayout({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Customer Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo & Portal Branding */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-sky-400 border border-slate-800 flex items-center justify-center shadow-xs">
                <Headphones className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-slate-900 tracking-tight leading-none">
                    BUSY<span className="text-sky-600">Desk</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium tracking-wide mt-0.5">
                    BUSY INFOTECH
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                  Customer Portal
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/dashboard"
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  pathname === "/dashboard" || pathname === "/"
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                My Tickets
              </Link>
            </nav>
          </div>

          {/* Actions & Profile */}
          <div className="flex items-center gap-3">
            <Link href="/tickets/new">
              <Button variant="primary" size="xs" icon={<Plus className="w-3 h-3" />}>
                Submit Request
              </Button>
            </Link>

            <div className="h-4 w-px bg-slate-200" />

            {/* Customer User Info */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-[10px] font-medium">
                {user.name ? user.name.charAt(0).toUpperCase() : "C"}
              </div>
              <span className="text-xs text-slate-700 font-medium hidden md:inline">{user.name}</span>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Portal Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <p>© 2026 BUSY Infotech Pvt. Ltd. · Business Accounting Software Help Center</p>
          <p className="flex items-center gap-1.5 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>Support Systems Operational</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
