"use client";

import { useState } from "react";
import { Copy, Check, Lock } from "lucide-react";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

interface AddressDisplayProps {
  address: string;
  chars?: number;
  className?: string;
  showCopy?: boolean;
  /** Recipient identity is itself encrypted — show a lock instead of the address. */
  encrypted?: boolean;
}

export function AddressDisplay({
  address,
  chars = 5,
  className,
  showCopy = true,
  encrypted = false,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (encrypted) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-sm text-encrypted", className)}>
        <Lock className="h-3 w-3" />
        Recipient hidden
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-sm text-text-secondary", className)}>
      <span title={address}>{shortAddress(address, chars)}</span>
      {showCopy && (
        <button
          onClick={copy}
          className="text-text-muted transition-colors duration-150 hover:text-accent"
          title="Copy address"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
    </span>
  );
}
