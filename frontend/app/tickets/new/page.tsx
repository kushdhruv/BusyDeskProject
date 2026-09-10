"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Priority, Category, User as SessionUser } from "@/lib/types";
import {
  ArrowLeft,
  Plus,
  AlertCircle,
  Sparkles,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Code,
  User,
  ShieldCheck,
  Send,
} from "lucide-react";

export default function NewTicketPage() {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [customerUrgency, setCustomerUrgency] = useState<"LOW" | "NORMAL" | "HIGH">("NORMAL");
  const [category, setCategory] = useState<Category>("QUESTION");
  const [assigneeId, setAssigneeId] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((d) => {
        setUser(d.user);
        if (d.user && d.user.role === "AGENT") {
          setAssigneeId(d.user.id);
        }
      });

    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((d) => setAgents(d.users || []));
  }, []);

  const isCustomer = user?.role === "CUSTOMER";
  const isSupervisor = user?.role === "SUPERVISOR";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        subject: subject.trim(),
        description: description.trim(),
        category,
      };

      if (isCustomer) {
        payload.customerUrgency = customerUrgency;
      } else {
        payload.requesterName = requesterName.trim();
        payload.requesterEmail = requesterEmail.trim();
        payload.priority = priority;
        payload.primaryAssigneeId = assigneeId || undefined;
      }

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create ticket.");
      }

      const { ticket } = await res.json();
      router.push(`/tickets/${ticket.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(isCustomer ? "/dashboard" : "/tickets")}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {isCustomer ? "Submit a Support Request" : "Create New Ticket"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isCustomer
              ? "Describe your question or issue, and our support team will respond promptly."
              : "Fill in the details to log a new customer support ticket."}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Subject & Rich Description */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  isCustomer
                    ? "e.g. Need assistance with invoice or export bug"
                    : "e.g. Unable to access account or checkout failure"
                }
                required
                className="w-full text-xs border border-slate-200 rounded-lg p-3 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-slate-800"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Description & Details <span className="text-rose-500">*</span>
              </label>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition">
                {/* Formatting Tools */}
                <div className="flex items-center gap-1 p-2 border-b border-slate-200 bg-slate-100/50 text-slate-500">
                  <button type="button" className="p-1 hover:bg-slate-200 rounded">
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="p-1 hover:bg-slate-200 rounded">
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="p-1 hover:bg-slate-200 rounded">
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-px h-3.5 bg-slate-300 mx-1" />
                  <button type="button" className="p-1 hover:bg-slate-200 rounded">
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="p-1 hover:bg-slate-200 rounded">
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="p-1 hover:bg-slate-200 rounded">
                    <Link className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="p-1 hover:bg-slate-200 rounded">
                    <Code className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    isCustomer
                      ? "Please describe what happened, steps to reproduce, or what you need help with..."
                      : "Provide full description, customer reproduction steps, or relevant error logs..."
                  }
                  required
                  className="w-full text-xs p-3 bg-transparent border-0 outline-none resize-y text-slate-800 leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-5">
            {/* Customer view: identity & Urgency */}
            {isCustomer ? (
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Request Info
                </h3>

                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1">
                  <span className="text-[11px] font-semibold text-indigo-900 block">Submitting As</span>
                  <p className="text-xs font-bold text-slate-900">{user?.name}</p>
                  <p className="text-[11px] text-slate-500">{user?.email}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="QUESTION">General Question</option>
                    <option value="BUG">Bug or Error</option>
                    <option value="BILLING">Billing & Account</option>
                    <option value="FEATURE">Feature Suggestion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Urgency Level
                  </label>
                  <select
                    value={customerUrgency}
                    onChange={(e) => setCustomerUrgency(e.target.value as any)}
                    className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="NORMAL">Normal — Standard response</option>
                    <option value="HIGH">High — Impaired workflow or blocking bug</option>
                    <option value="LOW">Low — Non-urgent question</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Our team prioritizes requests based on urgency and SLA commitments.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Staff view: Requester Details */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Requester Details
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="e.g. John Doe"
                      required
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={requesterEmail}
                      onChange={(e) => setRequesterEmail(e.target.value)}
                      placeholder="john@example.com"
                      required
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Staff view: Ticket Attributes */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Attributes & SLA
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="URGENT">Urgent (2h SLA)</option>
                      <option value="HIGH">High (8h SLA)</option>
                      <option value="MEDIUM">Medium (24h SLA)</option>
                      <option value="LOW">Low (72h SLA)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Category)}
                      className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="BUG">Bug</option>
                      <option value="BILLING">Billing</option>
                      <option value="FEATURE">Feature</option>
                      <option value="QUESTION">Question</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary Assignee
                    </label>
                    {isSupervisor ? (
                      <select
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                        className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 outline-none cursor-pointer"
                      >
                        <option value="">Leave Unassigned (Shared Queue)</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                        Auto-assigning to you (<strong>{user?.name}</strong>)
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => router.push(isCustomer ? "/dashboard" : "/tickets")}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{loading ? "Submitting..." : isCustomer ? "Submit Request" : "Create Ticket"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
