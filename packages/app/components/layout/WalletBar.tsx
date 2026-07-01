"use client";

import { useWallet } from "@/lib/wallet-context";
import { shortAddress } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function WalletBar() {
  const { wallet, view, connecting, connect } = useWallet();

  if (!wallet) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 md:px-8">
        <span className="text-xs text-text-muted">Not connected</span>
        <Button size="sm" variant="primary" isLoading={connecting} onClick={connect}>
          Connect Freighter
        </Button>
      </div>
    );
  }

  const synced = view?.matchesChain === true;
  const mismatch = view?.matchesChain === false;

  return (
    <div className="flex items-center justify-between gap-3 px-4 md:px-8">
      <span className="font-mono text-xs text-text-secondary">{shortAddress(wallet.address, 5)}</span>
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            synced ? "bg-success" : mismatch ? "bg-error" : "animate-pulse bg-warning",
          )}
        />
        <span className={cn(synced ? "text-success" : mismatch ? "text-error" : "text-warning")}>
          {synced ? "Synced" : mismatch ? "Mismatch" : "Syncing…"}
        </span>
      </div>
    </div>
  );
}
