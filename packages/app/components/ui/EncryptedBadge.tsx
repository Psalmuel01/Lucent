"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/cn";

interface EncryptedBadgeProps {
  value?: string;
  isRevealed?: boolean;
  onReveal?: () => void;
  isLoading?: boolean;
  size?: "sm" | "lg";
  label?: string;
  unit?: string;
}

export function EncryptedBadge({
  value,
  isRevealed = false,
  onReveal,
  isLoading = false,
  size = "sm",
  label,
  unit,
}: EncryptedBadgeProps) {
  if (size === "sm") {
    return (
      <span
        onClick={onReveal}
        title="Encrypted value — click to reveal"
        className={cn(
          "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-encrypted/20 bg-encrypted-bg px-2.5 py-1 text-xs font-medium text-encrypted transition-colors duration-200 hover:bg-encrypted/20",
        )}
      >
        <Lock className="h-2.5 w-2.5" />
        {isRevealed && value ? (
          <span className="font-mono">{value}</span>
        ) : (
          <span className="font-mono tracking-widest">••••••</span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <span className="text-xs uppercase tracking-wider text-text-muted">{label}</span>}
      <div className="flex flex-col items-center gap-2">
        {isLoading ? (
          <div className="h-11 w-48 animate-shimmer rounded-xl bg-card" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-display text-4xl font-bold tabular-nums encrypted-value",
                isRevealed && value && "revealed",
              )}
            >
              {isRevealed && value ? value : "••••••"}
            </span>
            {unit && <span className="font-mono text-sm text-text-muted">{unit}</span>}
          </div>
        )}

        {onReveal && (
          <button
            onClick={onReveal}
            className="flex items-center gap-1.5 text-xs text-text-muted transition-colors duration-200 hover:text-accent"
          >
            {isRevealed ? (
              <>
                <EyeOff className="h-3 w-3" /> Hide
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" /> Reveal balance
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
