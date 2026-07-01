"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="group flex flex-col gap-2">
        {label && (
          <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              "h-14 w-full rounded-xl border bg-card px-4 text-sm text-text-primary outline-none transition-all duration-200 placeholder:text-text-muted",
              error
                ? "border-error/50"
                : "border-border focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(251,187,36,0.1)]",
              className,
            )}
            {...props}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-3 bottom-0 h-px scale-x-0 bg-accent transition-transform duration-200 group-focus-within:scale-x-100",
              error && "bg-error",
            )}
          />
        </div>
        {error && <span className="text-xs text-error">{error}</span>}
        {!error && hint && <span className="text-xs text-text-muted">{hint}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";
