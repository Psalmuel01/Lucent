"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useWallet } from "./wallet-context";
import type { ConfidentialWallet } from "./wallet";

/**
 * Gate for wallet-only screens. Mirrors Shade's dashboard guard
 * (`if (!isConnected) router.replace("/")`): a disconnected visitor is bounced
 * straight back to the landing page, which is the only place that offers the
 * connect flow, rather than showing a half-usable page. Freighter never
 * silently reconnects on mount, so on a fresh load this always fires until the
 * user explicitly connects from `/`.
 */
export function useRequireWallet(): ConfidentialWallet | null {
  const { wallet } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!wallet) router.replace("/");
  }, [wallet, router]);

  return wallet;
}
