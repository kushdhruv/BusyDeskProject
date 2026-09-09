import React from "react";
import { Priority, Category } from "@prisma/client";
import { AlertTriangle, AlertCircle, Clock, Info, Bug, CreditCard, Sparkles, HelpCircle } from "lucide-react";

export function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case Priority.URGENT:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Urgent
        </span>
      );
    case Priority.HIGH:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
          <AlertCircle className="w-3 h-3 text-orange-600" />
          High
        </span>
      );
    case Priority.MEDIUM:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
          <Clock className="w-3 h-3 text-sky-600" />
          Medium
        </span>
      );
    case Priority.LOW:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <Info className="w-3 h-3 text-slate-500" />
          Low
        </span>
      );
  }
}

export function CategoryBadge({ category }: { category: Category }) {
  switch (category) {
    case Category.BUG:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-100">
          <Bug className="w-3 h-3" />
          Bug
        </span>
      );
    case Category.BILLING:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
          <CreditCard className="w-3 h-3" />
          Billing
        </span>
      );
    case Category.FEATURE:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
          <Sparkles className="w-3 h-3" />
          Feature
        </span>
      );
    case Category.QUESTION:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
          <HelpCircle className="w-3 h-3" />
          Question
        </span>
      );
  }
}
