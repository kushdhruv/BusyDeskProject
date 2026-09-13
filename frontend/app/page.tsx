"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { Button } from "@/components/ui/Button";
import {
  Headphones,
  ArrowRight,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  FileText,
  User,
  Zap,
  Lock,
  ExternalLink,
} from "lucide-react";

interface TriageTier {
  id: string;
  category: string;
  priority: string;
  urgency: string;
  label: string;
  shortDesc: string;
  slaCommit: string;
  team: string;
  triageDetails: string;
  example: string;
}

const TRIAGE_TIERS: TriageTier[] = [
  {
    id: "critical",
    category: "BUG",
    priority: "URGENT",
    urgency: "HIGH",
    label: "Critical Production Blocker",
    shortDesc: "System down or financial data at risk",
    slaCommit: "< 2 Hours",
    team: "Senior Escalations & On-Call Engineering",
    triageDetails: "Dispatched instantly to on-call senior engineers. Immediate investigation and SLA countdown starts upon submission.",
    example: "GST portal sync 500 error, payment gateway failure, or corrupted ledger database.",
  },
  {
    id: "tax_bug",
    category: "BUG",
    priority: "HIGH",
    urgency: "HIGH",
    label: "Core Accounting & Tax Bug",
    shortDesc: "Incorrect calculations or filing errors",
    slaCommit: "< 8 Hours",
    team: "Tax & Compliance Engineering",
    triageDetails: "Assigned to dedicated tax specialists. We verify voucher math, ledger postings, and statutory reporting rules.",
    example: "E-Way bill JSON generation failed, VAT rounding anomaly, or GSTR return mismatch.",
  },
  {
    id: "integration",
    category: "INTEGRATION",
    priority: "MEDIUM",
    urgency: "NORMAL",
    label: "Integration & Data Sync",
    shortDesc: "APIs, bank feeds, or import issues",
    slaCommit: "< 24 Hours",
    team: "Systems & Integration Team",
    triageDetails: "Specialists inspect payload logs, webhook handshakes, and database schema mappings.",
    example: "Automated bank reconciliation feed failing, custom REST webhook timeout, or Excel data import error.",
  },
  {
    id: "general",
    category: "QUESTION",
    priority: "LOW",
    urgency: "LOW",
    label: "License, Account & General Help",
    shortDesc: "Permissions, billing, or feature guides",
    slaCommit: "< 72 Hours",
    team: "Operations & Account Services",
    triageDetails: "Direct support for operator licenses, subscription invoices, multi-branch rights, and training guides.",
    example: "Operator password reset, annual subscription invoice copy, or multi-branch license transfer.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user } = useSession();
  const [selectedTier, setSelectedTier] = useState<TriageTier>(TRIAGE_TIERS[0]);
  const [ticketSearch, setTicketSearch] = useState("");
  const [searchError, setSearchError] = useState("");

  const handleTicketLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");

    const clean = ticketSearch.trim().replace(/^#/, "");
    if (!clean || isNaN(Number(clean))) {
      setSearchError("Please enter a valid numeric ticket number (e.g. 104).");
      return;
    }

    router.push(`/tickets?search=${encodeURIComponent(clean)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Top Utility Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 shadow-2xs">
              <Headphones className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-slate-900">
                BUSY<span className="text-sky-600">Desk</span>
              </span>
              <span className="text-slate-300 font-normal">/</span>
              <span className="text-xs font-medium text-slate-500">Support</span>
            </div>
          </div>

          {/* Operational Status & Auth Links */}
          <div className="flex items-center gap-4 text-xs">
            {/* Live Operational Status */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational</span>
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 hidden md:inline">
                  Signed in as <strong className="text-slate-800 font-medium">{user.name}</strong>
                </span>
                <Link href={user.role === "CUSTOMER" ? "/dashboard" : "/tickets"}>
                  <Button variant="primary" size="xs">
                    {user.role === "CUSTOMER" ? "My Tickets →" : "Staff Console →"}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-slate-600 hover:text-slate-900 font-medium px-2 py-1 transition-colors"
                >
                  Sign In
                </Link>
                <Link href="/tickets/new">
                  <Button variant="primary" size="xs">
                    Report Issue
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
        {/* Core Hero Section */}
        <section className="space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
            <Shield className="w-3 h-3 text-slate-600" />
            <span>BUSY Infotech Help Center</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15]">
              Something went wrong?
              <br />
              <span className="text-slate-500 font-semibold">
                Tell us. We’ll take it from here.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl pt-1">
              Direct line to BUSY Accounting software engineers. No chatbots, no triage queues that vanish into the void. Guaranteed response times backed by live SLAs.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link href="/tickets/new" className="inline-block">
              <Button
                variant="primary"
                size="md"
                className="w-full sm:w-auto text-sm justify-center shadow-xs"
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Report an Issue
              </Button>
            </Link>

            <Link href={user ? (user.role === "CUSTOMER" ? "/dashboard" : "/tickets") : "/login"}>
              <Button
                variant="secondary"
                size="md"
                className="w-full sm:w-auto text-sm justify-center"
              >
                Track Existing Ticket
              </Button>
            </Link>
          </div>
        </section>

        {/* The Signature Detail: Interactive Live SLA & Urgency Response Simulator */}
        <section className="bg-white rounded-lg border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Live Response Commitment
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select the issue category below to preview your guaranteed resolution SLA window.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Response Clock Guaranteed by Contract
            </span>
          </div>

          {/* Triage Tier Selector Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {TRIAGE_TIERS.map((tier) => {
              const isSelected = selectedTier.id === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier)}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-xs leading-snug">{tier.label}</p>
                    <p
                      className={`text-[11px] leading-tight ${
                        isSelected ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {tier.shortDesc}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/40 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono uppercase ${
                        isSelected ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      Max SLA
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        isSelected ? "text-sky-300" : "text-slate-900"
                      }`}
                    >
                      {tier.slaCommit}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Tier Details Breakdown Card */}
          <div className="bg-slate-50/80 rounded-md border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 text-xs">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 text-sm">
                  {selectedTier.label}
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                  <Clock className="w-3 h-3" />
                  Target: {selectedTier.slaCommit}
                </span>
              </div>

              <p className="text-slate-600 leading-relaxed">
                {selectedTier.triageDetails}
              </p>

              <div className="text-[11px] text-slate-500">
                <strong>Typical scenario:</strong> {selectedTier.example}
              </div>
            </div>

            <div className="flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 flex flex-col items-start md:items-end gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Assigned Team
              </span>
              <span className="font-medium text-slate-900 text-xs">
                {selectedTier.team}
              </span>
              <Link
                href={`/tickets/new?category=${selectedTier.category}&priority=${selectedTier.priority}&urgency=${selectedTier.urgency}`}
                className="mt-1"
              >
                <Button variant="primary" size="xs" icon={<ArrowRight className="w-3 h-3" />}>
                  Start Request ({selectedTier.slaCommit})
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Transparent 3-Step Lifecycle ("What Happens Next") */}
        <section className="space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              What Happens After You Tell Us
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent, accountable resolution lifecycle. No automated dead-ends.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Step 1 */}
            <div className="bg-white rounded-md border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
              <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold text-xs flex items-center justify-center">
                01
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Instant Reference & SLA Clock
              </h3>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                The moment you submit, a unique ticket number (#) is generated and a visible countdown clock starts ticking against our response commitment.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-md border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
              <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold text-xs flex items-center justify-center">
                02
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Assigned to a Domain Engineer
              </h3>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Directly routed to an accounting, tax, or integration engineer who understands your business software — never a generic chatbot.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-md border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2">
              <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold text-xs flex items-center justify-center">
                03
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Full Audit & Verified Resolution
              </h3>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Reply via email or the portal. Every state change and note is tracked in an append-only audit trail. We only close when you confirm the fix.
              </p>
            </div>
          </div>
        </section>

        {/* Quick Ticket Lookup & Knowledge Base Shortcuts */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Quick Ticket Lookup */}
          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Looking for an Existing Ticket?
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Enter your ticket number to view live status, replies, or submit an update.
            </p>

            <form onSubmit={handleTicketLookup} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={(e) => {
                    setTicketSearch(e.target.value);
                    setSearchError("");
                  }}
                  placeholder="e.g. #102 or 104"
                  className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Track →
                </Button>
              </div>
              {searchError && (
                <p className="text-[11px] text-rose-600">{searchError}</p>
              )}
            </form>
          </div>

          {/* Quick Knowledge Base Shortcuts */}
          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Common Instant Solutions
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Need immediate guidance without opening a ticket?
            </p>

            <div className="divide-y divide-slate-100 text-xs">
              <Link
                href="/tickets/new?category=ACCOUNT"
                className="py-1.5 flex items-center justify-between text-slate-700 hover:text-slate-900 group"
              >
                <span>Resetting Operator & User Password</span>
                <span className="text-slate-400 group-hover:text-slate-700">→</span>
              </Link>
              <Link
                href="/tickets/new?category=PERFORMANCE"
                className="py-1.5 flex items-center justify-between text-slate-700 hover:text-slate-900 group"
              >
                <span>Troubleshooting Slow Ledger & Dashboard Loading</span>
                <span className="text-slate-400 group-hover:text-slate-700">→</span>
              </Link>
              <Link
                href="/tickets/new?category=INTEGRATION"
                className="py-1.5 flex items-center justify-between text-slate-700 hover:text-slate-900 group"
              >
                <span>Setting Up Webhooks & Accounting Integrations</span>
                <span className="text-slate-400 group-hover:text-slate-700">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            <p>© 2026 BUSY Infotech Pvt. Ltd. · Business Accounting Software Support</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Strictly authenticated · Immutable audit trail · Verified CSAT
            </p>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <Link href="/login" className="hover:text-slate-900 transition-colors">
              Staff Sign In
            </Link>
            <span>·</span>
            <Link href="/register" className="hover:text-slate-900 transition-colors">
              Register Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
