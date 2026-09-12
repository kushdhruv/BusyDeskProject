"use client";

import React, { useEffect, useRef, useState } from "react";
import { Priority, Status, User } from "@/lib/types";
import {
  ExternalLink,
  Copy,
  UserCheck,
  Tag,
  ShieldAlert,
  Archive,
  Check,
  ChevronRight,
} from "lucide-react";

export interface ContextMenuProps {
  x: number;
  y: number;
  ticketIds: string[];
  singleTicketNumber?: number;
  singleTicketSubject?: string;
  isSupervisor: boolean;
  agents: { id: string; name: string; email?: string }[];
  onClose: () => void;
  onViewDetails: (id: string) => void;
  onCopyLink: (id: string) => void;
  onAssign: (ticketIds: string[], agentId: string) => void;
  onChangeStatus: (ticketIds: string[], status: Status) => void;
  onChangePriority: (ticketIds: string[], priority: Priority) => void;
  onArchive: (ticketIds: string[]) => void;
}

export function ContextMenu({
  x,
  y,
  ticketIds,
  singleTicketNumber,
  singleTicketSubject,
  isSupervisor,
  agents,
  onClose,
  onViewDetails,
  onCopyLink,
  onAssign,
  onChangeStatus,
  onChangePriority,
  onArchive,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<"assign" | "status" | "priority" | null>(null);
  const [copied, setCopied] = useState(false);

  // Viewport clamping
  const [coords, setCoords] = useState({ left: x, top: y });

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width > winWidth - 10) {
      adjustedX = Math.max(10, winWidth - rect.width - 15);
    }
    if (y + rect.height > winHeight - 10) {
      adjustedY = Math.max(10, winHeight - rect.height - 15);
    }

    setCoords({ left: adjustedX, top: adjustedY });
  }, [x, y]);

  // Click outside and escape handler
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleScroll = () => {
      onClose();
    };

    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  const isBulk = ticketIds.length > 1;
  const primaryId = ticketIds[0];

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (primaryId) {
      onCopyLink(primaryId);
      setCopied(true);
      setTimeout(() => {
        onClose();
      }, 400);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className="fixed z-50 min-w-[210px] bg-white rounded-md border border-slate-200 shadow-lg text-xs py-1 text-slate-700 animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Context Menu Header */}
      <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
        <span className="truncate max-w-[170px]">
          {isBulk ? (
            <span className="text-slate-900 font-bold">{ticketIds.length} tickets selected</span>
          ) : singleTicketNumber ? (
            <span className="text-slate-900 font-mono">#{singleTicketNumber}</span>
          ) : (
            "Ticket Options"
          )}
        </span>
        {isBulk && (
          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-medium">
            Bulk
          </span>
        )}
      </div>

      {/* Single ticket navigation & copy */}
      {!isBulk && (
        <>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 cursor-pointer transition-colors"
            onClick={() => {
              onViewDetails(primaryId);
              onClose();
            }}
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span>Open Ticket Workspace</span>
          </button>

          <button
            type="button"
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 cursor-pointer transition-colors"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{copied ? "Link Copied!" : "Copy Ticket URL"}</span>
          </button>

          <div className="my-1 border-t border-slate-100" />
        </>
      )}

      {/* Supervisor Actions */}
      {isSupervisor ? (
        <>
          {/* Submenu: Assign */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("assign")}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Assign To</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>

            {activeSubmenu === "assign" && (
              <div className="absolute left-full top-0 ml-0.5 min-w-[170px] bg-white rounded-md border border-slate-200 shadow-lg py-1 max-h-56 overflow-y-auto z-50">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Select Agent
                </div>
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 truncate cursor-pointer transition-colors block text-xs"
                    onClick={() => {
                      onAssign(ticketIds, agent.id);
                      onClose();
                    }}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submenu: Status */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("status")}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Change Status</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>

            {activeSubmenu === "status" && (
              <div className="absolute left-full top-0 ml-0.5 min-w-[150px] bg-white rounded-md border border-slate-200 shadow-lg py-1 z-50">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Select Status
                </div>
                {(["OPEN", "PENDING", "RESOLVED", "CLOSED"] as Status[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 cursor-pointer transition-colors block text-xs"
                    onClick={() => {
                      onChangeStatus(ticketIds, st);
                      onClose();
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submenu: Priority */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("priority")}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Change Priority</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>

            {activeSubmenu === "priority" && (
              <div className="absolute left-full top-0 ml-0.5 min-w-[150px] bg-white rounded-md border border-slate-200 shadow-lg py-1 z-50">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Select Priority
                </div>
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 cursor-pointer transition-colors block text-xs"
                    onClick={() => {
                      onChangePriority(ticketIds, pr);
                      onClose();
                    }}
                  >
                    {pr}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-slate-100" />

          {/* Archive Action */}
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-700 flex items-center gap-2 cursor-pointer transition-colors"
            onClick={() => {
              onArchive(ticketIds);
              onClose();
            }}
          >
            <Archive className="w-3.5 h-3.5 text-rose-500" />
            <span>{isBulk ? "Archive Tickets" : "Archive Ticket"}</span>
          </button>
        </>
      ) : (
        <div className="px-3 py-1.5 text-[11px] text-slate-400 italic">
          Supervisor role required for bulk actions & assignments.
        </div>
      )}
    </div>
  );
}
