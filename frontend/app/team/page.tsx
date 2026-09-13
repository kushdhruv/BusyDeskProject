"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "@/lib/session-context";
import { TeamMember } from "@/lib/types";
import { InviteAgentModal } from "@/components/team/InviteAgentModal";
import { EditAgentModal } from "@/components/team/EditAgentModal";
import { Button } from "@/components/ui/Button";
import {
  Users,
  UserPlus,
  Shield,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Loader2,
  Ticket,
  Sliders,
  Trash2,
} from "lucide-react";

export default function TeamManagementPage() {
  const { user } = useSession();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/agents");
      if (!res.ok) {
        throw new Error("Failed to load team directory");
      }
      const data = await res.json();
      setTeam(data.team || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "SUPERVISOR") {
      fetchTeam();
    }
  }, [user, fetchTeam]);

  const handleResend = async (agentId: string, email: string) => {
    try {
      setResendingId(agentId);
      const res = await fetch(`/api/agents/${agentId}/resend-invite`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend invite.");
      }

      showToast(`Fresh invitation dispatched to ${email}! (Valid for 24h)`);
      fetchTeam();
    } catch (err: any) {
      alert(err.message || "Failed to resend invite.");
    } finally {
      setResendingId(null);
    }
  };

  const handleCancelInvite = async (agentId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke and delete the invitation for ${email}?`)) {
      return;
    }

    try {
      setCancellingId(agentId);
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel invitation.");
      }

      showToast(`Invitation for ${email} has been revoked.`);
      fetchTeam();
    } catch (err: any) {
      alert(err.message || "Failed to cancel invitation.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleReactivate = async (member: TeamMember) => {
    try {
      const res = await fetch(`/api/agents/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reactivate agent.");
      }
      showToast(`Account for ${member.name} has been restored to Active.`);
      fetchTeam();
    } catch (err: any) {
      alert(err.message || "Failed to reactivate agent.");
    }
  };

  if (!user || user.role !== "SUPERVISOR") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Only Supervisors have authorization to access staff provisioning and team management.
        </p>
      </div>
    );
  }

  const totalMembers = team.length;
  const activeMembers = team.filter((m) => m.status === "ACTIVE").length;
  const suspendedMembers = team.filter((m) => m.status === "SUSPENDED").length;
  const pendingInvitations = team.filter((m) => m.status === "PENDING_SETUP").length;
  const totalAssignedTickets = team.reduce((acc, m) => acc + m.activeTicketCount, 0);

  return (
    <div className="space-y-5 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-md shadow-lg flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">Team Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Provision support agents, manage permission roles, revoke access, and monitor workloads.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsInviteOpen(true)}
          icon={<UserPlus className="w-3.5 h-3.5" />}
        >
          Invite New Agent
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white rounded-md border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Staff</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{totalMembers}</p>
        </div>

        <div className="p-3.5 bg-white rounded-md border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-600 mt-1 tabular-nums">{activeMembers}</p>
        </div>

        <div className="p-3.5 bg-white rounded-md border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Suspended</span>
            <Lock className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-bold text-rose-600 mt-1 tabular-nums">{suspendedMembers}</p>
        </div>

        <div className="p-3.5 bg-white rounded-md border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Setup</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-600 mt-1 tabular-nums">{pendingInvitations}</p>
        </div>

        <div className="p-3.5 bg-white rounded-md border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Open Assigned</span>
            <Ticket className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{totalAssignedTickets}</p>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-slate-200 rounded-md shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Staff Directory</h2>
          <span className="text-[11px] text-slate-500 font-medium">{team.length} Members</span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
            <span className="text-xs mt-2 font-medium">Loading staff directory...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-rose-500" />
            {error}
          </div>
        ) : team.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No agents registered yet. Click &quot;Invite New Agent&quot; to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/30 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3">Active Tickets</th>
                  <th className="px-4 py-3">Date Added</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {team.map((member) => {
                  const isPending = member.status === "PENDING_SETUP";
                  const isSuspended = member.status === "SUSPENDED";
                  const isExpired = member.pendingInvitation?.isExpired;
                  const isSupervisor = member.role === "SUPERVISOR";
                  const isSelf = user?.id === member.id;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name + Email */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900">{member.name}</p>
                              {isSelf && (
                                <span className="text-[10px] text-slate-400 font-mono">(You)</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono">{member.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5">
                        {isSupervisor ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Shield className="w-3 h-3" />
                            Supervisor
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Support Agent
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {isPending ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                              isExpired
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {isExpired ? "Invite Expired" : "Invited (Pending Setup)"}
                          </span>
                        ) : isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <Lock className="w-3 h-3 text-rose-500" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Active Ticket Load */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${
                            member.activeTicketCount > 5
                              ? "bg-rose-100 text-rose-800"
                              : member.activeTicketCount > 0
                              ? "bg-slate-100 text-slate-800"
                              : "text-slate-400 font-normal"
                          }`}
                        >
                          {member.activeTicketCount} {member.activeTicketCount === 1 ? "ticket" : "tickets"}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                        {new Date(member.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleResend(member.id, member.email)}
                                disabled={resendingId === member.id || cancellingId === member.id}
                                title="Rotate and resend 24-hour invitation link"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {resendingId === member.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                <span>Resend</span>
                              </button>

                              <button
                                onClick={() => handleCancelInvite(member.id, member.email)}
                                disabled={cancellingId === member.id || resendingId === member.id}
                                title="Revoke and cancel this invitation"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 bg-white border border-rose-200 hover:bg-rose-50 rounded transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {cancellingId === member.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                <span>Cancel</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {isSuspended && (
                                <button
                                  onClick={() => handleReactivate(member)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/70 rounded transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Reactivate</span>
                                </button>
                              )}

                              <button
                                onClick={() => setEditingMember(member)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                              >
                                <Sliders className="w-3 h-3 text-slate-500" />
                                <span>Permissions</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <InviteAgentModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSuccess={fetchTeam}
      />

      {/* Edit Permissions Modal */}
      <EditAgentModal
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        member={editingMember}
        activeAgents={team}
        currentUserId={user?.id}
        onSuccess={(msg) => {
          showToast(msg);
          fetchTeam();
        }}
      />
    </div>
  );
}
