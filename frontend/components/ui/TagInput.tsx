"use client";

import React, { useState, useEffect, useRef } from "react";
import { Tag, TagGroup } from "@/lib/types";
import { TagBadge } from "./TagBadge";

interface TagInputProps {
  selectedTags: Tag[];
  onAddTag: (tag: Tag) => Promise<void> | void;
  onRemoveTag: (tagId: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  selectedTags,
  onAddTag,
  onRemoveTag,
  disabled = false,
  placeholder = "Add tags...",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Tag[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setErrorMsg(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch tag groups on mount or when opening
  useEffect(() => {
    if (isOpen && tagGroups.length === 0) {
      fetch("/api/tag-groups")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (data.groups) setTagGroups(data.groups);
        })
        .catch(() => {});
    }
  }, [isOpen, tagGroups.length]);

  // Debounced tag search
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      setIsLoading(true);
      const url = query.trim()
        ? `/api/tags/search?q=${encodeURIComponent(query.trim())}`
        : `/api/tags`;

      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          setSearchResults(data.tags || []);
        })
        .catch(() => {
          setSearchResults([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 150);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleSelectTag = async (tag: Tag) => {
    try {
      setErrorMsg(null);
      await onAddTag(tag);
      setQuery("");
      inputRef.current?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add tag.");
    }
  };

  const handleCreateAndAdd = async () => {
    const trimmed = query.trim();
    if (!trimmed || isCreating) return;

    try {
      setIsCreating(true);
      setErrorMsg(null);

      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create tag.");
      }

      await onAddTag(data.tag);
      setQuery("");
      inputRef.current?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || "Could not create tag.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !query && selectedTags.length > 0) {
      const lastTag = selectedTags[selectedTags.length - 1];
      onRemoveTag(lastTag.id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // If there is an exact or first match in search, pick it
      const exactMatch = searchResults.find(
        (t) => t.name.toLowerCase() === query.trim().toLowerCase()
      );
      if (exactMatch) {
        handleSelectTag(exactMatch);
      } else if (query.trim()) {
        handleCreateAndAdd();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Group search results by group name
  const groupedResults = React.useMemo(() => {
    const map = new Map<string, { group: TagGroup | null; tags: Tag[] }>();

    // Initialise with known tag groups
    tagGroups.forEach((g) => {
      map.set(g.id, { group: g, tags: [] });
    });
    map.set("ungrouped", { group: null, tags: [] });

    searchResults.forEach((tag) => {
      const gId = tag.groupId || "ungrouped";
      if (!map.has(gId)) {
        map.set(gId, { group: tag.group as TagGroup || null, tags: [] });
      }
      map.get(gId)!.tags.push(tag);
    });

    return Array.from(map.values()).filter((item) => item.tags.length > 0);
  }, [searchResults, tagGroups]);

  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const hasExactMatch = searchResults.some(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className={`relative text-sm ${className}`}>
      {/* Input container with tag pills */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`flex flex-wrap items-center gap-1.5 p-2 rounded-lg border bg-white dark:bg-zinc-900 transition-all ${
          disabled
            ? "opacity-60 cursor-not-allowed bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
            : isOpen
            ? "border-primary-500 ring-2 ring-primary-500/10 dark:border-primary-500"
            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
        }`}
      >
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            size="sm"
            showGroupPrefix={true}
            onRemove={disabled ? undefined : () => onRemoveTag(tag.id)}
          />
        ))}

        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTags.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] bg-transparent outline-hidden text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-sm py-0.5"
          />
        )}
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <p className="mt-1 text-xs text-red-500 font-medium px-1">{errorMsg}</p>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-1.5 space-y-2">
          {/* Create new tag action if user typed something new */}
          {query.trim() && !hasExactMatch && (
            <button
              type="button"
              onClick={handleCreateAndAdd}
              disabled={isCreating}
              className="w-full flex items-center justify-between px-3 py-2 text-left rounded-md text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors font-medium cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-sm">
                  + Create
                </span>
                <span className="truncate">"{query.trim()}"</span>
              </div>
              <span className="text-xs text-zinc-400">Press Enter</span>
            </button>
          )}

          {isLoading ? (
            <div className="py-4 text-center text-xs text-zinc-400">
              Searching tags...
            </div>
          ) : searchResults.length === 0 && !query.trim() ? (
            <div className="py-4 text-center text-xs text-zinc-400">
              No tags available. Type to create one.
            </div>
          ) : (
            groupedResults.map((groupItem) => (
              <div key={groupItem.group?.id || "ungrouped"} className="space-y-1">
                <div className="flex items-center justify-between px-2 pt-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  <span>{groupItem.group?.name || "Other Tags"}</span>
                  {groupItem.group?.isExclusive && (
                    <span className="text-[10px] text-amber-500 lowercase font-normal">
                      exclusive
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 px-1">
                  {groupItem.tags.map((tag) => {
                    const isSelected = selectedIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            onRemoveTag(tag.id);
                          } else {
                            handleSelectTag(tag);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                          isSelected
                            ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                            : "bg-zinc-50 dark:bg-zinc-800/40 border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tag.color || "#6B7280" }}
                        />
                        <span>{tag.name}</span>
                        {isSelected && (
                          <svg className="w-3 h-3 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TagInput;
