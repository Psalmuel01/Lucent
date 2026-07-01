"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/cn";
import { EventsPanel } from "./events-panel";
import { VerifyPanel } from "./verify-panel";

type Tab = "prove" | "verify";

export default function ProvePage() {
  const { wallet, connect, connecting, error } = useWallet();
  const [tab, setTab] = useState<Tab>("prove");

  return (
    <AppShell>
      <PageHeader title="Prove" showBack={false} />

      <div className="flex flex-col gap-5 px-4 pb-8 md:mx-auto md:max-w-2xl md:px-8">
        <p className="text-sm leading-relaxed text-text-secondary">
          Selective disclosure: prove one transfer paid exactly X to one counterparty — off-chain,
          revealing nothing else.
        </p>

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
            {error && <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
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
