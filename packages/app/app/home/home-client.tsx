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
} from "lucide-react";
import {
  ChainClient,
  IndexerClient,
  hybridFetchEvents,
  type ConfidentialEvent,
  type TransferEvent,
  type EscrowInfo,
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
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { Modal } from "@/components/ui/Modal";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { DiscloseFlow } from "./disclose-flow";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress, timeAgo } from "@/lib/format";
import { displayAmount } from "@/lib/amount";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";

const QUICK_ACTIONS = [
  { href: "/shield", icon: ArrowDownUp, label: "Shield", tint: "text-accent bg-accent-bg" },
  { href: "/send", icon: Send, label: "Send", tint: "text-success bg-success/10" },
  { href: "/payroll", icon: Briefcase, label: "Payroll", tint: "text-encrypted bg-encrypted-bg" },
  { href: "/escrow", icon: Lock, label: "Escrow", tint: "text-warning bg-warning/10" },
];

/**
 * The RPC's `getEvents` returns each event's ledger close time at no extra
 * cost, so most events get a real "2m ago". Indexer-sourced events don't
 * currently carry this (the Worker's raw rows don't surface it), so those
 * fall back to the bare ledger number.
 */
function relativeTime(ev: ConfidentialEvent): string {
  if (ev.closedAt) return timeAgo(new Date(ev.closedAt).getTime());
  return `Ledger ${ev.ledger}`;
}

type IconType = ComponentType<{ className?: string }>;

/**
 * Cross-referenced context that lets a plain `confidential_transfer`/`merge`
 * be relabeled with what it actually was. The token contract has no notion of
 * "payroll" or "escrow" — a salary is just a transfer between two regular
 * (G...) addresses, indistinguishable on-chain from a deliberate personal
 * Send between the same two people. Only escrow gets relabeled, because it's
 * the one case with a hard signal: the counterparty being a contract (C...)
 * address — every escrow instance IS its own confidential account — not a
 * guess about intent. `escrowByAddress` resolves it to depositor/recipient.
 *
 * Payroll deliberately does NOT get the same treatment. An earlier version
 * relabeled any transfer to/from a known employer/employee of yours as
 * "Salary," but that's wrong the moment that employer and employee also send
 * each other money directly for any other reason — which is exactly a
 * personal transfer, and mislabeling it erodes trust in the whole feed.
 * There's no on-chain marker that distinguishes a transfer submitted via
 * PayrollVault's execute_run from one submitted directly by a wallet with the
 * same from/to — the PayrollVault contract's own EmployeePaid/RunExecuted
 * events would be the correct signal (matched by transaction hash), but that
 * means fetching a second contract's event stream, not implemented here.
 * A merge is likewise NOT relabeled "Claimed payroll" for the same reason:
 * claim() is literally token.merge() under another name.
 */
interface EventContext {
  me: string;
  escrowByAddress: Map<string, EscrowInfo>;
}

function describeEvent(ev: ConfidentialEvent, ctx: EventContext): { icon: IconType; iconColor: string; label: string } {
  const { me, escrowByAddress } = ctx;
  switch (ev.type) {
    case "transfer": {
      const counterparty = ev.to === me ? ev.from : ev.to;
      const received = ev.to === me;

      const escrow = escrowByAddress.get(counterparty);
      if (escrow) {
        if (received && escrow.depositor === me) {
          return { icon: Lock, iconColor: "text-warning", label: "Escrow refunded to you" };
        }
        if (received && escrow.recipient === me) {
          return { icon: Lock, iconColor: "text-success", label: "Escrow released to you" };
        }
        if (!received) {
          return { icon: Lock, iconColor: "text-warning", label: "Escrow funded" };
        }
      }

      return received
        ? { icon: ArrowDownLeft, iconColor: "text-success", label: `Received from ${shortAddress(ev.from, 4)}` }
        : { icon: ArrowUpRight, iconColor: "text-text-secondary", label: `Sent to ${shortAddress(ev.to, 4)}` };
    }
    case "deposit":
      return { icon: ArrowDownUp, iconColor: "text-accent", label: "Deposited" };
    case "withdraw":
      return { icon: ArrowDownUp, iconColor: "text-accent", label: "Withdrew" };
    case "merge":
      return { icon: Layers, iconColor: "text-encrypted", label: "Merged into spendable" };
    case "register":
      return { icon: UserCheck, iconColor: "text-encrypted", label: "Registered account" };
  }
}

function ActivityRow({
  ev,
  wallet,
  ctx,
  decryptedAmount,
}: {
  ev: ConfidentialEvent;
  wallet: ConfidentialWallet;
  ctx: EventContext;
  /** `undefined` = still decrypting, `null` = couldn't be attributed to this wallet. */
  decryptedAmount?: bigint | null;
}) {
  const me = ctx.me;
  const { icon: Icon, iconColor, label } = describeEvent(ev, ctx);
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
          <div className="text-xs text-text-muted">{relativeTime(ev)}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {ev.type === "transfer" &&
            (decryptedAmount === undefined ? (
              <Skeleton className="h-4 w-16" />
            ) : decryptedAmount === null ? (
              <EncryptedBadge />
            ) : (
              <span className={cn("font-mono text-sm font-medium tabular-nums", iconColor)}>
                {direction === "received" ? "+" : "−"}
                {displayAmount(decryptedAmount)}
              </span>
            ))}
          {ev.type === "deposit" && (
            <span className="font-mono text-sm font-medium tabular-nums text-accent">
              +{displayAmount(ev.amount)}
            </span>
          )}
          {ev.type === "withdraw" && (
            <span className="font-mono text-sm font-medium tabular-nums text-accent">
              −{displayAmount(ev.amount)}
            </span>
          )}
          {direction && canDisclose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setProveOpen((v) => !v);
              }}
              className="text-xs font-medium tracking-wide text-text-muted transition-colors duration-150 hover:text-accent"
            >
              {proveOpen ? "Close" : "Prove"}
            </button>
          )}
        </div>
      </div>
      {direction && (
        <Modal open={proveOpen} onClose={() => setProveOpen(false)} title="Prove This Transfer">
          <DiscloseFlow ev={ev as TransferEvent} direction={direction} wallet={wallet} />
        </Modal>
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
  const [escrowByAddress, setEscrowByAddress] = useState<Map<string, EscrowInfo>>(new Map());

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

  // Resolve escrow instance details (depositor/recipient/state) for every
  // contract-address counterparty appearing in the activity feed, so those
  // transfers can be relabeled "Escrow funded/released/refunded" instead of
  // a bare address. This is a hard signal (every escrow instance IS its own
  // confidential account), not a heuristic like the payroll match above.
  useEffect(() => {
    if (!wallet || !activity || !DEPLOYMENT.contracts.escrowFactory) return;
    const contractCounterparties = new Set<string>();
    for (const ev of activity) {
      if (ev.type !== "transfer") continue;
      const counterparty = ev.to === wallet.address ? ev.from : ev.to;
      if (!counterparty.startsWith("G")) contractCounterparties.add(counterparty);
    }
    if (contractCounterparties.size === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        [...contractCounterparties].map(async (addr): Promise<[string, EscrowInfo] | null> => {
          try {
            return [addr, await wallet.escrowInfo(addr)];
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setEscrowByAddress(new Map(entries.filter((e): e is [string, EscrowInfo] => e !== null)));
      }
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
            <AddressDisplay address={wallet.address} chars={5} />
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
          <AddressDisplay address={wallet.address} chars={5} />
        </div>

        {/* Balance overview */}
        <GlassCard padding="lg" glow>
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-text-muted">
                Total Balance
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-encrypted/20 bg-encrypted-bg px-2 py-0.5 text-[10px] font-medium text-encrypted">
                <Lock className="h-2.5 w-2.5" /> Confidential
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold tabular-nums text-text-primary">
                {displayAmount(spendable + receiving)}
              </span>
              <span className="font-mono text-sm text-text-muted">USDC</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface-2/60 p-3">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Lock className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Spendable</span>
                </div>
                <div className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-text-primary">
                  {displayAmount(spendable)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-2/60 p-3">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <ArrowDownLeft className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Receiving</span>
                </div>
                <div className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-text-primary">
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

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-text-muted">
                {lastSync ? `Synced ${timeAgo(lastSync.getTime())}` : "Not synced yet"}
              </span>
              <Button size="sm" variant="ghost" isLoading={syncing} onClick={handleSync}>
                Sync
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Quick actions — horizontal scroll on mobile, all 4 fit in a row on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible">
          {QUICK_ACTIONS.map(({ href, icon: Icon, label, tint }) => (
            <motion.div
              key={href}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              className="shrink-0 md:w-full"
            >
              <Link
                href={href}
                className="group flex shrink-0 flex-col items-center gap-2.5 rounded-2xl border border-border bg-card px-5 py-4 transition-all duration-150 hover:border-border-hover md:w-full"
              >
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full transition-colors", tint)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-text-secondary transition-colors group-hover:text-text-primary">
                  {label}
                </span>
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
                  <ActivityRow
                    key={ev.cursor}
                    ev={ev}
                    wallet={wallet}
                    ctx={{ me: wallet.address, escrowByAddress }}
                    decryptedAmount={decryptedAmounts.get(ev.cursor)}
                  />
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      </div>
    </AppShell>
  );
}
