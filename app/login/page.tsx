"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, ShieldCheck, Headphones, Key, ArrowRight, Sparkles } from "lucide-react";

const DEMO_USERS = [
  {
    role: "Supervisor",
    name: "Suresh Menon",
    email: "supervisor@busy.com",
    password: "password123",
    description: "Full queue visibility, reassignments, ticket closing, and team analytics",
    icon: ShieldCheck,
    color: "indigo",
  },
  {
    role: "Senior Agent",
    name: "Sarah Jenkins",
    email: "sarah@busy.com",
    password: "password123",
    description: "Has assigned urgent breached tickets, collaborators, and pending tickets",
    icon: Headphones,
    color: "emerald",
  },
  {
    role: "Support Agent",
    name: "Alex Rivera",
    email: "alex@busy.com",
    password: "password123",
    description: "Has high priority due-soon tickets and active team collaborations",
    icon: Headphones,
    color: "sky",
  },
  {
    role: "Tier 1 Agent",
    name: "Jordan Lee",
    email: "jordan@busy.com",
    password: "password123",
    description: "Assigned low/medium tickets and recently closed resolutions",
    icon: Headphones,
    color: "slate",
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
    <div className="max-w-4xl mx-auto py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-3 shadow-md">
          <Inbox className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sign in to BusyDesk</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Support Ticketing Platform with strict server-side authorization and deadline-based SLA lifecycle.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Login Form */}
        <div className="lg:col-span-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" />
            <span>Account Login</span>
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@busy.com"
                required
                className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition"
            >
              <span>{loading ? "Authenticating..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right: Evaluator Demo Accounts */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-gradient-to-br from-indigo-50 to-slate-50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Evaluator Demo Accounts</span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Click any persona below to auto-fill the login fields and test server-side role permissions.
            </p>

            <div className="space-y-2.5">
              {DEMO_USERS.map((u) => {
                const Icon = u.icon;
                const isSelected = email === u.email;
                return (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => fillCredentials(u.email, u.password)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3.5 ${
                      isSelected
                        ? "bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                        : "bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        u.role === "Supervisor"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900">{u.name}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            u.role === "Supervisor"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</div>
                      <p className="text-xs text-slate-600 mt-1 leading-snug">{u.description}</p>
                    </div>
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
