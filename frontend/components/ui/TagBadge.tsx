"use client";

import React from "react";
import { Tag } from "@/lib/types";

interface TagBadgeProps {
  tag: Tag | { id: string; name: string; color?: string; group?: { name: string; color?: string } | null };
  onRemove?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  size?: "xs" | "sm" | "md";
  showGroupPrefix?: boolean;
  className?: string;
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  onRemove,
  onClick,
  size = "sm",
  showGroupPrefix = false,
  className = "",
}) => {
  const color = tag.color || tag.group?.color || "#6B7280";

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-sm px-2.5 py-1 gap-2",
  }[size];

  const groupName = tag.group?.name;

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center font-medium rounded-full transition-all select-none border ${
        onClick ? "cursor-pointer hover:opacity-85 hover:shadow-xs" : ""
      } ${sizeClasses} ${className}`}
      style={{
        backgroundColor: `${color}18`, // ~10% opacity tint
        borderColor: `${color}40`,     // ~25% opacity border
        color: color,
      }}
      title={groupName ? `${groupName}: ${tag.name}` : tag.name}
    >
      {/* Color indicator dot */}
      <span
        className="rounded-full shrink-0"
        style={{
          backgroundColor: color,
          width: size === "xs" ? "5px" : size === "sm" ? "6px" : "8px",
          height: size === "xs" ? "5px" : size === "sm" ? "6px" : "8px",
        }}
      />

      {/* Label with optional group prefix */}
      <span className="truncate max-w-[150px]">
        {showGroupPrefix && groupName && (
          <span className="opacity-65 font-normal mr-1">{groupName}:</span>
        )}
        {tag.name}
      </span>

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 inline-flex items-center justify-center transition-colors shrink-0"
          aria-label={`Remove tag ${tag.name}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
};

export default TagBadge;
