"use client";

import React, { useState, useEffect } from "react";
import { Role } from "@/lib/types";
import { Search, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Collaborators"
      description="Collaborators can view, reply, and add internal notes to this ticket."
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddSubmit}
            loading={submitting}
            disabled={selectedAgentIds.length === 0}
          >
            Add {selectedAgentIds.length > 0 ? `(${selectedAgentIds.length})` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name or email..."
            className="pl-8"
          />
        </div>

        {errorMsg && (
          <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Agent List */}
        <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-400 text-xs">Loading agents...</div>
          ) : filteredAgents.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">
              {searchQuery ? "No matching agents found." : "No available agents to add."}
            </div>
          ) : (
            filteredAgents.map((agent) => {
              const isSelected = selectedAgentIds.includes(agent.id);
              return (
                <div
                  key={agent.id}
                  onClick={() => toggleSelect(agent.id)}
                  className={`p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                    isSelected ? "bg-slate-50 font-medium" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[10px] flex items-center justify-center">
                      {agent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-slate-900 leading-tight">{agent.name}</p>
                      <p className="text-[11px] text-slate-500 leading-tight">{agent.email}</p>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
