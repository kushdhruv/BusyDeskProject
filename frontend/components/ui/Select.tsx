import React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`h-8 rounded-md border text-xs text-slate-800 bg-white px-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors cursor-pointer disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
          error ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500" : "border-slate-200"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
