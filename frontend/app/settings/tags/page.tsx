"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/session-context";
import { TagGroup, Tag } from "@/lib/types";
import { TagBadge } from "@/components/ui/TagBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Tag as TagIcon,
  FolderPlus,
  Plus,
  Edit2,
  Trash2,
  GitMerge,
  Search,
  Check,
  AlertCircle,
  ShieldAlert,
  Layers,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";

export default function TagManagementPage() {
  const { user } = useSession();
  const isSupervisor = user?.role === "SUPERVISOR";

  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Group Modal State
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TagGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupColor, setGroupColor] = useState("#8B5CF6");
  const [groupExclusive, setGroupExclusive] = useState(false);
  const [submittingGroup, setSubmittingGroup] = useState(false);

  // Tag Modal State
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#6B7280");
  const [tagTargetGroupId, setTagTargetGroupId] = useState<string>("");
  const [submittingTag, setSubmittingTag] = useState(false);

  // Merge Modal State
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [sourceTag, setSourceTag] = useState<Tag | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [submittingMerge, setSubmittingMerge] = useState(false);

  // Load Groups and Tags
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, tagsRes] = await Promise.all([
        fetch("/api/tag-groups"),
        fetch("/api/tags"),
      ]);

      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(data.groups || []);
      }
      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setTags(data.tags || []);
      }
    } catch {
      setActionError("Failed to load tag definitions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flash message helper
  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Group Handlers
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupDescription("");
    setGroupColor("#8B5CF6");
    setGroupExclusive(false);
    setGroupModalOpen(true);
  };

  const openEditGroup = (g: TagGroup) => {
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupDescription(g.description || "");
    setGroupColor(g.color || "#8B5CF6");
    setGroupExclusive(g.isExclusive);
    setGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      setSubmittingGroup(true);
      setActionError(null);

      const url = editingGroup ? `/api/tag-groups/${editingGroup.id}` : "/api/tag-groups";
      const method = editingGroup ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          color: groupColor,
          isExclusive: groupExclusive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save group.");

      showSuccess(`Tag group "${groupName}" saved successfully.`);
      setGroupModalOpen(false);
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to save tag group.");
    } finally {
      setSubmittingGroup(false);
    }
  };

  const handleDeleteGroup = async (g: TagGroup) => {
    if (!confirm(`Are you sure you want to delete "${g.name}"? Tags inside this group will become ungrouped.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/tag-groups/${g.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete group.");
      }
      showSuccess(`Group "${g.name}" deleted.`);
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Tag Handlers
  const openCreateTag = (defaultGroupId?: string) => {
    setEditingTag(null);
    setTagName("");
    setTagColor("#6B7280");
    setTagTargetGroupId(defaultGroupId || (selectedGroupId !== "ALL" && selectedGroupId !== "UNGROUPED" ? selectedGroupId : ""));
    setTagModalOpen(true);
  };

  const openEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setTagTargetGroupId(tag.groupId || "");
    setTagModalOpen(true);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    try {
      setSubmittingTag(true);
      setActionError(null);

      const url = editingTag ? `/api/tags/${editingTag.id}` : "/api/tags";
      const method = editingTag ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tagName.trim(),
          color: tagColor,
          groupId: tagTargetGroupId ? tagTargetGroupId : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save tag.");

      showSuccess(`Tag "${tagName}" saved.`);
      setTagModalOpen(false);
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingTag(false);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (!confirm(`Delete tag "${tag.name}"? It will be removed from all associated tickets.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete tag.");
      }
      showSuccess(`Tag "${tag.name}" deleted.`);
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Merge Handlers
  const openMergeModal = (tag: Tag) => {
    setSourceTag(tag);
    setMergeTargetId("");
    setMergeModalOpen(true);
  };

  const handleExecuteMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceTag || !mergeTargetId) return;

    try {
      setSubmittingMerge(true);
      setActionError(null);

      const res = await fetch(`/api/tags/${sourceTag.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTagId: mergeTargetId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to merge tags.");

      showSuccess(`Merged "${sourceTag.name}" into "${data.targetTag}". ${data.ticketsMigrated} tickets updated.`);
      setMergeModalOpen(false);
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingMerge(false);
    }
  };

  // Filtered tags list
  const filteredTags = tags.filter((t) => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup =
      selectedGroupId === "ALL" ||
      (selectedGroupId === "UNGROUPED" && !t.groupId) ||
      t.groupId === selectedGroupId;

    return matchesSearch && matchesGroup;
  });

  if (!isSupervisor) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState
          icon={<ShieldAlert className="w-10 h-10 text-amber-500" />}
          title="Supervisor Access Required"
          description="Only supervisors can manage tag definitions, label groups, and tag mergers."
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-slate-700" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Tag & Label Taxonomy
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure grouped labels (Linear-inspired), exclusivity policies, and free-form ticket tagging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={openCreateGroup}
            icon={<FolderPlus className="w-4 h-4" />}
          >
            New Group
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openCreateTag()}
            icon={<Plus className="w-4 h-4" />}
          >
            New Tag
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tag Groups Cards Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Label Groups ({groups.length})</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((g) => {
            const groupTagsCount = tags.filter((t) => t.groupId === g.id).length;
            const isSelected = selectedGroupId === g.id;

            return (
              <div
                key={g.id}
                onClick={() => setSelectedGroupId(isSelected ? "ALL" : g.id)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white shadow-2xs ${
                  isSelected
                    ? "border-primary-500 ring-2 ring-primary-500/10"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: g.color || "#6B7280" }}
                    />
                    <h3 className="text-sm font-semibold text-slate-900">{g.name}</h3>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEditGroup(g)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                      title="Edit group"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(g)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title="Delete group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {g.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description}</p>
                )}

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>{groupTagsCount} {groupTagsCount === 1 ? "tag" : "tags"}</span>
                  {g.isExclusive ? (
                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium border border-amber-200">
                      Exclusive (1 tag/ticket)
                    </span>
                  ) : (
                    <span className="text-slate-400">Multi-select</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tags Directory & Filtering */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">
            Tags ({filteredTags.length})
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tags..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:border-slate-900"
              />
            </div>

            {/* Filter Group Dropdown */}
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="UNGROUPED">Ungrouped Ad-hoc Tags</option>
            </select>
          </div>
        </div>

        {/* Tags Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Tag</th>
                <th className="py-2.5 px-3">Group</th>
                <th className="py-2.5 px-3">Slug</th>
                <th className="py-2.5 px-3 text-center">Usage Count</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-2.5 px-3"><div className="h-4 w-20 bg-slate-100 rounded-full" /></td>
                    <td className="py-2.5 px-3"><div className="h-3 w-16 bg-slate-100 rounded" /></td>
                    <td className="py-2.5 px-3"><div className="h-3 w-16 bg-slate-100 rounded" /></td>
                    <td className="py-2.5 px-3 text-center"><div className="h-3 w-8 bg-slate-100 rounded mx-auto" /></td>
                    <td className="py-2.5 px-3 text-right"><div className="h-4 w-12 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredTags.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No tags found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3">
                      <TagBadge tag={tag} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {tag.group ? (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.group.color || "#6B7280" }}
                          />
                          {tag.group.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Ungrouped</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {tag.slug}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">
                        {tag.usageCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openMergeModal(tag)}
                          title="Merge tag into another"
                          className="p-1 text-slate-400 hover:text-primary-600 rounded transition-colors"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditTag(tag)}
                          title="Edit tag"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          title="Delete tag"
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* Group Modal */}
      {groupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingGroup ? "Edit Tag Group" : "Create Tag Group"}
              </h3>
              <button
                onClick={() => setGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Platform, Environment, Component"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Optional context for agents..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Theme Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={groupColor}
                    onChange={(e) => setGroupColor(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0"
                  />
                  <span className="font-mono text-slate-600">{groupColor}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="exclusive-checkbox"
                  checked={groupExclusive}
                  onChange={(e) => setGroupExclusive(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="exclusive-checkbox" className="text-xs cursor-pointer">
                  <span className="font-semibold text-slate-900 block">Exclusive Group</span>
                  <span className="text-slate-500 text-[11px] block">
                    Tickets can only have 1 tag from this group at a time (e.g. Environment: Production).
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={submittingGroup}
                >
                  Save Group
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {tagModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingTag ? "Edit Tag" : "Create Tag"}
              </h3>
              <button
                onClick={() => setTagModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTag} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Tag Name</label>
                <input
                  type="text"
                  required
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. iOS, Production, Checkout"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Assign to Group</label>
                <select
                  value={tagTargetGroupId}
                  onChange={(e) => setTagTargetGroupId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900 bg-white"
                >
                  <option value="">(None - Ungrouped Tag)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.isExclusive ? "(Exclusive)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0"
                  />
                  <span className="font-mono text-slate-600">{tagColor}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setTagModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={submittingTag}
                >
                  Save Tag
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModalOpen && sourceTag && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-primary-500" />
                <span>Merge Tag</span>
              </h3>
              <button
                onClick={() => setMergeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Merging will re-link all tickets tagged with{" "}
              <strong className="text-slate-900">"{sourceTag.name}"</strong> to the target tag,
              aggregate usage counters, and delete the source tag.
            </p>

            <form onSubmit={handleExecuteMerge} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Target Tag to Merge Into</label>
                <select
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900 bg-white"
                >
                  <option value="" disabled>Select target tag...</option>
                  {tags
                    .filter((t) => t.id !== sourceTag.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.group ? `(${t.group.name})` : ""} [{t.usageCount} tickets]
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setMergeModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  type="submit"
                  disabled={!mergeTargetId}
                  loading={submittingMerge}
                >
                  Execute Merge
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
