"use client";

import { useState } from "react";

import { useWallet } from "@/lib/wallet-context";
import { useAction } from "@/lib/use-action";
import {
  ConnectPrompt,
  ErrorBox,
  Field,
  GlassCard,
  Pill,
  ProofButton,
  SectionTitle,
  Stat,
  inputCls,
} from "@/lib/ui";

export default function ShieldPage() {
  const { wallet, view, connect, connecting, error } = useWallet();
  const { run, busy, phase } = useAction();
  const [depositAmt, setDepositAmt] = useState("1000");
  const [withdrawAmt, setWithdrawAmt] = useState("400");

  if (!wallet) {
    return (
      <Shell>
        <ErrorBox message={error} />
        <ConnectPrompt onConnect={connect} busy={connecting} />
      </Shell>
    );
  }

  const registered = view?.registered ?? false;
  const receiving = view?.receiving ?? 0n;

  return (
    <Shell>
      <ErrorBox message={error} />

      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-xs text-neutral-500">{view?.address}</span>
          {view && view.matchesChain !== null && (
            <Pill tone={view.matchesChain ? "green" : "red"}>
              {view.matchesChain ? "state matches chain ✓" : "state mismatch ✗"}
            </Pill>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Spendable" value={(view?.spendable ?? 0n).toString()} />
          <Stat label="Receiving" value={receiving.toString()} />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          {registered ? `synced through ledger ${view?.syncedLedger}` : "not registered yet"}
        </p>
      </GlassCard>

      {!registered ? (
        <GlassCard>
          <SectionTitle
            title="Register"
            hint="Bind your confidential keys to the contract (one-time). Everything else unlocks after this."
          />
          <ProofButton
            onClick={() => run("register", (sp) => wallet.register(sp))}
            busy={busy === "register"}
            phase={phase}
          >
            Register
          </ProofButton>
        </GlassCard>
      ) : (
        <>
          <GlassCard>
            <SectionTitle title="Deposit" hint="Public XLM (stroops) → your confidential receiving balance. No proof required." />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Amount">
                <input className={inputCls} value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} />
              </Field>
              <ProofButton
                onClick={() => run("deposit", () => wallet.deposit(BigInt(depositAmt || "0")))}
                busy={busy === "deposit"}
              >
                Deposit
              </ProofButton>
            </div>
          </GlassCard>

          {receiving > 0n && (
            <GlassCard className="border-amber-400/30">
              <SectionTitle
                title="Merge"
                hint="Fold your receiving balance into spendable so you can send or withdraw it."
              />
              <ProofButton onClick={() => run("merge", () => wallet.merge())} busy={busy === "merge"}>
                {`Merge ${receiving.toString()}`}
              </ProofButton>
            </GlassCard>
          )}

          <GlassCard>
            <SectionTitle title="Withdraw" hint="Spendable → public XLM (to yourself). Generates a withdraw proof in-browser." />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Amount">
                <input className={inputCls} value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} />
              </Field>
              <ProofButton
                onClick={() => run("withdraw", (sp) => wallet.withdraw(BigInt(withdrawAmt || "0"), sp))}
                busy={busy === "withdraw"}
                phase={phase}
              >
                Withdraw
              </ProofButton>
            </div>
          </GlassCard>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Shield</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Move value between public XLM and your confidential balance.
        </p>
      </header>
      {children}
    </main>
  );
}
