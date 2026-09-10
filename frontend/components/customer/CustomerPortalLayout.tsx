"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User as SessionUser } from "@/lib/types";
import { Inbox, PlusCircle, LogOut, Ticket as TicketIcon, User as UserIcon } from "lucide-react";

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
      <header className="bg-[#0F172A] text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Portal Branding */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white flex items-center justify-center shadow-md transition">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  SupportDesk <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Customer Portal</span>
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/dashboard"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  pathname === "/dashboard" || pathname === "/"
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <TicketIcon className="w-3.5 h-3.5" />
                <span>My Tickets</span>
              </Link>
            </nav>
          </div>

          {/* Actions & Profile */}
          <div className="flex items-center gap-3">
            <Link
              href="/tickets/new"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit Ticket</span>
            </Link>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            {/* Customer User Info */}
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
                {user.name ? user.name.charAt(0).toUpperCase() : "C"}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-medium text-slate-200 leading-tight">{user.name}</span>
                <span className="text-[10px] text-slate-400 leading-tight">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Portal Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© 2026 SupportDesk Customer Help Center. All rights reserved.</p>
          <p className="flex items-center gap-1">
            <span>Powered by</span>
            <span className="font-semibold text-slate-700">SupportDesk Platform</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
