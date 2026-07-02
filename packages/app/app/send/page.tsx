"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ExternalLink, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NumericKeypad } from "@/components/ui/NumericKeypad";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { ProofStatusPill } from "@/components/ui/ProofStatusPill";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import { useWallet } from "@/lib/wallet-context";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAction } from "@/lib/use-action";
import { toBaseUnits } from "@/lib/amount";
import { errMsg } from "@/lib/err";

type Step = "recipient" | "amount" | "confirm";

export default function SendPage() {
  const wallet = useRequireWallet();
  const { error, setError } = useWallet();
  const { run, busy, phase } = useAction();
  const [step, setStep] = useState<Step>("recipient");
  const [recipients, setRecipients] = useState<string[] | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) return;
    wallet
      .registeredRecipients()
      .then(setRecipients)
      .catch((e) => {
        setError(errMsg(e));
        setRecipients([]);
      });
  }, [wallet, setError]);

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Send" showBack={false} />
        <ConnectPrompt message="Connect your wallet to send a confidential transfer." />
      </AppShell>
    );
  }

  async function submit() {
    setTxHash(null);
    await run("send", async (sp) => {
      const r = await wallet!.transfer(to.trim(), toBaseUnits(amount || "0"), sp);
      setTxHash(r.hash);
    });
  }

  if (txHash) {
    return (
      <AppShell>
        <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-6 px-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="flex h-20 w-20 items-center justify-center rounded-3xl border border-success/20 bg-success/10"
          >
            <CheckCircle className="h-10 w-10 text-success" />
          </motion.div>
          <div className="text-center">
            <h2 className="font-display text-xl font-semibold text-text-primary">Sent</h2>
            <p className="mt-1 text-sm text-text-secondary">{amount} USDC sent confidentially</p>
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-mono text-xs text-accent hover:text-accent-hover"
          >
            {txHash.slice(0, 12)}… <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            size="lg"
            onClick={() => {
              setTxHash(null);
              setTo("");
              setAmount("");
              setStep("recipient");
            }}
          >
            Send Another
          </Button>
        </div>
      </AppShell>
    );
  }

  const steps: Step[] = ["recipient", "amount", "confirm"];
  const stepIndex = steps.indexOf(step);

  return (
    <AppShell>
      <PageHeader title="Send" showBack={step !== "recipient"} onBack={() => setStep(steps[stepIndex - 1] ?? "recipient")} />

      <div className="flex flex-col gap-5 px-4 pb-6 md:mx-auto md:max-w-2xl md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
        <span className="-mt-2 text-xs text-text-muted">
          Step {stepIndex + 1} of 3 — {step === "recipient" ? "Recipient" : step === "amount" ? "Amount" : "Confirm"}
        </span>

        {step === "recipient" && (
          <>
            <GlassCard padding="md">
              <Input
                label="Recipient address"
                placeholder="G…"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="font-mono"
              />
            </GlassCard>

            {recipients && recipients.length > 0 && (
              <>
                <SectionLabel>Registered accounts</SectionLabel>
                <div className="flex flex-col gap-2">
                  {recipients.map((a) => (
                    <button key={a} onClick={() => setTo(a)} className="w-full text-left">
                      <GlassCard hover padding="sm">
                        <AddressDisplay address={a} chars={8} showCopy={false} />
                      </GlassCard>
                    </button>
                  ))}
                </div>
              </>
            )}

            <Button fullWidth size="lg" disabled={!to.trim()} onClick={() => setStep("amount")}>
              Continue
            </Button>
          </>
        )}

        {step === "amount" && (
          <>
            <GlassCard padding="sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">To</span>
                <AddressDisplay address={to} chars={8} />
              </div>
            </GlassCard>

            <GlassCard padding="md">
              <NumericKeypad value={amount} onChange={setAmount} unit="USDC" />
            </GlassCard>

            <div className="flex justify-center">
              <ProofStatusPill status="idle" />
            </div>

            <Button fullWidth size="lg" disabled={!amount || amount === "0"} onClick={() => setStep("confirm")}>
              Preview Send
            </Button>
          </>
        )}

        {step === "confirm" && (
          <>
            <GlassCard padding="md">
              <div className="flex flex-col gap-4">
                <SectionLabel>Transfer Details</SectionLabel>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">To</span>
                  <AddressDisplay address={to} chars={8} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Amount</span>
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-accent" />
                    <span className="font-mono text-sm text-text-primary">{amount} USDC</span>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <p className="text-xs leading-relaxed text-text-muted">
                  Amount is proven in your browser before submission — it will never appear in
                  plaintext on-chain.
                </p>

                <div className="flex justify-center">
                  <ProofStatusPill status={busy === "send" ? "encrypting" : "idle"} />
                </div>
              </div>
            </GlassCard>

            <Button fullWidth size="lg" isLoading={busy === "send"} onClick={submit}>
              Send
            </Button>
          </>
        )}
      </div>

      <ProofLoadingOverlay open={busy === "send" && phase === "proving"} estSeconds={12} fullScreen />
    </AppShell>
  );
}
