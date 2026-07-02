"use client";

import { X } from "lucide-react";

interface ErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
  className?: string;
  size?: "sm" | "md";
}

export function ErrorBanner({ error, onDismiss, className = "", size = "md" }: ErrorBannerProps) {
  if (!error) return null;
  return (
    <div
      className={`flex items-start justify-between gap-2 rounded-xl border border-error/30 bg-error/10 p-3 ${className}`}
    >
      <p className={`${size === "sm" ? "text-xs" : "text-sm"} text-error`}>{error}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="mt-0.5 shrink-0 text-error/60 transition-colors hover:text-error"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
