"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Headphones, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
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
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid email or password.");
      }

      const redirect = searchParams.get("redirect");
      const targetUrl = redirect && redirect.startsWith("/") ? redirect : "/dashboard";
      window.location.href = targetUrl;
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-12 px-4">
      {/* Top Back Link */}
      <div className="w-full max-w-sm mb-3 flex items-center justify-start">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Homepage</span>
        </Link>
      </div>

      {/* Brand Header */}
      <div className="text-center mb-6">
        <Link href="/" className="inline-flex flex-col items-center group cursor-pointer">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-slate-900 text-white mb-2 shadow-xs group-hover:bg-slate-800 transition-colors">
            <Headphones className="w-4 h-4 text-sky-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight group-hover:text-slate-700 transition-colors">SupportDesk</h1>
        </Link>
        <p className="text-xs text-slate-500 mt-0.5">
          Enterprise support ticketing & SLA management
        </p>
      </div>

      {/* Centered Login Card */}
      <div className="w-full max-w-sm bg-white p-6 rounded-md shadow-xs border border-slate-200">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Sign in to your account</h2>
          <p className="text-xs text-slate-500 mt-0.5">Enter your work email and password</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pr-8"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            className="w-full mt-2"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </form>

        <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col items-center gap-1.5 text-center">
          <p className="text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-slate-900 hover:underline">
              Create an account
            </Link>
          </p>
          <Link
            href="/"
            className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors pt-1"
          >
            ← Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

