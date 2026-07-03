"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowDownUp, ArrowUpRight, Send, Layers, UserCheck, ScanLine, Lock, ExternalLink } from "lucide-react";
import { ChainClient, fetchEvents, type RegisterEvent } from "@lucent/sdk";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { Skeleton } from "@/components/ui/Skeleton";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";

function contractUrl(id: string) {
  return `https://stellar.expert/explorer/testnet/contract/${id}`;
}

const STAT_DEFS = [
  {
    key: "registered",
    label: "Registered Addresses",
    sub: "Confidential accounts bound to a Grumpkin key",
    icon: UserCheck,
    color: "text-encrypted bg-encrypted-bg",
  },
  {
    key: "transfers",
    label: "Confidential Transfers",
    sub: "Send, payroll, and escrow payments — amount hidden",
    icon: Send,
    color: "text-accent bg-accent-bg",
  },
  {
    key: "merges",
    label: "Merges",
    sub: "Receiving balance folded into spendable",
    icon: Layers,
    color: "text-encrypted bg-encrypted-bg",
  },
  {
    key: "deposits",
    label: "Shield Deposits",
    sub: "Public USDC shielded into a confidential balance",
    icon: ArrowDownUp,
    color: "text-success bg-success/10",
  },
  {
    key: "withdrawals",
    label: "Withdrawals",
    sub: "Confidential balance unshielded back to USDC",
    icon: ArrowUpRight,
    color: "text-warning bg-warning/10",
  },
  {
    key: "verifies",
    label: "Tx Verifies",
    sub: "Zero-knowledge proofs verified on-chain",
    icon: ScanLine,
    color: "text-accent bg-accent-bg",
  },
] as const;

type StatKey = (typeof STAT_DEFS)[number]["key"];
type Stats = Record<StatKey, number>;

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = new ChainClient({
          rpcUrl: DEPLOYMENT.rpcUrl,
          networkPassphrase: DEPLOYMENT.networkPassphrase,
          contracts: DEPLOYMENT.contracts,
        });
        const { events } = await fetchEvents(client, { startLedger: DEPLOYMENT.deployedAtLedger });
        if (cancelled) return;
        const count = (t: string) => events.filter((e) => e.type === t).length;
        // G... keypair accounts only — every PrivateEscrow instance also
        // registers as its own confidential account (C...) to hold a
        // balance, but that's custody plumbing, not a person or org.
        const registered = new Set(
          events
            .filter((e): e is RegisterEvent => e.type === "register" && e.account.startsWith("G"))
            .map((e) => e.account),
        ).size;
        setStats({
          registered,
          transfers: count("transfer"),
          deposits: count("deposit"),
          withdrawals: count("withdraw"),
          merges: count("merge"),
          // register/withdraw/transfer are the only entry points that carry
          // a proof argument — deposit and merge move funds without one.
          verifies: count("register") + count("withdraw") + count("transfer"),
        });
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-void text-text-primary">
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-void/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-75">
            <LucentLogoMark size={24} />
            <span className="text-sm font-semibold">Lucent</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
              Docs
            </Link>
            <Link
              href="/home"
              className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-accent-hover"
            >
              Launch App <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 pb-24 pt-32">
        <motion.div
          className="flex flex-col gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="font-mono text-xs uppercase tracking-widest text-accent/70">Protocol Stats</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Activity on Stellar testnet
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
            Every count below is read directly from on-chain events, verifiable on Stellar Expert.
            Amounts are never revealed — not even here.
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-accent/60" />
            <span className="font-mono text-xs text-text-muted">Every encrypted amount stays private</span>
          </div>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {STAT_DEFS.map(({ key, label, sub, icon: Icon, color }, i) => (
            <motion.div
              key={key}
              className="glass-card flex flex-col items-center gap-3 p-5 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
            >
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", color)}>
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </div>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <span className="font-mono text-3xl font-semibold tabular-nums text-text-primary">
                  {(stats?.[key] ?? 0).toLocaleString()}
                </span>
              )}
              <div>
                <h3 className="text-sm font-medium text-text-primary">{label}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-8">
          <p className="text-xs leading-relaxed text-text-muted">
            Stats are read directly from the confidential token contract&apos;s event log, starting at
            deploy ledger {DEPLOYMENT.deployedAtLedger.toLocaleString()}. Payroll and escrow activity
            surfaces here too — both settle through the same confidential transfers.
          </p>
          <a
            href={contractUrl(DEPLOYMENT.contracts.token)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-accent"
          >
            View confidential token contract <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
