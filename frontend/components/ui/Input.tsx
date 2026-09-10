import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-8 w-full rounded-md border text-xs text-slate-900 bg-white px-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
          error ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500" : "border-slate-200"
        } ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
