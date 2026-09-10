"use client";

import React, { useState, useEffect } from "react";
import { Role } from "@prisma/client";
import { Search, X, Check, Info, UserPlus, Loader2 } from "lucide-react";

interface AgentItem {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export function AddCollaboratorModal({
  isOpen,
  onClose,
  ticketId,
  existingCollaboratorIds,
  primaryAssigneeId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  existingCollaboratorIds: string[];
  primaryAssigneeId: string | null;
  onSuccess: () => void;
}) {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAgentIds([]);
      setSearchQuery("");
      setErrorMsg(null);
      return;
    }

    const fetchAgents = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          // Filter out users who are already the primary assignee or already a collaborator
          const available = (data.users || []).filter(
            (u: AgentItem) =>
              u.id !== primaryAssigneeId && !existingCollaboratorIds.includes(u.id)
          );
          setAgents(available);
        }
      } catch {
        setErrorMsg("Failed to load agents list.");
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [isOpen, primaryAssigneeId, existingCollaboratorIds]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    if (selectedAgentIds.includes(id)) {
      setSelectedAgentIds(selectedAgentIds.filter((item) => item !== id));
    } else {
      setSelectedAgentIds([...selectedAgentIds, id]);
    }
  };

  const handleAddSubmit = async () => {
    if (selectedAgentIds.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Add each selected collaborator
      for (const userId of selectedAgentIds) {
        const res = await fetch(`/api/tickets/${ticketId}/collaborators`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to add collaborator");
        }
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add collaborators.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  // Color generator for agent avatars
  const avatarColors = [
    "bg-indigo-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-emerald-600",
    "bg-cyan-600",
    "bg-purple-600",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Add Collaborators</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add team members who can also view, reply and update this ticket.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white text-xs text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Agents List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              Loading available team members...
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              {searchQuery ? "No matching team members found." : "All team members are already assigned or collaborating."}
            </div>
          ) : (
            filteredAgents.map((agent, index) => {
              const isSelected = selectedAgentIds.includes(agent.id);
              const colorClass = avatarColors[index % avatarColors.length];

              return (
                <div
                  key={agent.id}
                  onClick={() => toggleSelect(agent.id)}
                  className={`flex items-center justify-between py-3 px-3 rounded-xl cursor-pointer transition select-none ${
                    isSelected ? "bg-blue-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by container
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div
                      className={`w-8 h-8 rounded-full ${colorClass} text-white font-bold text-xs flex items-center justify-center shadow-xs flex-shrink-0`}
                    >
                      {getInitials(agent.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {agent.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{agent.email}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      agent.role === Role.SUPERVISOR
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {agent.role === Role.SUPERVISOR ? "Supervisor" : "Agent"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Info Banner */}
        <div className="px-6 py-2.5 bg-blue-50/60 border-t border-blue-100 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-800 leading-normal">
            Collaborators can view, reply and update the ticket. Only supervisors can reassign the primary assignee.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddSubmit}
            disabled={selectedAgentIds.length === 0 || submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Collaborators {selectedAgentIds.length > 0 && `(${selectedAgentIds.length})`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
