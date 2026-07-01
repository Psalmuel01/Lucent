"use client";

import { useCallback, useEffect, useState } from "react";

import { EscrowState, type EscrowInfo } from "@lucent/sdk";
import { DEPLOYMENT } from "@/lib/deployment";
import { useWallet } from "@/lib/wallet-context";
import { useAction } from "@/lib/use-action";
import { errMsg } from "@/lib/err";
import {
  ConnectPrompt,
  ErrorBox,
  Field,
  GlassCard,
  Pill,
  ProofButton,
  SectionTitle,
  inputCls,
} from "@/lib/ui";

type Row = { id: bigint; address: string; info: EscrowInfo };

const STATE_META: Record<EscrowState, { label: string; tone: "neutral" | "amber" | "green" | "red" | "sky" | "violet" }> = {
  [EscrowState.Created]: { label: "Created", tone: "neutral" },
  [EscrowState.Funded]: { label: "Funded", tone: "sky" },
  [EscrowState.Completed]: { label: "Completed", tone: "amber" },
  [EscrowState.Released]: { label: "Released", tone: "green" },
  [EscrowState.Disputed]: { label: "Disputed", tone: "violet" },
  [EscrowState.Refunded]: { label: "Refunded", tone: "red" },
  [EscrowState.Cancelled]: { label: "Cancelled", tone: "red" },
};

export default function EscrowPage() {
  const { wallet, view, connect, connecting, error, setError } = useWallet();
  const { run, busy, phase } = useAction();

  const [recipient, setRecipient] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [timeout, setTimeoutSecs] = useState("600");
  const [amount, setAmount] = useState("500");
  const [created, setCreated] = useState<{ id: bigint; address: string } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  const configured = Boolean(DEPLOYMENT.contracts.escrowFactory);
  const me = view?.address;

  const reload = useCallback(() => {
    if (!wallet || !configured) return;
    wallet.listEscrows().then(setRows).catch((e) => {
      setError(errMsg(e));
      setRows([]);
    });
  }, [wallet, configured, setError]);

  useEffect(reload, [reload]);

  if (!wallet) {
    return (
      <Shell>
        <ErrorBox message={error} />
        <ConnectPrompt onConnect={connect} busy={connecting} />
      </Shell>
    );
  }

  if (!configured) {
    return (
      <Shell>
        <GlassCard>
          <SectionTitle title="PrivateEscrow not configured" />
          <p className="text-sm text-neutral-400">
            Deploy the escrow factory (<span className="font-mono text-xs">pnpm deploy:contracts</span>) and set{" "}
            <span className="font-mono text-xs text-amber-300">NEXT_PUBLIC_ESCROW_FACTORY_ID</span>.
          </p>
        </GlassCard>
      </Shell>
    );
  }

  const create = () =>
    run(
      "create",
      async () => {
        if (!recipient.trim()) throw new Error("enter a recipient");
        const c = await wallet.createEscrow(
          recipient.trim(),
          arbiter.trim() || null,
          BigInt(timeout || "0"),
        );
        setCreated(c);
        reload();
      },
      { refresh: false },
    );

  const fundNew = () =>
    run("fund", async (sp) => {
      if (!created) throw new Error("create an escrow first");
      await wallet.fundEscrow(created.address, recipient.trim(), BigInt(amount || "0"), sp);
      reload();
    });

  const act = (key: string, fn: () => Promise<void>) =>
    run(key, async () => {
      await fn();
      reload();
    }, { refresh: false });

  return (
    <Shell>
      <ErrorBox message={error} />

      <GlassCard>
        <SectionTitle
          title="Create escrow"
          hint="Deploys a fresh instance contract — its own confidential account. Add an arbiter for dispute resolution, or leave it blank for auto-release after the window."
        />
        <div className="space-y-3">
          <Field label="Recipient (G…)">
            <input className={inputCls} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </Field>
          <Field label="Arbiter (optional, G…)">
            <input className={inputCls} value={arbiter} onChange={(e) => setArbiter(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timeout (seconds)">
              <input className={inputCls} value={timeout} onChange={(e) => setTimeoutSecs(e.target.value)} />
            </Field>
            <Field label="Amount">
              <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProofButton onClick={create} busy={busy === "create"}>
              Deploy escrow
            </ProofButton>
            {created && (
              <ProofButton onClick={fundNew} busy={busy === "fund"} phase={phase} variant="ghost">
                Fund escrow #{created.id.toString()}
              </ProofButton>
            )}
            {created && <Pill tone="amber">#{created.id.toString()} @ {created.address.slice(0, 6)}…</Pill>}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Your escrows</h2>
          <button onClick={reload} className="text-xs text-neutral-400 underline hover:text-neutral-200">
            refresh
          </button>
        </div>
        {rows === null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-neutral-500">No escrows involving your account yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <EscrowRow
                key={r.address}
                row={r}
                me={me}
                busy={busy}
                wallet={wallet}
                act={act}
              />
            ))}
          </div>
        )}
      </GlassCard>
    </Shell>
  );
}

function EscrowRow({
  row,
  me,
  busy,
  wallet,
  act,
}: {
  row: Row;
  me: string | undefined;
  busy: string | null;
  wallet: NonNullable<ReturnType<typeof useWallet>["wallet"]>;
  act: (key: string, fn: () => Promise<void>) => void;
}) {
  const { info, address, id } = row;
  const meta = STATE_META[info.state];
  const isDepositor = info.depositor === me;
  const isRecipient = info.recipient === me;
  const isArbiter = info.arbiter === me;
  const hasArbiter = info.arbiter !== null;
  const k = (a: string) => `${a}:${address}`;
  const [uri, setUri] = useState("ipfs://delivery-proof");

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-neutral-200">#{id.toString()}</span>
        <Pill tone={meta.tone}>{meta.label}</Pill>
        {isDepositor && <Pill tone="neutral">depositor</Pill>}
        {isRecipient && <Pill tone="neutral">recipient</Pill>}
        {isArbiter && <Pill tone="neutral">arbiter</Pill>}
        <span className="font-mono text-[11px] text-neutral-500">{address.slice(0, 8)}…</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isDepositor && info.state === EscrowState.Created && (
          <ProofButton variant="danger" busy={busy === k("cancel")} onClick={() => act(k("cancel"), () => wallet.cancelEscrow(address))}>
            Cancel
          </ProofButton>
        )}
        {isDepositor && (info.state === EscrowState.Funded || info.state === EscrowState.Completed) && (
          <ProofButton busy={busy === k("release")} onClick={() => act(k("release"), () => wallet.releaseEscrow(address))}>
            Release to recipient
          </ProofButton>
        )}
        {isDepositor && info.state === EscrowState.Funded && (
          <ProofButton variant="ghost" busy={busy === k("timeout")} onClick={() => act(k("timeout"), () => wallet.timeoutEscrow(address))}>
            Timeout refund
          </ProofButton>
        )}

        {isRecipient && info.state === EscrowState.Funded && (
          <div className="flex items-center gap-2">
            <input className={`${inputCls} w-48`} value={uri} onChange={(e) => setUri(e.target.value)} />
            <ProofButton variant="ghost" busy={busy === k("mark")} onClick={() => act(k("mark"), () => wallet.markCompleted(address, uri))}>
              Mark completed
            </ProofButton>
          </div>
        )}
        {isRecipient && info.state === EscrowState.Completed && !hasArbiter && (
          <ProofButton busy={busy === k("claim")} onClick={() => act(k("claim"), () => wallet.claimAfterWindow(address))}>
            Claim (after window)
          </ProofButton>
        )}
        {isRecipient && info.state === EscrowState.Completed && hasArbiter && (
          <ProofButton variant="ghost" busy={busy === k("dispute")} onClick={() => act(k("dispute"), () => wallet.disputeEscrow(address, uri))}>
            Dispute (after window)
          </ProofButton>
        )}

        {isArbiter && info.state === EscrowState.Disputed && (
          <>
            <ProofButton busy={busy === k("rr")} onClick={() => act(k("rr"), () => wallet.resolveToRecipient(address))}>
              Award recipient
            </ProofButton>
            <ProofButton variant="danger" busy={busy === k("rd")} onClick={() => act(k("rd"), () => wallet.resolveToDepositor(address))}>
              Refund depositor
            </ProofButton>
          </>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Escrow</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Two-party escrow whose locked amount stays hidden through the entire state machine.
        </p>
      </header>
      {children}
    </main>
  );
}
