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
import { GlassCard, ProofButton, SectionTitle, inputCls } from "@/lib/ui";
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
    <div className="space-y-5">
      <GlassCard>
        <SectionTitle title="1 · Your request" hint="Hand this to the holder; they disclose against it on the Prove tab. The nonce is one-time." />
        <div className="flex items-center gap-2">
          <ProofButton onClick={mintRequest} disabled={!keys} variant="ghost">
            {request ? "New request (fresh nonce)" : "Create request"}
          </ProofButton>
          {request && <CopyButton label="Copy request" payload={() => JSON.stringify(request, null, 2)} />}
        </div>
        {request && (
          <textarea readOnly className={`${inputCls} mt-3 h-24 font-mono text-xs`} value={JSON.stringify(request, null, 2)} />
        )}
      </GlassCard>

      <GlassCard>
        <SectionTitle title="2 · Verify the bundle" hint="Paste the bundle the holder sent back. Everything is re-read from the chain — never trusted from the bundle." />
        <textarea
          className={`${inputCls} h-28 font-mono text-xs`}
          placeholder='{"circuitId":"disclose_recipient","refE":{…},"proof":"0x…","rDisc":{…},"vTildeDisc":"0x…"}'
          value={bundleJson}
          onChange={(e) => setBundleJson(e.target.value)}
        />
        <div className="mt-2">
          <ProofButton onClick={verify} busy={busy} disabled={!request || !bundleJson.trim()}>
            Verify against chain
          </ProofButton>
        </div>
        {!request && <p className="mt-2 text-xs text-amber-400">Create a request first.</p>}
      </GlassCard>

      {error && (
        <GlassCard className="border-red-500/40">
          <h3 className="mb-1 font-medium text-red-300">Rejected at: {error.stage}</h3>
          <p className="text-sm text-red-300/90">{error.message}</p>
        </GlassCard>
      )}

      {result && (
        <GlassCard className="border-emerald-500/40">
          <h3 className="mb-2 font-medium text-emerald-300">Disclosure verified ✓</h3>
          <div className="mb-3 text-3xl text-neutral-100">{result.amount.toString()} stroops</div>
          <p className="text-sm text-neutral-300">
            The on-chain transfer <span className="font-mono text-xs">{result.event.txHash.slice(0, 10)}…</span> (ledger{" "}
            {result.event.ledger}){" "}
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
