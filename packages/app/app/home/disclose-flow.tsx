"use client";

/**
 * Holder side of selective disclosure (SELECTIVE_DISCLOSURE.md §12), attached
 * inline to a transfer's activity row: paste a verifier's request (P_R, ν),
 * generate a D-recipient or D-sender proof in-browser, copy the bundle back.
 * No amount ever goes on-chain. Moved here from a standalone /prove tab so
 * disclosing lives right next to the transfer it's about — /prove is now the
 * verifier-only side of this exchange.
 */

import { useCallback, useState } from "react";
import type { TransferEvent, DisclosureRequest } from "@lucent/sdk";
import type { ConfidentialWallet } from "@/lib/wallet";
import { errMsg } from "@/lib/err";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { CopyButton } from "../copy-button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export function parseDisclosureRequest(json: string): DisclosureRequest {
  let req: unknown;
  try {
    req = JSON.parse(json);
  } catch {
    throw new Error("request is not valid JSON");
  }
  const r = req as DisclosureRequest;
  if (!r?.pR?.x || !r?.pR?.y || !r?.nu) throw new Error("request must contain pR {x,y} and nu");
  return r;
}

export function DiscloseFlow({
  ev,
  direction,
  wallet,
}: {
  ev: TransferEvent;
  direction: "received" | "sent";
  wallet: ConfidentialWallet;
}) {
  const [requestJson, setRequestJson] = useState("");
  const [bundleJson, setBundleJson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setBundleJson(null);
    try {
      const request = parseDisclosureRequest(requestJson);
      const bundle =
        direction === "received" ? await wallet.discloseReceived(ev, request) : await wallet.discloseSent(ev, request);
      setBundleJson(JSON.stringify(bundle, null, 2));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [requestJson, ev, direction, wallet]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex flex-col gap-2 rounded-xl border border-accent/20 bg-accent/[0.04] p-3"
    >
      <p className="text-xs text-text-muted">
        {direction === "received"
          ? "Prove this transfer paid you its exact amount."
          : "Prove you sent this transfer and what it paid the recipient."}{" "}
        Paste the verifier&apos;s request (their <code>pR</code> key and one-time <code>nu</code>).
      </p>
      <Textarea
        className="h-20 font-mono text-xs"
        placeholder='{"pR":{"x":"0x…","y":"0x…"},"nu":"0x…"}'
        value={requestJson}
        onChange={(e) => setRequestJson(e.target.value)}
      />
      <Button size="sm" isLoading={busy} disabled={!requestJson.trim()} onClick={generate}>
        Generate disclosure proof
      </Button>
      <ErrorBanner error={error} onDismiss={() => setError(null)} size="sm" />
      {bundleJson && (
        <div className="flex flex-col gap-2">
          <Textarea readOnly className="h-28 font-mono text-xs" value={bundleJson} />
          <CopyButton label="Copy bundle" payload={() => bundleJson} />
        </div>
      )}
    </div>
  );
}
