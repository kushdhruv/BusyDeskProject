"use client";

import React from "react";
import { Paperclip, FileText, Download, X, ExternalLink, Image as ImageIcon } from "lucide-react";

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageFile(type?: string | null, name?: string | null): boolean {
  if (type?.startsWith("image/")) return true;
  if (!name) return false;
  const ext = name.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || "");
}

interface AttachmentDisplayProps {
  url: string;
  name: string;
  size?: number | null;
  type?: string | null;
}

export function AttachmentDisplay({ url, name, size, type }: AttachmentDisplayProps) {
  const isImg = isImageFile(type, name);

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-100/80">
      {isImg ? (
        <div className="space-y-2">
          <div className="relative group max-w-sm rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={name}
              className="max-h-56 w-auto object-contain rounded-t-md hover:opacity-95 transition-opacity"
              loading="lazy"
            />
            <div className="p-2 bg-white flex items-center justify-between border-t border-slate-100 text-xs">
              <div className="truncate max-w-[200px] flex items-center gap-1.5 text-slate-700 font-medium">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{name}</span>
                {size ? <span className="text-slate-400 text-[10px]">({formatFileSize(size)})</span> : null}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                  title="View full image"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={`${url}?download=1`}
                  download={name}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                  title="Download image"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="inline-flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 transition-colors max-w-md">
          <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="truncate min-w-0 pr-2">
            <div className="text-xs font-medium text-slate-800 truncate">{name}</div>
            <div className="text-[10px] text-slate-400 font-mono">{formatFileSize(size) || "Attachment"}</div>
          </div>
          <a
            href={`${url}?download=1`}
            download={name}
            className="ml-auto p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-white border border-transparent hover:border-slate-200 transition-colors flex-shrink-0"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

interface AttachedFileChipProps {
  name: string;
  size?: number;
  onRemove: () => void;
}

export function AttachedFileChip({ name, size, onRemove }: AttachedFileChipProps) {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 shadow-2xs animate-in fade-in">
      <Paperclip className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
      <span className="font-medium truncate max-w-[200px]">{name}</span>
      {size ? <span className="text-slate-400 text-[10px]">({formatFileSize(size)})</span> : null}
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
        title="Remove attachment"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
