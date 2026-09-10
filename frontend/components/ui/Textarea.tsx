import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full rounded-md border text-sm text-slate-900 bg-white p-3 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed leading-relaxed ${
          error ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500" : "border-slate-200"
        } ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
