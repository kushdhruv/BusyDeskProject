"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Headphones,
  Check,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "@/lib/session-context";

function SetupAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useSession();

  const token = searchParams.get("token") || "";

  const [isValidating, setIsValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setTokenError("No invitation token was provided in the link.");
      return;
    }

    const checkToken = async () => {
      try {
        setIsValidating(true);
        const res = await fetch(`/api/auth/invitation?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!data.valid) {
          setTokenError(data.error || "This invitation link is invalid or has expired.");
        } else {
          setAgentData({
            name: data.name,
            email: data.email,
            role: data.role,
          });
        }
      } catch {
        setTokenError("Unable to verify invitation link. Please check your network connection.");
      } finally {
        setIsValidating(false);
      }
    };

    checkToken();
  }, [token]);

  // Password validation rules
  const hasMinLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isFormValid = hasMinLength && hasMixedCase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isFormValid) {
      setSubmitError("Please meet all password requirements before continuing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/setup-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set up account.");
      }

      // Refresh session state and navigate to tickets workspace
      await refreshUser();
      router.push("/tickets");
    } catch (err: any) {
      setSubmitError(err.message || "Failed to activate account.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900 text-white mb-4 shadow-sm">
          <Headphones className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Busy Infotech Support
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Agent Account Activation & Security Setup
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-sm border border-slate-200 rounded-xl">
          {isValidating ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-slate-900 mb-2" />
              <p className="text-xs font-medium text-slate-600">Verifying your invitation token...</p>
            </div>
          ) : tokenError ? (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Invitation Link Invalid</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {tokenError}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <p className="text-[11px] text-slate-400">
                  Invitation tokens expire automatically after 24 hours. Contact your supervisor to request a fresh invitation.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                >
                  Go to Login
                </Link>
              </div>
            </div>
          ) : agentData ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Agent Greeting & Confirmation */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-slate-900" />
                  <span className="text-xs font-semibold text-slate-900">
                    Welcome, {agentData.name}!
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  You are setting up your account for{" "}
                  <strong className="text-slate-700 font-mono">{agentData.email}</strong>.
                </p>
              </div>

              {submitError && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Create Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter secure password"
                    className="w-full pl-9 pr-10 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
                  />
                </div>
              </div>

              {/* Security Checklist */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5 text-[11px]">
                <p className="font-semibold text-slate-700 mb-1">Security Checklist:</p>
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      hasMinLength ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span className={hasMinLength ? "text-slate-800" : "text-slate-400"}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      hasMixedCase ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span className={hasMixedCase ? "text-slate-800" : "text-slate-400"}>
                    Uppercase & lowercase letters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      hasNumber ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span className={hasNumber ? "text-slate-800" : "text-slate-400"}>
                    At least one number
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      passwordsMatch ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span className={passwordsMatch ? "text-slate-800" : "text-slate-400"}>
                    Passwords match
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors shadow-2xs cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Activate Account & Sign In</span>
                  </>
                )}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-900 mb-2" />
            <span className="text-xs text-slate-500">Loading account setup...</span>
          </div>
        </div>
      }
    >
      <SetupAccountContent />
    </Suspense>
  );
}

