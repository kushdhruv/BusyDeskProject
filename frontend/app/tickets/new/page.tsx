"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Priority, Category, User as SessionUser } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { ArrowLeft, AlertCircle } from "lucide-react";

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
    <div className="max-w-4xl mx-auto space-y-4 pb-16">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
        <Button
          variant="secondary"
          size="xs"
          onClick={() => router.push(isCustomer ? "/dashboard" : "/tickets")}
          icon={<ArrowLeft className="w-3.5 h-3.5" />}
          aria-label="Back"
        />
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            {isCustomer ? "Submit Support Request" : "Create New Ticket"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isCustomer
              ? "Describe your question or issue, and our team will respond shortly."
              : "Log a customer issue and assign it to an available support agent."}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Subject & Description */}
          <div className="lg:col-span-8 bg-white p-5 rounded-md border border-slate-200 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subject <span className="text-rose-500">*</span>
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the inquiry or problem..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description & Details <span className="text-rose-500">*</span>
              </label>
              <Textarea
                rows={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide detailed information, context, or reproduction steps..."
                required
              />
            </div>
          </div>

          {/* Right Column: Routing & Metadata */}
          <div className="lg:col-span-4 bg-white p-4 rounded-md border border-slate-200 shadow-xs space-y-3.5">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Routing & Properties
            </h3>

            {/* If staff: Requester Fields */}
            {!isCustomer && (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Requester Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="e.g. Alice Henderson"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Requester Email <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="email"
                    value={requesterEmail}
                    onChange={(e) => setRequesterEmail(e.target.value)}
                    placeholder="alice@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Priority Target
                  </label>
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full"
                  >
                    <option value="URGENT">Urgent (2h SLA)</option>
                    <option value="HIGH">High (8h SLA)</option>
                    <option value="MEDIUM">Medium (24h SLA)</option>
                    <option value="LOW">Low (72h SLA)</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Primary Assignee
                  </label>
                  <Select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {/* If Customer: Urgency */}
            {isCustomer && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Urgency Level
                </label>
                <Select
                  value={customerUrgency}
                  onChange={(e) => setCustomerUrgency(e.target.value as any)}
                  className="w-full"
                >
                  <option value="LOW">Low — general question</option>
                  <option value="NORMAL">Normal — standard issue</option>
                  <option value="HIGH">High — blocking workflow</option>
                </Select>
              </div>
            )}

            {/* Category for both */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Category
              </label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full"
              >
                <option value="QUESTION">Question</option>
                <option value="BUG">Bug</option>
                <option value="BILLING">Billing</option>
                <option value="FEATURE">Feature Request</option>
              </Select>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={loading}
                className="w-full"
              >
                {isCustomer ? "Submit Request" : "Create Ticket"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => router.push(isCustomer ? "/dashboard" : "/tickets")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
