"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Priority, Category, Role } from "@prisma/client";
import { SessionUser } from "@/lib/types";
import { ArrowLeft, PlusCircle, AlertCircle, Sparkles } from "lucide-react";

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
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [category, setCategory] = useState<Category>(Category.QUESTION);
  const [assigneeId, setAssigneeId] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((d) => {
        setUser(d.user);
        if (d.user && d.user.role === Role.AGENT) {
          setAssigneeId(d.user.id);
        }
      });

    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((d) => setAgents(d.users || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          description,
          requesterName,
          requesterEmail,
          priority,
          category,
          primaryAssigneeId: assigneeId || undefined,
        }),
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

  const isSupervisor = user?.role === Role.SUPERVISOR;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/tickets")}
          className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Support Ticket</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log a new customer request into the shared company queue
          </p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ticket Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Production Payment Gateway 500 error on checkout"
              required
              className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detailed Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide complete context, customer steps to reproduce, or relevant logs..."
              required
              className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Requester Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer / Requester Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Marcus Vance"
                required
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Requester Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                placeholder="marcus@acmecorp.com"
                required
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Priority & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority & Response SLA
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full text-sm py-2.5 px-3 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none"
              >
                <option value={Priority.URGENT}>Urgent (2-Hour SLA Target)</option>
                <option value={Priority.HIGH}>High (8-Hour SLA Target)</option>
                <option value={Priority.MEDIUM}>Medium (24-Hour SLA Target)</option>
                <option value={Priority.LOW}>Low (72-Hour SLA Target)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full text-sm py-2.5 px-3 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none"
              >
                <option value={Category.BUG}>Bug / Defect</option>
                <option value={Category.BILLING}>Billing & Invoices</option>
                <option value={Category.FEATURE}>Feature Request</option>
                <option value={Category.QUESTION}>General Question</option>
              </select>
            </div>
          </div>

          {/* Assignee Selection (Supervisor can assign; Agent auto-assigns) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Assignee
            </label>
            {isSupervisor ? (
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full text-sm py-2.5 px-3 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none"
              >
                <option value="">Leave Unassigned in Shared Queue</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                Tickets created by agents are automatically assigned to you (<strong>{user?.name}</strong>) so you immediately have permissions to work on them.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/tickets")}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? "Creating Ticket..." : "Create Ticket"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
