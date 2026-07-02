"use client";

import { Wallet } from "lucide-react";
import { Button } from "./Button";
import { useWallet } from "@/lib/wallet-context";

/**
 * Inline stand-in for wallet-gated screens. Pages that need a connected
 * wallet render this instead of their real content when disconnected —
 * no redirect, so the nav stays put and Auditor/Prove stay one tap away.
 */
export function ConnectPrompt({ message }: { message: string }) {
  const { connecting, connect } = useWallet();

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
      <div className="glass-card flex h-14 w-14 items-center justify-center">
        <Wallet className="h-6 w-6 text-text-muted" />
      </div>
      <p className="max-w-xs text-sm text-text-muted">{message}</p>
      <Button isLoading={connecting} onClick={connect}>
        Connect Wallet
      </Button>
    </div>
  );
}
