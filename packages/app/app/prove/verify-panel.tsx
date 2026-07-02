"use client";

/**
 * Receiver side of selective disclosure (SELECTIVE_DISCLOSURE.md §5.3/§12). No
 * Stellar wallet: mint a one-time request, hand it to the holder, then verify
 * the bundle they return — the event, the disclosing key, and the contract
 * binding are all re-read from the chain, never trusted from the bundle.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ChainClient,
  IndexerClient,
  CircuitProver,
  proverFromArtifact,
  generateRecipientKeys,
  recipientKeysFromSecret,
  newDisclosureRequest,
  verifyDisclosure,
  DisclosureVerifyError,
  toHex32,
  fromHex,
  type RecipientKeys,
  type DisclosureRequest,
  type DisclosureBundle,
  type VerifiedDisclosure,
} from "@lucent/sdk";
import discloseRecipientCircuit from "@lucent/disclosure/artifacts/disclose_recipient.json";
import discloseRecipientVk from "@lucent/disclosure/artifacts/disclose_recipient.vk.json";
import discloseSenderCircuit from "@lucent/disclosure/artifacts/disclose_sender.json";
import discloseSenderVk from "@lucent/disclosure/artifacts/disclose_sender.vk.json";

import { DEPLOYMENT } from "@/lib/deployment";
import { ensureBrowserBackend } from "@/lib/bb-loader";
import { errMsg } from "@/lib/err";
import { displayAmount } from "@/lib/amount";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { CopyButton } from "../copy-button";

const RR_KEY = "lucent:disclosure:rR";
const REQUEST_KEY = "lucent:disclosure:request";

const ARTIFACTS = {
  disclose_recipient: { circuit: discloseRecipientCircuit, vk: discloseRecipientVk },
  disclose_sender: { circuit: discloseSenderCircuit, vk: discloseSenderVk },
} as const;

function vkBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function VerifyPanel() {
  const [keys, setKeys] = useState<RecipientKeys | null>(null);
  const [request, setRequest] = useState<DisclosureRequest | null>(null);
  const [bundleJson, setBundleJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifiedDisclosure | null>(null);
  const [error, setError] = useState<{ stage: string; message: string } | null>(null);

  useEffect(() => {
    const storedRr = localStorage.getItem(RR_KEY);
    const k = storedRr ? recipientKeysFromSecret(fromHex(storedRr)) : generateRecipientKeys();
    if (!storedRr) localStorage.setItem(RR_KEY, toHex32(k.rR));
    setKeys(k);
    const storedReq = localStorage.getItem(REQUEST_KEY);
    if (storedReq) {
      const req = JSON.parse(storedReq) as DisclosureRequest;
      if (req.pR.x === k.pR.x && req.pR.y === k.pR.y) setRequest(req);
    }
  }, []);

  const mintRequest = useCallback(() => {
    if (!keys) return;
    const req = newDisclosureRequest(keys);
    localStorage.setItem(REQUEST_KEY, JSON.stringify(req));
    setRequest(req);
    setResult(null);
    setError(null);
  }, [keys]);

  const verify = useCallback(async () => {
    if (!keys || !request) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      ensureBrowserBackend();
      const bundle = parseBundle(bundleJson);
      const client = new ChainClient({
        rpcUrl: DEPLOYMENT.rpcUrl,
        networkPassphrase: DEPLOYMENT.networkPassphrase,
        contracts: DEPLOYMENT.contracts,
      });
      const indexer = DEPLOYMENT.indexerUrl ? new IndexerClient({ baseUrl: DEPLOYMENT.indexerUrl }) : undefined;
      const artifacts = ARTIFACTS[bundle.circuitId];
      const prover: CircuitProver = proverFromArtifact(artifacts.circuit as never);
      try {
        setResult(
          await verifyDisclosure({
            client,
            indexer,
            bundle,
            request,
            keys,
            prover,
            pinnedVk: vkBytes(artifacts.vk.vkBase64),
          }),
        );
      } finally {
        await prover.destroy();
      }
    } catch (e) {
      if (e instanceof DisclosureVerifyError) setError({ stage: e.stage, message: e.message });
      else setError({ stage: "input", message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }, [keys, request, bundleJson]);

  return (
    <div className="flex flex-col gap-5">
      <GlassCard padding="md">
        <SectionLabel>Your Request</SectionLabel>
        <p className="mt-3 text-xs text-text-muted">
          Hand this to the holder; they disclose against it on the Prove tab. The nonce is one-time.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="secondary" disabled={!keys} onClick={mintRequest}>
            {request ? "New request (fresh nonce)" : "Create request"}
          </Button>
          {request && <CopyButton label="Copy request" payload={() => JSON.stringify(request, null, 2)} />}
        </div>
        {request && (
          <Textarea readOnly className="mt-3 h-24 font-mono text-xs" value={JSON.stringify(request, null, 2)} />
        )}
      </GlassCard>

      <GlassCard padding="md">
        <SectionLabel>Verify the Bundle</SectionLabel>
        <p className="mt-3 text-xs text-text-muted">
          Paste the bundle the holder sent back. Everything is re-read from the chain — never trusted
          from the bundle.
        </p>
        <Textarea
          className="mt-3 h-28 font-mono text-xs"
          placeholder='{"circuitId":"disclose_recipient","refE":{…},"proof":"0x…","rDisc":{…},"vTildeDisc":"0x…"}'
          value={bundleJson}
          onChange={(e) => setBundleJson(e.target.value)}
        />
        <div className="mt-2">
          <Button isLoading={busy} disabled={!request || !bundleJson.trim()} onClick={verify}>
            Verify against chain
          </Button>
        </div>
        {!request && <p className="mt-2 text-xs text-warning">Create a request first.</p>}
      </GlassCard>

      {error && (
        <GlassCard padding="md" className="border-error/40">
          <h3 className="mb-1 text-md font-medium text-error">Rejected at: {error.stage}</h3>
          <p className="text-sm text-error/90">{error.message}</p>
        </GlassCard>
      )}

      {result && (
        <GlassCard padding="md" className="border-success/40">
          <h3 className="mb-2 font-medium text-md text-success">Disclosure verified ✓</h3>
          <div className="mb-3 font-display text-xl font-bold tabular-nums text-text-primary">
            {displayAmount(result.amount)}
          </div>
          <p className="text-sm text-text-secondary">
            The on-chain transfer{" "}
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${result.event.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-accent/40 hover:text-accent-hover/50 hover:underline"
            >
              {result.event.txHash.slice(0, 10)}…
            </a>{" "}
            (ledger {result.event.ledger}){" "}
            {result.role === "recipient" ? "paid" : "was sent by"}{" "}
            <span className="font-mono text-xs">{result.disclosingAccount.slice(0, 8)}…</span> exactly this amount. You
            learned nothing else.
          </p>
        </GlassCard>
      )}
    </div>
  );
}

function parseBundle(json: string): DisclosureBundle {
  let b: unknown;
  try {
    b = JSON.parse(json);
  } catch {
    throw new Error("bundle is not valid JSON");
  }
  const bundle = b as DisclosureBundle;
  if (
    !(bundle?.circuitId in ARTIFACTS) ||
    !bundle?.refE?.id ||
    typeof bundle.refE.ledger !== "number" ||
    !bundle?.refE?.txHash ||
    !bundle?.proof ||
    !bundle?.rDisc?.x ||
    !bundle?.rDisc?.y ||
    !bundle?.vTildeDisc
  ) {
    throw new Error("bundle must contain circuitId, refE {ledger,id,txHash}, proof, rDisc {x,y}, vTildeDisc");
  }
  return bundle;
}
