"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Priority, Category, Role } from "@prisma/client";
import { SessionUser } from "@/lib/types";
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
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/tickets")}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create New Ticket</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fill in the details to log a new customer support ticket
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Subject & Rich Description */}
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
                placeholder="e.g. Unable to access account or checkout failure"
                required
                className="w-full text-xs border border-slate-200 rounded-lg p-3 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-800"
              />
            </div>

            {/* Description with Toolbar */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Description <span className="text-rose-500">*</span>
              </label>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition">
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
                  placeholder="Provide full description, customer reproduction steps, or relevant error logs..."
                  required
                  className="w-full text-xs p-3 bg-transparent border-0 outline-none resize-y text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Requester, Priority, Category, Assignee */}
          <div className="lg:col-span-4 space-y-5">
            {/* Requester Details Card */}
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
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
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
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Ticket Attributes Card */}
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
                  <option value={Priority.URGENT}>Urgent (2h SLA)</option>
                  <option value={Priority.HIGH}>High (8h SLA)</option>
                  <option value={Priority.MEDIUM}>Medium (24h SLA)</option>
                  <option value={Priority.LOW}>Low (72h SLA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 outline-none cursor-pointer"
                >
                  <option value={Category.BUG}>Bug</option>
                  <option value={Category.BILLING}>Billing</option>
                  <option value={Category.FEATURE}>Feature</option>
                  <option value={Category.QUESTION}>Question</option>
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
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => router.push("/tickets")}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{loading ? "Creating Ticket..." : "Create Ticket"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
