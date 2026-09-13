import React from "react";
import { Priority, Category } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { AlertTriangle, Clock } from "lucide-react";

export function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case "URGENT":
      return (
        <Badge variant="danger" size="sm" dot>
          Urgent
        </Badge>
      );
    case "HIGH":
      return (
        <Badge variant="warning" size="sm" dot>
          High
        </Badge>
      );
    case "MEDIUM":
      return (
        <Badge variant="neutral" size="sm">
          Medium
        </Badge>
      );
    case "LOW":
      return (
        <Badge variant="neutral" size="sm" className="opacity-75">
          Low
        </Badge>
      );
  }
}

export function CategoryBadge({ category }: { category: Category }) {
  const styles: Record<Category, { label: string; className: string }> = {
    BUG: { label: "Bug", className: "bg-rose-50 text-rose-700 border-rose-200" },
    BILLING: { label: "Billing", className: "bg-amber-50 text-amber-700 border-amber-200" },
    FEATURE: { label: "Feature", className: "bg-purple-50 text-purple-700 border-purple-200" },
    QUESTION: { label: "Question", className: "bg-sky-50 text-sky-700 border-sky-200" },
    ACCOUNT: { label: "Account", className: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    INTEGRATION: { label: "Integration", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    PERFORMANCE: { label: "Performance", className: "bg-orange-50 text-orange-700 border-orange-200" },
    SECURITY: { label: "Security", className: "bg-red-50 text-red-700 border-red-200" },
    ONBOARDING: { label: "Onboarding", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    OTHER: { label: "Other", className: "bg-slate-100 text-slate-700 border-slate-200" },
  };

  const current = styles[category] || { label: category, className: "bg-slate-100 text-slate-700 border-slate-200" };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${current.className}`}
    >
      {current.label}
    </span>
  );
}
