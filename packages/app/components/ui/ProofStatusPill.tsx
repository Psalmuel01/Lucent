"use client";

import { Lock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ProofStatus = "idle" | "encrypting" | "confirmed";

interface ProofStatusPillProps {
  status: ProofStatus;
  className?: string;
}

export function ProofStatusPill({ status, className }: ProofStatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        status === "idle" && "border-encrypted/20 bg-encrypted-bg text-encrypted",
        status === "encrypting" && "border-accent/25 bg-accent-bg text-accent",
        status === "confirmed" && "border-success/25 bg-success/10 text-success",
        className,
      )}
    >
      {status === "idle" && (
        <>
          <Lock className="h-3 w-3 animate-encrypted-pulse" />
          ZK Protected
        </>
      )}
      {status === "encrypting" && (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Generating proof...
        </>
      )}
      {status === "confirmed" && (
        <>
          <CheckCircle className="h-3 w-3" />
          Proof verified
        </>
      )}
    </span>
  );
}
