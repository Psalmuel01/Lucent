"use client";

/**
 * App-wide connection state. One {@link ConfidentialWallet} shared by every
 * screen and the nav bar, plus a rolling log and a "last synced" indicator that
 * powers the sync badge. Connecting once (and signing the key-derivation message
 * once) serves the whole product.
 *
 * The connection itself persists across reloads: on mount, a disconnected
 * provider silently checks Freighter for prior authorization and reconnects
 * without a popup if found (see the auto-connect effect below), so a refresh
 * doesn't drop the session. Explicitly disconnecting sticks across reloads
 * too — see {@link MANUALLY_DISCONNECTED_KEY}.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { ConfidentialWallet, type WalletView } from "./wallet";
import { freighterIsAllowed } from "./freighter";
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

/**
 * Set when the user explicitly disconnects, so a later reload doesn't
 * silently reconnect them again just because Freighter still has this site
 * authorized — disconnect should stick until they reconnect themselves.
 * Cleared on the next successful connect (explicit or auto).
 */
const MANUALLY_DISCONNECTED_KEY = "lucent:wallet:manually-disconnected";

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
      localStorage.removeItem(MANUALLY_DISCONNECTED_KEY);
      return w;
    } catch (e) {
      setError(errMsg(e));
      return null;
    } finally {
      setConnecting(false);
    }
  }, [log]);

  // Reconnect silently on mount (page load, hard refresh) if this site was
  // already authorized in a prior session — otherwise every reload drops back
  // to a disconnected state even though nothing the user did asked for that.
  // No popup: `isAllowed()` is a read of Freighter's own memory, and
  // `requestAccess()` inside `connect()` won't prompt either once it's true.
  // Silent by design — a failure here (Freighter locked, permission revoked,
  // extension missing) just leaves the user disconnected as before, not an
  // error message for something they didn't initiate.
  const autoConnectAttempted = useRef(false);
  useEffect(() => {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    if (localStorage.getItem(MANUALLY_DISCONNECTED_KEY)) return;
    freighterIsAllowed().then(async (allowed) => {
      if (!allowed) return;
      const w = await connect();
      // Unprompted attempt — if it failed, clear the error connect() set
      // rather than surfacing it for something the user didn't initiate.
      if (!w) setError(null);
    });
  }, [connect]);

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
    localStorage.setItem(MANUALLY_DISCONNECTED_KEY, "1");
    // router.push("/");
  }, [router]);

  const value = useMemo(
    () => ({ wallet, view, connecting, error, logs, lastSync, connect, refresh, resync, disconnect, log, setError }),
    [wallet, view, connecting, error, logs, lastSync, connect, refresh, resync, disconnect, log],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
