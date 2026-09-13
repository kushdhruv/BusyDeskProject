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
  const labels: Record<Category, string> = {
    BUG: "Bug",
    BILLING: "Billing",
    FEATURE: "Feature",
    QUESTION: "Question",
    ACCOUNT: "Account",
    INTEGRATION: "Integration",
    PERFORMANCE: "Performance",
    SECURITY: "Security",
    ONBOARDING: "Onboarding",
    OTHER: "Other",
  };

  const label = labels[category] || category;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/90 select-none whitespace-nowrap"
    >
      {label}
    </span>
  );
}
