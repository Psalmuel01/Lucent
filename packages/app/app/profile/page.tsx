"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, LogOut, Activity, BookOpen, Info } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Pill } from "@/components/ui/Pill";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { useWallet } from "@/lib/wallet-context";
import { DEPLOYMENT } from "@/lib/deployment";

export default function ProfilePage() {
  const { wallet, view, connect, connecting, error, disconnect } = useWallet();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDisconnect() {
    disconnect();
    router.push("/");
  }

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Profile" showBack={false} />
        <div className="flex flex-col gap-5 px-4 pb-6 md:mx-auto md:max-w-2xl md:px-8">
          {error && <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
          <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-text-secondary">Connect Freighter to view your profile.</p>
            <Button isLoading={connecting} onClick={connect}>
              Connect Freighter
            </Button>
          </GlassCard>
        </div>
      </AppShell>
    );
  }

  const synced = view?.matchesChain === true;

  return (
    <AppShell>
      <PageHeader title="Profile" showBack={false} />

      <div className="flex flex-col gap-5 px-4 pb-8 md:mx-auto md:max-w-2xl md:px-8">
        <GlassCard padding="md">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl"
                style={{ background: "radial-gradient(circle, rgba(251,187,36,0.2) 0%, transparent 70%)", filter: "blur(12px)" }}
              />
              <LucentLogoMark size={56} />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-text-primary">
                  {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                </span>
                <button onClick={copy} className="text-text-muted transition-colors hover:text-accent">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Pill tone="amber">Stellar Testnet</Pill>
                <Pill tone={synced ? "green" : "neutral"}>{synced ? "State matches chain" : view ? "Syncing…" : "—"}</Pill>
              </div>
            </div>
          </div>
        </GlassCard>

        <SectionLabel>Protocol</SectionLabel>

        <div className="flex flex-col gap-3">
          {[
            { label: "Encryption", value: "Pedersen commitments (Grumpkin)" },
            { label: "Proofs", value: "UltraHonk, verified on-chain" },
            { label: "Privacy", value: "Amount-hidden on-chain" },
            { label: "Network", value: "Stellar Testnet" },
          ].map(({ label, value }) => (
            <GlassCard key={label} padding="sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{label}</span>
                <span className="font-mono text-xs text-text-secondary">{value}</span>
              </div>
            </GlassCard>
          ))}
        </div>

        <SectionLabel>Links</SectionLabel>

        <div className="flex flex-col gap-2 px-1">
          <a
            href={`https://stellar.expert/explorer/testnet/account/${wallet.address}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent"
          >
            <Activity className="h-4 w-4" />
            View on Stellar Expert
          </a>
          <a href="/docs" className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent">
            <BookOpen className="h-4 w-4" />
            Documentation
          </a>
          <a href="/about" className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent">
            <Info className="h-4 w-4" />
            About Lucent
          </a>
        </div>

        <div className="pt-2">
          <Button variant="danger" fullWidth size="lg" onClick={handleDisconnect}>
            <LogOut className="h-4 w-4" />
            Disconnect
          </Button>
        </div>

        <footer className="text-center font-mono text-[11px] text-text-muted">
          token {DEPLOYMENT.contracts.token.slice(0, 4)}…{DEPLOYMENT.contracts.token.slice(-4)}
        </footer>
      </div>
    </AppShell>
  );
}
