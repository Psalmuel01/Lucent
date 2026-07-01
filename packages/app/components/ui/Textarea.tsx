"use client";

import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{label}</label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full rounded-xl border bg-card px-4 py-3 text-sm text-text-primary outline-none transition-all duration-200 placeholder:text-text-muted",
            error
              ? "border-error/50"
              : "border-border focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(251,187,36,0.1)]",
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-error">{error}</span>}
        {!error && hint && <span className="text-xs text-text-muted">{hint}</span>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
