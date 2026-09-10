import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4 flex flex-col items-center justify-center max-w-sm mx-auto">
      {icon && <div className="text-slate-400 mb-3 flex items-center justify-center">{icon}</div>}
      <h3 className="text-xs font-semibold text-slate-800">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
