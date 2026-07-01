"use client";

import { useCallback, useState } from "react";

import { useWallet } from "./wallet-context";
import { errMsg } from "./err";
import type { TxPhase } from "./wallet";

/**
 * Runs a named async action with UI bookkeeping: which action is busy, the
 * proof phase (for the button label), error capture, and a wallet refresh on
 * success. `run(key, fn)` — `fn` receives `setPhase` for proof-carrying ops.
 */
export function useAction() {
  const { refresh, setError } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxPhase | null>(null);

  const run = useCallback(
    async (key: string, fn: (setPhase: (p: TxPhase) => void) => Promise<void>, opts?: { refresh?: boolean }) => {
      setError(null);
      setBusy(key);
      setPhase(null);
      try {
        await fn(setPhase);
        if (opts?.refresh !== false) await refresh();
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(null);
        setPhase(null);
      }
    },
    [refresh, setError],
  );

  return { run, busy, phase };
}
