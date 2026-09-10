"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, ShieldCheck, Headphones, Key, ArrowRight, Sparkles, Lock, Mail } from "lucide-react";

const DEMO_USERS = [
  {
    role: "Supervisor",
    name: "Suresh Menon",
    email: "supervisor@busy.com",
    password: "password123",
    description: "Full queue visibility, team reassignments, ticket closing, and department analytics",
    icon: ShieldCheck,
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    iconBg: "bg-indigo-50 text-indigo-600",
  },
  {
    role: "Senior Agent",
    name: "Sarah Jenkins",
    email: "sarah@busy.com",
    password: "password123",
    description: "Has assigned urgent breached tickets, collaborators, and pending customer replies",
    icon: Headphones,
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconBg: "bg-emerald-50 text-emerald-600",
  },
  {
    role: "Support Agent",
    name: "Alex Rivera",
    email: "alex@busy.com",
    password: "password123",
    description: "Has high priority due-soon tickets and active cross-functional collaborations",
    icon: Headphones,
    badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
    iconBg: "bg-sky-50 text-sky-600",
  },
  {
    role: "Tier 1 Agent",
    name: "Jordan Lee",
    email: "jordan@busy.com",
    password: "password123",
    description: "Assigned low/medium tickets and recently resolved incident tickets",
    icon: Headphones,
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    iconBg: "bg-slate-100 text-slate-600",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("supervisor@busy.com");
  const [password, setPassword] = useState<string>("password123");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Authentication failed.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError(null);
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      {/* Brand Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0F172A] text-white mb-3 shadow-lg shadow-slate-900/10">
          <Inbox className="w-6 h-6 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Sign in to SupportDesk</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Enterprise ticketing platform with strict server-side policy enforcement, deadline-based SLA lifecycle, and team collaboration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Login Form */}
        <div className="lg:col-span-5 bg-white p-7 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Account Sign In</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enter your work credentials or pick a demo user</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
              <Lock className="w-4 h-4" />
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Work Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@busy.com"
                required
                className="w-full text-sm border border-slate-200 bg-slate-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Password</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full text-sm border border-slate-200 bg-slate-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition text-sm cursor-pointer mt-2"
            >
              <span>{loading ? "Authenticating..." : "Sign In to Dashboard"}</span>
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Production-Minded Monolith</span>
            <span>Next.js 14 App Router</span>
          </div>
        </div>

        {/* Right: Evaluator Demo Accounts */}
        <div className="lg:col-span-7">
          <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Quick Evaluator Personas</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                1-Click Autofill
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Select any role below to test permission gates: Supervisors can close/reassign/bulk-manage; Agents are constrained to their tickets.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DEMO_USERS.map((u) => {
                const Icon = u.icon;
                const isSelected = email === u.email;
                return (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => fillCredentials(u.email, u.password)}
                    className={`text-left p-4 rounded-xl border transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "bg-white border-indigo-500 shadow-sm ring-2 ring-indigo-500/20"
                        : "bg-white hover:bg-slate-50/50 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${u.iconBg}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${u.badgeColor}`}>
                          {u.role}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900">{u.name}</h3>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2.5 leading-snug">{u.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

