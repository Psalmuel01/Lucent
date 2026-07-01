"use client";

import { useState } from "react";

import { useWallet } from "@/lib/wallet-context";
import { ConnectPrompt, ErrorBox, cn } from "@/lib/ui";
import { EventsPanel } from "./events-panel";
import { VerifyPanel } from "./verify-panel";

type Tab = "prove" | "verify";

export default function ProvePage() {
  const { wallet, connect, connecting, error } = useWallet();
  const [tab, setTab] = useState<Tab>("prove");

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Prove</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Selective disclosure: prove one transfer paid exactly X to one counterparty — off-chain,
          revealing nothing else.
        </p>
      </header>

      <div className="inline-flex rounded-xl border border-white/10 p-1">
        {(["prove", "verify"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-amber-400 text-black" : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            {t === "prove" ? "Prove (holder)" : "Verify (receiver)"}
          </button>
        ))}
      </div>

      {tab === "prove" ? (
        <>
          <ErrorBox message={error} />
          {wallet ? <EventsPanel wallet={wallet} /> : <ConnectPrompt onConnect={connect} busy={connecting} />}
        </>
      ) : (
        <VerifyPanel />
      )}
    </main>
  );
}
