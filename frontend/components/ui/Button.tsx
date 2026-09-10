import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "secondary", size = "sm", loading = false, disabled, icon, children, ...props }, ref) => {
    const baseClasses =
      "inline-flex items-center justify-center font-medium transition-colors select-none rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:opacity-50 disabled:pointer-events-none cursor-pointer gap-1.5";

    const variantClasses = {
      primary: "bg-slate-900 text-white hover:bg-slate-800 active:bg-black border border-slate-900 shadow-xs",
      secondary: "bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 shadow-xs",
      outline: "bg-transparent text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-200",
      ghost: "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100",
      danger: "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border border-rose-600 shadow-xs",
    };

    const sizeClasses = {
      xs: "h-7 px-2 text-xs",
      sm: "h-8 px-2.5 text-xs",
      md: "h-9 px-3.5 text-sm",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
