"use client";

import { useWallet } from "./wallet-context";
import type { ConfidentialWallet } from "./wallet";

/**
 * Marks a screen as wallet-only. No redirect: a disconnected visitor stays on
 * the page (nav intact, so Auditor/Prove are still one tap away) and the page
 * renders a `ConnectPrompt` in place of its real content — see callers.
 */
export function useRequireWallet(): ConfidentialWallet | null {
  const { wallet } = useWallet();
  return wallet;
}
