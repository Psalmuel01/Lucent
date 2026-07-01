"use client";

import { useEffect, useState } from "react";

import { useWallet } from "@/lib/wallet-context";
import { useAction } from "@/lib/use-action";
import { errMsg } from "@/lib/err";
import {
  ConnectPrompt,
  ErrorBox,
  Field,
  GlassCard,
  ProofButton,
  SectionTitle,
  Stat,
  inputCls,
} from "@/lib/ui";

export default function SendPage() {
  const { wallet, view, connect, connecting, error, setError } = useWallet();
  const { run, busy, phase } = useAction();
  const [recipients, setRecipients] = useState<string[] | null>(null);
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("400");

  useEffect(() => {
    if (!wallet) return;
    wallet.registeredRecipients().then(setRecipients).catch((e) => {
      setError(errMsg(e));
      setRecipients([]);
    });
  }, [wallet, setError]);

  if (!wallet) {
    return (
      <Shell>
        <ErrorBox message={error} />
        <ConnectPrompt onConnect={connect} busy={connecting} />
      </Shell>
    );
  }

  return (
    <Shell>
      <ErrorBox message={error} />

      <GlassCard>
        <Stat label="Spendable" value={(view?.spendable ?? 0n).toString()} sub="available to send" />
      </GlassCard>

      <GlassCard>
        <SectionTitle
          title="Confidential transfer"
          hint="Send to another registered account's receiving balance. The amount is hidden on-chain; a transfer proof is generated in your browser."
        />
        <div className="space-y-3">
          <Field label="Recipient">
            <select
              className={inputCls}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {recipients === null ? (
                <option value="">Loading registered accounts…</option>
              ) : recipients.length === 0 ? (
                <option value="">No other registered accounts found</option>
              ) : (
                <>
                  <option value="">Select recipient…</option>
                  {recipients.map((a) => (
                    <option key={a} value={a}>{`${a.slice(0, 12)}…${a.slice(-12)}`}</option>
                  ))}
                </>
              )}
            </select>
          </Field>
          <Field label="Or paste an address">
            <input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} placeholder="G…" />
          </Field>
          <Field label="Amount">
            <input className={inputCls} value={amt} onChange={(e) => setAmt(e.target.value)} />
          </Field>
          <ProofButton
            onClick={() => run("send", (sp) => wallet.transfer(to.trim(), BigInt(amt || "0"), sp))}
            busy={busy === "send"}
            phase={phase}
            disabled={!to.trim()}
          >
            Send confidentially
          </ProofButton>
        </div>
      </GlassCard>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        <p className="mt-1 text-sm text-neutral-400">Private transfers between confidential accounts.</p>
      </header>
      {children}
    </main>
  );
}
