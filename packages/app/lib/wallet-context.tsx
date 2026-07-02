"use client";

/**
 * App-wide connection state. One {@link ConfidentialWallet} shared by every
 * screen and the nav bar, plus a rolling log and a "last synced" indicator that
 * powers the sync badge. Connecting once (and signing the key-derivation message
 * once) serves the whole product.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { ConfidentialWallet, type WalletView } from "./wallet";
import { errMsg } from "./err";

interface WalletCtx {
  wallet: ConfidentialWallet | null;
  view: WalletView | null;
  connecting: boolean;
  error: string | null;
  logs: string[];
  lastSync: Date | null;
  /** Resolves to the connected wallet, or `null` if connection failed (see `error`). */
  connect: () => Promise<ConfidentialWallet | null>;
  refresh: () => Promise<void>;
  /** Forget the local session. Freighter itself stays connected — the browser extension owns that grant. */
  disconnect: () => void;
  log: (msg: string) => void;
  setError: (e: string | null) => void;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<ConfidentialWallet | null>(null);
  const [view, setView] = useState<WalletView | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const router = useRouter();

  const log = useCallback((msg: string) => {
    setLogs((prev) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...prev].slice(0, 80));
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const w = await ConfidentialWallet.connect(log);
      setWallet(w);
      const v = await w.refresh();
      setView(v);
      setLastSync(new Date());
      return w;
    } catch (e) {
      setError(errMsg(e));
      return null;
    } finally {
      setConnecting(false);
    }
  }, [log]);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    try {
      const v = await wallet.refresh();
      setView(v);
      setLastSync(new Date());
    } catch (e) {
      setError(errMsg(e));
    }
  }, [wallet]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setView(null);
    setLastSync(null);
    setError(null);
    // router.push("/");
  }, [router]);

  const value = useMemo(
    () => ({ wallet, view, connecting, error, logs, lastSync, connect, refresh, disconnect, log, setError }),
    [wallet, view, connecting, error, logs, lastSync, connect, refresh, disconnect, log],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
