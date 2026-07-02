"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/cn";
import { EventsPanel } from "./events-panel";
import { VerifyPanel } from "./verify-panel";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type Tab = "prove" | "verify";

export default function ProvePage() {
  const { wallet, connect, connecting, error, setError } = useWallet();
  const [tab, setTab] = useState<Tab>("prove");

  return (
    <AppShell>
      <PageHeader title="Prove" showBack={false} />

      <div className="flex flex-col gap-5 px-4 pb-8 md:mx-auto md:max-w-2xl md:px-8">
        <GlassCard padding="md" className="border-encrypted/20">
          <SectionLabel>How it works</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-text-primary">You are the holder</div>
              <p className="text-xs leading-relaxed text-text-muted">
                Switch to &quot;Prove&quot; tab. Connect Freighter, pick a transfer from your history,
                paste the receiver&apos;s request, and generate a disclosure bundle. Send them the bundle.
              </p>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-text-primary">You are the receiver</div>
              <p className="text-xs leading-relaxed text-text-muted">
                Switch to &quot;Verify&quot; tab. Create a request and send it to the holder.
                When they return a bundle, paste it here and verify against the chain.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className="inline-flex w-fit rounded-2xl border border-border bg-card p-1">
          {(["prove", "verify"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === t ? "bg-accent text-black" : "text-text-muted hover:text-text-secondary",
              )}
            >
              {t === "prove" ? "Prove (holder)" : "Verify (receiver)"}
            </button>
          ))}
        </div>

        {tab === "prove" ? (
          <>
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
            {wallet ? (
              <EventsPanel wallet={wallet} />
            ) : (
              <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-sm text-text-secondary">Connect Freighter to disclose your transfers.</p>
                <Button isLoading={connecting} onClick={connect}>
                  Connect Freighter
                </Button>
              </GlassCard>
            )}
          </>
        ) : (
          <VerifyPanel />
        )}
      </div>
    </AppShell>
  );
}
