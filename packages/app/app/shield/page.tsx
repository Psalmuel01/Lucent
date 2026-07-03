"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { NumericKeypad } from "@/components/ui/NumericKeypad";
import { ProofStatusPill } from "@/components/ui/ProofStatusPill";
import { TxStatus, type TxStep } from "@/components/ui/TxStatus";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import { useWallet } from "@/lib/wallet-context";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAction } from "@/lib/use-action";
import { toBaseUnits, formatAmount, displayAmount, DECIMALS } from "@/lib/amount";
import { cn } from "@/lib/cn";

type Tab = "deposit" | "withdraw";

export default function ShieldPage() {
  const wallet = useRequireWallet();
  const { view, error, setError } = useWallet();
  const { run, busy, phase } = useAction();
  const [tab, setTab] = useState<Tab>("deposit");
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [steps, setSteps] = useState<TxStep[]>([]);

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Shield" showBack={false} />
        <ConnectPrompt message="Connect your wallet to deposit, withdraw, and shield USDC into a confidential balance." />
      </AppShell>
    );
  }

  const registered = view?.registered ?? false;
  const receiving = view?.receiving ?? 0n;
  const spendable = view?.spendable ?? 0n;
  const publicUSDC = view?.publicUSDC ?? 0n;

  async function register() {
    setSteps([{ id: "register", label: "Prove key ownership", status: "active", estSeconds: 4 }]);
    await run("register", async (sp) => {
      await wallet!.register(sp);
      setSteps((s) => s.map((x) => ({ ...x, status: "done" })));
    });
    setTimeout(() => setSteps([]), 1500);
  }

  async function deposit() {
    if (!depositAmt) return;
    await run("deposit", async () => {
      await wallet!.deposit(toBaseUnits(depositAmt));
      setDepositAmt("");
    });
  }

  async function withdraw() {
    if (!withdrawAmt) return;
    setSteps([
      { id: "prove", label: "Generate withdraw proof", status: "active", estSeconds: 12 },
      { id: "submit", label: "Submit withdrawal", status: "pending" },
    ]);
    await run("withdraw", async (sp) => {
      await wallet!.withdraw(toBaseUnits(withdrawAmt), (p) => {
        sp(p);
        setSteps((s) =>
          s.map((x) =>
            p === "submitting"
              ? x.id === "prove"
                ? { ...x, status: "done" }
                : x.id === "submit"
                  ? { ...x, status: "active" }
                  : x
              : x,
          ),
        );
      });
      setSteps((s) => s.map((x) => ({ ...x, status: "done" })));
      setWithdrawAmt("");
    });
    setTimeout(() => setSteps([]), 1500);
  }

  const isProving = busy === "register" || (busy === "withdraw" && phase === "proving");

  return (
    <AppShell>
      <PageHeader title="Shield" showBack={false} />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-5 px-4 pb-6 md:mx-auto md:max-w-2xl md:px-8"
      >
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {!registered ? (
          <GlassCard padding="md">
            <SectionLabel>Register</SectionLabel>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Bind your confidential keys to the contract — a one-time proof. Everything else unlocks
              after this.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {steps.length > 0 && <TxStatus steps={steps} />}
              <Button fullWidth size="lg" isLoading={busy === "register"} onClick={register}>
                {busy === "register" ? "Registering…" : "Register"}
              </Button>
            </div>
          </GlassCard>
        ) : (
          <>
            <div className="flex gap-2 rounded-2xl border border-border bg-card p-1">
              {(["deposit", "withdraw"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 rounded-xl py-2.5 text-sm font-medium capitalize transition-all duration-200",
                    tab === t ? "bg-accent text-black" : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "deposit" && (
              <>
                <GlassCard padding="sm" className="border-accent/20 bg-accent-bg">
                  <div className="flex items-start gap-3">
                    <span className="text-accent text-sm">💡</span>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Need testnet USDC?{" "}
                      <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
                         className="text-accent hover:text-accent-hover underline underline-offset-2">
                        Get some at faucet.circle.com
                      </a>
                      {" "}— free, instant, no account required.
                    </p>
                  </div>
                </GlassCard>
                <GlassCard padding="md">
                  <NumericKeypad
                    value={depositAmt}
                    onChange={setDepositAmt}
                    unit="USDC"
                    maxValue={formatAmount(publicUSDC, DECIMALS)}
                    onMax={() => setDepositAmt(formatAmount(publicUSDC, DECIMALS))}
                  />
                </GlassCard>
                <div className="flex justify-center">
                  <ProofStatusPill status={busy === "deposit" ? "encrypting" : "idle"} />
                </div>
                <p className="px-2 text-center text-xs leading-relaxed text-text-muted">
                  Moves public USDC into your receiving balance at a 1:1 ratio — no proof required.
                </p>
                <Button fullWidth size="lg" isLoading={busy === "deposit"} disabled={!depositAmt} onClick={deposit}>
                  Deposit {depositAmt || "0"} USDC
                </Button>
              </>
            )}

            {tab === "withdraw" && (
              <>
                {receiving > 0n && (
                  <GlassCard padding="sm" className="border-accent/25">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-text-secondary">
                        You have {displayAmount(receiving)} unmerged — merge before withdrawing more than spendable.
                      </span>
                      <Button size="sm" variant="secondary" isLoading={busy === "merge"} onClick={() => run("merge", () => wallet!.merge())}>
                        Merge
                      </Button>
                    </div>
                  </GlassCard>
                )}
                <GlassCard padding="md">
                  <NumericKeypad
                    value={withdrawAmt}
                    onChange={setWithdrawAmt}
                    unit="USDC"
                    maxValue={formatAmount(spendable, DECIMALS)}
                    onMax={() => setWithdrawAmt(formatAmount(spendable, DECIMALS))}
                  />
                </GlassCard>
                <div className="flex justify-center">
                  <ProofStatusPill status={isProving ? "encrypting" : "idle"} />
                </div>
                {steps.length > 0 && (
                  <GlassCard padding="md">
                    <TxStatus steps={steps} />
                  </GlassCard>
                )}
                <Button fullWidth size="lg" isLoading={busy === "withdraw"} disabled={!withdrawAmt} onClick={withdraw}>
                  Withdraw {withdrawAmt || "0"} USDC
                </Button>
              </>
            )}
          </>
        )}
      </motion.div>

      <ProofLoadingOverlay open={busy === "withdraw" && phase === "proving"} estSeconds={12} fullScreen />
    </AppShell>
  );
}
