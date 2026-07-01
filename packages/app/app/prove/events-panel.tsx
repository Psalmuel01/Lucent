"use client";

/**
 * Holder side of selective disclosure (SELECTIVE_DISCLOSURE.md §12): lists the
 * connected account's transfer events and, for each, lets the holder paste a
 * verifier's request (P_R, ν), generate a D-recipient or D-sender proof
 * in-browser, and copy the bundle back. No amount ever goes on-chain.
 */

import { useCallback, useEffect, useState } from "react";
import type { ConfidentialEvent, TransferEvent, DisclosureRequest } from "@ctd/sdk";
import type { ConfidentialWallet } from "@/lib/wallet";
import { DEPLOYMENT } from "@/lib/deployment";
import { errMsg } from "@/lib/err";
import { GlassCard, Pill, ProofButton, Spinner, inputCls } from "@/lib/ui";
import { CopyButton } from "../copy-button";

export function EventsPanel({ wallet }: { wallet: ConfidentialWallet }) {
  const [events, setEvents] = useState<ConfidentialEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setEvents(await wallet.listEvents());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <GlassCard>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold">Your transfers</h3>
        <button onClick={load} disabled={busy} className="text-xs text-neutral-400 underline hover:text-neutral-200 disabled:opacity-50">
          {busy ? "loading…" : "reload"}
        </button>
      </div>
      <p className="mb-3 text-xs text-neutral-400">
        Events involving your account ({DEPLOYMENT.indexerUrl ? "full history via indexer" : "~7-day RPC retention"}).
        Disclose a transfer to prove its amount to a third party — as its receiver or its sender.
      </p>
      {error && <div className="mb-3 rounded-lg border border-red-500/40 bg-red-950/40 p-2 text-xs text-red-300">{error}</div>}
      {events && events.length === 0 && <p className="text-sm text-neutral-500">No activity in the retention window.</p>}
      {!events && busy && (
        <p className="flex items-center gap-2 text-sm text-neutral-500"><Spinner /> Loading events…</p>
      )}
      {events && (
        <ul className="space-y-2">
          {events.map((ev) => (
            <EventRow key={ev.cursor} ev={ev} wallet={wallet} />
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

type Direction = "received" | "sent" | null;

function EventRow({ ev, wallet }: { ev: ConfidentialEvent; wallet: ConfidentialWallet }) {
  const [open, setOpen] = useState(false);
  const direction: Direction = ev.type !== "transfer" ? null : ev.to === wallet.address ? "received" : "sent";
  const canDisclose = direction === "received" || (direction === "sent" && wallet.canDiscloseSent(ev as TransferEvent));

  return (
    <li className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={direction === "received" ? "green" : direction === "sent" ? "amber" : "neutral"}>
          {direction ?? ev.type}
        </Pill>
        <span className="text-xs text-neutral-500">ledger {ev.ledger}</span>
        <span className="font-mono text-xs text-neutral-500">tx {ev.txHash.slice(0, 10)}…</span>
        <span className="flex-1" />
        {direction && canDisclose && (
          <button onClick={() => setOpen((v) => !v)} className="rounded-lg border border-white/15 px-2 py-1 text-xs text-neutral-200 hover:border-white/30">
            {open ? "Close" : "Disclose…"}
          </button>
        )}
        {direction === "sent" && !canDisclose && <span className="text-xs text-neutral-600">not disclosable</span>}
      </div>
      <div className="mt-1.5 text-xs text-neutral-400">{summary(ev, wallet.address)}</div>
      {open && direction && <DiscloseFlow ev={ev as TransferEvent} direction={direction} wallet={wallet} />}
    </li>
  );
}

function DiscloseFlow({ ev, direction, wallet }: { ev: TransferEvent; direction: "received" | "sent"; wallet: ConfidentialWallet }) {
  const [requestJson, setRequestJson] = useState("");
  const [bundleJson, setBundleJson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setBundleJson(null);
    try {
      const request = parseRequest(requestJson);
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
    <div className="mt-3 space-y-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3">
      <p className="text-xs text-neutral-400">
        {direction === "received"
          ? "Prove this transfer paid you its exact amount."
          : "Prove you sent this transfer and what it paid the recipient."}{" "}
        Paste the verifier&apos;s request (their <code>pR</code> key and one-time <code>nu</code>).
      </p>
      <textarea
        className={`${inputCls} h-20 font-mono text-xs`}
        placeholder='{"pR":{"x":"0x…","y":"0x…"},"nu":"0x…"}'
        value={requestJson}
        onChange={(e) => setRequestJson(e.target.value)}
      />
      <ProofButton onClick={generate} busy={busy} phase={busy ? "proving" : null} disabled={!requestJson.trim()}>
        Generate disclosure proof
      </ProofButton>
      {error && <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-2 text-xs text-red-300">{error}</div>}
      {bundleJson && (
        <div className="space-y-2">
          <textarea readOnly className={`${inputCls} h-28 font-mono text-xs`} value={bundleJson} />
          <CopyButton label="Copy bundle" payload={() => bundleJson} />
        </div>
      )}
    </div>
  );
}

function parseRequest(json: string): DisclosureRequest {
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

function summary(ev: ConfidentialEvent, me: string): string {
  const who = (a: string) => (a === me ? "you" : `${a.slice(0, 6)}…${a.slice(-4)}`);
  switch (ev.type) {
    case "register":
      return `${who(ev.account)} registered (auditor #${ev.auditorId})`;
    case "deposit":
      return `${who(ev.from)} deposited ${ev.amount} (public) → ${who(ev.to)}`;
    case "merge":
      return `${who(ev.account)} merged receiving → spendable`;
    case "withdraw":
      return `${who(ev.from)} withdrew ${ev.amount} (public) → ${who(ev.to)}`;
    case "transfer":
      return ev.to === me
        ? `from ${who(ev.from)} · amount confidential`
        : `to ${who(ev.to)} · amount confidential`;
  }
}
