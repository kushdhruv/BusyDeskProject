"use client";

import React, { useState, useEffect } from "react";
import { TeamMember, Role, UserStatus } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  Shield,
  UserCheck,
  AlertTriangle,
  X,
  Lock,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

interface EditAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  activeAgents: TeamMember[];
  currentUserId?: string;
  onSuccess: (message: string) => void;
}

export function EditAgentModal({
  isOpen,
  onClose,
  member,
  activeAgents,
  currentUserId,
  onSuccess,
}: EditAgentModalProps) {
  const [role, setRole] = useState<Role>("AGENT");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [reassignTo, setReassignTo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setStatus(member.status);
      setReassignTo("");
      setError(null);
    }
  }, [member, isOpen]);

  if (!isOpen || !member) return null;

  const isSelf = currentUserId === member.id;
  const isSuspending = status === "SUSPENDED" && member.status !== "SUSPENDED";
  const hasActiveTickets = member.activeTicketCount > 0;
  const otherActiveStaff = activeAgents.filter(
    (a) => a.id !== member.id && a.status === "ACTIVE"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Safeguards
    if (isSelf && status === "SUSPENDED") {
      setError("You cannot suspend your own supervisor account.");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        role,
        status,
      };

      if (status === "SUSPENDED" && hasActiveTickets) {
        payload.reassignTicketsToId = reassignTo || "unassign";
      }

      const res = await fetch(`/api/agents/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update agent.");
      }

      let successMsg = `Updated permissions for ${member.name}.`;
      if (data.reassignedTicketsCount > 0) {
        successMsg += ` Reassigned ${data.reassignedTicketsCount} ticket(s) to ${data.reassignedTo}.`;
      }

      onSuccess(successMsg);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Edit Staff Permissions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage role, access privileges, and account status.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Member Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{member.name}</p>
              <p className="text-slate-500 font-mono text-[11px]">{member.email}</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-600 block">
                {member.activeTicketCount} active tickets
              </span>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-1.5">
            <label className="block font-medium text-slate-700">
              Role & Permissions
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("AGENT")}
                className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                  role === "AGENT"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <div>
                  <p className="font-medium text-xs">Support Agent</p>
                  <p className={`text-[10px] ${role === "AGENT" ? "text-slate-300" : "text-slate-400"}`}>
                    Queue & Replies
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole("SUPERVISOR")}
                className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                  role === "SUPERVISOR"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <Shield className="w-4 h-4" />
                <div>
                  <p className="font-medium text-xs">Supervisor</p>
                  <p className={`text-[10px] ${role === "SUPERVISOR" ? "text-slate-300" : "text-slate-400"}`}>
                    Full Admin Access
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Account Status Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="block font-medium text-slate-700">
              Account Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus("ACTIVE")}
                className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                  status === "ACTIVE"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-xs">Active</p>
                  <p className="text-[10px] text-slate-400 font-normal">Normal system access</p>
                </div>
              </button>

              <button
                type="button"
                disabled={isSelf}
                onClick={() => setStatus("SUSPENDED")}
                className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                  isSelf
                    ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
                    : status === "SUSPENDED"
                    ? "bg-rose-50 border-rose-300 text-rose-800 font-semibold"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <Lock className="w-4 h-4 text-rose-600" />
                <div>
                  <p className="text-xs">Suspended</p>
                  <p className="text-[10px] text-slate-400 font-normal">Revoke login access</p>
                </div>
              </button>
            </div>
            {isSelf && (
              <p className="text-[11px] text-slate-400 italic">
                You cannot suspend your own supervisor account.
              </p>
            )}
          </div>

          {/* Ticket Reassignment when Suspending */}
          {isSuspending && hasActiveTickets && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md space-y-2">
              <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Reassign Open Tickets ({member.activeTicketCount})</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                This member currently has {member.activeTicketCount} open ticket(s).
                Select an active agent to receive their assigned tickets:
              </p>
              <Select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className="w-full bg-white"
              >
                <option value="unassign">Unassign tickets (return to queue)</option>
                {otherActiveStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    Reassign to {staff.name} ({staff.activeTicketCount} active)
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={status === "SUSPENDED" ? "danger" : "primary"}
              size="xs"
              loading={loading}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
