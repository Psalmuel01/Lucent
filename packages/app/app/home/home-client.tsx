"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDownUp,
  Send,
  Briefcase,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  UserCheck,
  Activity,
  ScanEye,
  ScanLine,
} from "lucide-react";
import {
  ChainClient,
  IndexerClient,
  hybridFetchEvents,
  type ConfidentialEvent,
  type TransferEvent,
} from "@lucent/sdk";
import type { ConfidentialWallet } from "@/lib/wallet";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EncryptedBadge } from "@/components/ui/EncryptedBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { TxStatus, type TxStep } from "@/components/ui/TxStatus";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { DiscloseFlow } from "./disclose-flow";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress, timeAgo } from "@/lib/format";
import { displayAmount } from "@/lib/amount";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";

const QUICK_ACTIONS = [
  { href: "/shield", icon: ArrowDownUp, label: "Shield" },
  { href: "/send", icon: Send, label: "Send" },
  { href: "/payroll", icon: Briefcase, label: "Payroll" },
  { href: "/escrow", icon: Lock, label: "Escrow" },
  { href: "/auditor", icon: ScanEye, label: "Auditor" },
  { href: "/verify", icon: ScanLine, label: "Verify" },
];

/**
 * Ledger numbers don't carry wall-clock time without an extra RPC round trip
 * per event (there's no cheap ledger → timestamp conversion available
 * client-side), so this is honestly just the ledger — not a fake "3m ago".
 */
function relativeLedger(ledger: number): string {
  return `Ledger ${ledger}`;
}

type IconType = ComponentType<{ className?: string }>;

function describeEvent(ev: ConfidentialEvent, me: string): { icon: IconType; iconColor: string; label: string } {
  switch (ev.type) {
    case "transfer":
      return ev.to === me
        ? { icon: ArrowDownLeft, iconColor: "text-success", label: `Received from ${shortAddress(ev.from, 4)}` }
        : { icon: ArrowUpRight, iconColor: "text-text-secondary", label: `Sent to ${shortAddress(ev.to, 4)}` };
    case "deposit":
      return { icon: ArrowDownUp, iconColor: "text-accent", label: "Deposited" };
    case "withdraw":
      return { icon: ArrowDownUp, iconColor: "text-text-secondary", label: "Withdrew" };
    case "merge":
      return { icon: Layers, iconColor: "text-encrypted", label: "Merged receiving" };
    case "register":
      return { icon: UserCheck, iconColor: "text-encrypted", label: "Registered account" };
  }
}

function ActivityRow({
  ev,
  wallet,
  decryptedAmount,
}: {
  ev: ConfidentialEvent;
  wallet: ConfidentialWallet;
  /** `undefined` = still decrypting, `null` = couldn't be attributed to this wallet. */
  decryptedAmount?: bigint | null;
}) {
  const me = wallet.address;
  const { icon: Icon, iconColor, label } = describeEvent(ev, me);
  const [proveOpen, setProveOpen] = useState(false);

  const direction: "received" | "sent" | null =
    ev.type !== "transfer" ? null : ev.to === me ? "received" : "sent";
  const canDisclose =
    direction === "received" || (direction === "sent" && wallet.canDiscloseSent(ev as TransferEvent));

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${ev.txHash}`;
  function openExplorer() {
    window.open(explorerUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <li className="border-b border-border last:border-0">
      <div
        role="button"
        tabIndex={0}
        onClick={openExplorer}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openExplorer()}
        className="flex cursor-pointer items-center gap-3 rounded-lg py-3 transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card">
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-text-primary">{label}</div>
          <div className="text-xs text-text-muted">{relativeLedger(ev.ledger)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {ev.type === "transfer" &&
            (decryptedAmount === undefined ? (
              <Skeleton className="h-4 w-16" />
            ) : decryptedAmount === null ? (
              <EncryptedBadge />
            ) : (
              <span className={cn("font-mono text-sm", iconColor)}>{displayAmount(decryptedAmount)}</span>
            ))}
          {ev.type === "deposit" && (
            <span className="font-mono text-sm text-accent">{displayAmount(ev.amount)}</span>
          )}
          {ev.type === "withdraw" && (
            <span className="font-mono text-sm text-text-secondary">{displayAmount(ev.amount)}</span>
          )}
          {direction && canDisclose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setProveOpen((v) => !v);
              }}
            >
              {proveOpen ? "Close" : "Prove"}
            </Button>
          )}
        </div>
      </div>
      {proveOpen && direction && (
        <div className="pb-3">
          <DiscloseFlow ev={ev as TransferEvent} direction={direction} wallet={wallet} />
        </div>
      )}
    </li>
  );
}

export function HomeClient() {
  const router = useRouter();
  const { wallet, view, connecting, connect, refresh, lastSync, error, setError } = useWallet();

  const [syncing, setSyncing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeSteps, setMergeSteps] = useState<TxStep[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registerSteps, setRegisterSteps] = useState<TxStep[]>([]);

  const [activity, setActivity] = useState<ConfidentialEvent[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [decryptedAmounts, setDecryptedAmounts] = useState<Map<string, bigint | null>>(new Map());

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    (async () => {
      setActivityLoading(true);
      try {
        const client = new ChainClient({
          rpcUrl: DEPLOYMENT.rpcUrl,
          networkPassphrase: DEPLOYMENT.networkPassphrase,
          contracts: DEPLOYMENT.contracts,
        });
        const indexer = DEPLOYMENT.indexerUrl
          ? new IndexerClient({ baseUrl: DEPLOYMENT.indexerUrl })
          : undefined;
        const { events } = await hybridFetchEvents(client, indexer, {
          fromLedger: DEPLOYMENT.deployedAtLedger,
        });
        const mine = events.filter((ev) => {
          switch (ev.type) {
            case "transfer":
              return ev.from === wallet.address || ev.to === wallet.address;
            case "deposit":
              return ev.to === wallet.address;
            case "withdraw":
              return ev.from === wallet.address;
            case "merge":
            case "register":
              return ev.account === wallet.address;
          }
        });
        if (!cancelled) setActivity(mine.slice(-20).reverse());
      } catch {
        // Read-only history fetch — fall back to the empty state rather than
        // surfacing an error for something the user didn't initiate.
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  // Decrypt each transfer's amount for display — this is the account's own
  // data, so there's no reason to keep it hidden from the owner the way it's
  // hidden from everyone else. Received transfers decrypt with just the
  // owner's own key; sent transfers need one extra RPC lookup per event (the
  // recipient's viewing key), so this runs as its own effect rather than
  // blocking the activity list from rendering.
  useEffect(() => {
    if (!wallet || !activity) return;
    const transfers = activity.filter((ev): ev is TransferEvent => ev.type === "transfer");
    if (transfers.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        transfers.map(async (ev): Promise<[string, bigint | null]> => {
          try {
            return [ev.cursor, await wallet.decryptOwnTransferAmount(ev)];
          } catch {
            return [ev.cursor, null];
          }
        }),
      );
      if (!cancelled) setDecryptedAmounts(new Map(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, activity]);

  async function handleSync() {
    setSyncing(true);
    try {
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function handleMerge() {
    setMergeSteps([{ id: "merge", label: "Merging receiving into spendable", status: "active" }]);
    setMerging(true);
    try {
      await wallet!.merge();
      setMergeSteps((s) => s.map((x) => ({ ...x, status: "done" })));
      await refresh();
    } catch {
      setMergeSteps((s) => s.map((x) => ({ ...x, status: "error" })));
    } finally {
      setMerging(false);
      setTimeout(() => setMergeSteps([]), 1500);
    }
  }

  async function handleRegister() {
    setRegisterSteps([{ id: "register", label: "Prove key ownership", status: "active", estSeconds: 4 }]);
    setRegistering(true);
    try {
      await wallet!.register();
      setRegisterSteps((s) => s.map((x) => ({ ...x, status: "done" })));
      await refresh();
    } catch {
      setRegisterSteps((s) => s.map((x) => ({ ...x, status: "error" })));
    } finally {
      setRegistering(false);
      setTimeout(() => setRegisterSteps([]), 1500);
    }
  }

  if (!wallet) {
    if (connecting) {
      return (
        <AppShell>
          <PageHeader title="Home" showBack={false} />
          <div className="flex flex-col items-center gap-5 px-4 py-20 text-center">
            <LucentLogoMark size={56} showBg={false} />
          </div>
        </AppShell>
      );
    }
    return (
      <AppShell>
        <PageHeader title="Home" showBack={false} />
        <div className="flex flex-col items-center gap-5 px-4 py-20 text-center">
          <LucentLogoMark size={56} showBg={false} />
          <div>
            <h2 className="mb-2 font-display text-xl font-semibold text-text-primary">Welcome to Lucent</h2>
            <p className="max-w-xs text-sm text-text-secondary">
              Connect Freighter to view your confidential balance and activity.
            </p>
          </div>
          <Button isLoading={connecting} onClick={connect}>
            Connect Freighter
          </Button>
        </div>
      </AppShell>
    );
  }

  const spendable = view?.spendable ?? 0n;
  const receiving = view?.receiving ?? 0n;
  const registered = view?.registered ?? false;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (!registered) {
    return (
      <AppShell>
        <PageHeader title="Home" showBack={false} />
        <div className="flex flex-col gap-5 px-4 pb-8 animate-fade-in-up md:mx-auto md:max-w-2xl md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{greeting}</span>
            <span className="font-mono text-xs text-text-secondary">{shortAddress(wallet.address, 5)}</span>
          </div>

          <div className="flex flex-col items-center gap-5 px-4 py-12 text-center">
            <LucentLogoMark size={56} showBg={false} />
            <div>
              <h2 className="mb-2 font-display text-xl font-semibold text-text-primary">Register to continue</h2>
              <p className="max-w-xs text-sm text-text-secondary">
                Bind your confidential keys to the contract — a one-time proof. Everything else
                unlocks after this: balances, sending, payroll, escrow.
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-3">
              {registerSteps.length > 0 && <TxStatus steps={registerSteps} />}
              <Button fullWidth size="lg" isLoading={registering} onClick={handleRegister}>
                {registering ? "Registering…" : "Register"}
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Home" showBack={false} />
      <div className="flex flex-col gap-5 px-4 pb-8 animate-fade-in-up md:mx-auto md:max-w-2xl md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {/* Greeting */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">{greeting}</span>
          <span className="font-mono text-xs text-text-secondary">{shortAddress(wallet.address, 5)}</span>
        </div>

        {/* Balance overview */}
        <GlassCard padding="md">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-text-muted">
                  Spendable
                </span>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-text-primary">
                  {displayAmount(spendable)}
                </div>
              </div>
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-text-muted">
                  Receiving
                </span>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-text-primary">
                  {displayAmount(receiving)}
                </div>
              </div>
            </div>

            {receiving > 0n && (
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="secondary" isLoading={merging} onClick={handleMerge}>
                  Merge into spendable
                </Button>
                {mergeSteps.length > 0 && <TxStatus steps={mergeSteps} />}
              </div>
            )}

            {/*
              "Pending payroll claims" was in the original design here, but
              there's no on-chain data that distinguishes an unclaimed salary
              from any other unmerged incoming transfer — PayrollVault's
              claim() is just token.merge() under another name. The Receiving
              row above already covers "money waiting to be merged" for any
              source, payroll included, so a separate row would just repeat
              the same number under a different label.
            */}

            {/* <div className="glow-divider" /> */}

            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">
                {lastSync ? `Synced ${timeAgo(lastSync.getTime())}` : "Not synced yet"}
              </span>
              <Button size="sm" variant="ghost" isLoading={syncing} onClick={handleSync}>
                Sync
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Quick actions — horizontal scroll on mobile, all 6 fit in a row on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide md:grid md:grid-cols-6 md:overflow-visible">
          {QUICK_ACTIONS.map(({ href, icon: Icon, label }) => (
            <motion.div key={href} whileTap={{ scale: 0.94 }} className="shrink-0 md:w-full">
              <Link
                href={href}
                className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3.5 text-text-secondary transition-all duration-150 hover:border-border-hover hover:text-text-primary md:w-full"
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Recent activity */}
        <div>
          <div className="mb-2 flex items-center gap-3">
            <SectionLabel className="flex-1">Recent Activity</SectionLabel>
          </div>

          {activityLoading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          )}

          {!activityLoading && activity && activity.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card">
                <Activity className="text-text-muted" size={20} />
              </div>
              <p className="text-sm text-text-secondary">No activity yet</p>
              <p className="text-xs text-text-muted">Deposit USDC to get started</p>
              <Button size="sm" variant="secondary" onClick={() => router.push("/shield")}>
                Deposit USDC
              </Button>
            </div>
          )}

          {!activityLoading && activity && activity.length > 0 && (
            <GlassCard padding="md">
              <ul className="flex flex-col">
                {activity.map((ev) => (
                  <ActivityRow key={ev.cursor} ev={ev} wallet={wallet} decryptedAmount={decryptedAmounts.get(ev.cursor)} />
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      </div>
    </AppShell>
  );
}
