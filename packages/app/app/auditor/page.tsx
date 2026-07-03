"use client";

/**
 * Auditor console (DESIGN.md §8). Whoever holds the auditor's Grumpkin secret
 * decrypts the dual-channel ciphertexts that each transfer and withdraw event
 * carries. Pure key-and-events work: no wallet, no proving, no holder
 * cooperation — just the secret, pasted in.
 *
 * The secret never ships in the client bundle — `deploy.ts` redacts it from
 * the app's deployment file for exactly this reason (see `lib/deployment.ts`).
 * Once pasted in, it's remembered in this browser's localStorage (never sent
 * anywhere) so an auditor doesn't have to keep re-pasting it every visit; any
 * remembered key can be forgotten individually from the unlock screen.
 *
 * Beyond per-event amounts, the page replays the event stream into the
 * auditor's running view of every account (§8.1/§8.2): spendable balance from
 * the sender-channel checkpoints, receiving balance as the sum of decrypted
 * inbound transfers plus public deposits, folded on merge.
 */

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  ChainClient,
  IndexerClient,
  hybridFetchEvents,
  auditTransfer,
  auditWithdraw,
  auditorPublicKey,
  pointCoords,
  toHex32,
  fromHex,
  type ConfidentialEvent,
} from "@lucent/sdk";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { Callout } from "@/components/ui/Callout";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { displayAmount } from "@/lib/amount";
import { DEPLOYMENT } from "@/lib/deployment";
import { errMsg } from "@/lib/err";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useWallet } from "@/lib/wallet-context";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/cn";

type Tab = "decrypt" | "compliance";

/** One decrypted line of the auditor's ledger. */
interface AuditRow {
  ev: ConfidentialEvent;
  text: string;
  /** Decrypted (or public) amount, when the event has one. */
  amount: bigint | null;
  /** Sender's post-op spendable balance, when the event reveals one. */
  senderBalance: bigint | null;
  /** False iff a transfer's two channels decrypt to different amounts. */
  channelsAgree: boolean;
}

/** The auditor's running view of one account (§8.1). */
interface AccountView {
  address: string;
  /** Last sender-channel checkpoint (null = no owner op seen yet). */
  spendable: bigint | null;
  /** Running sum of decrypted inbound transfers + public deposits. */
  receiving: bigint;
  lastLedger: number;
}

function replay(events: ConfidentialEvent[], auditorSk: bigint): { rows: AuditRow[]; accounts: AccountView[] } {
  const rows: AuditRow[] = [];
  const accounts = new Map<string, AccountView>();
  const acct = (address: string): AccountView => {
    let a = accounts.get(address);
    if (!a) {
      a = { address, spendable: null, receiving: 0n, lastLedger: 0 };
      accounts.set(address, a);
    }
    return a;
  };
  const seen = (address: string, ledger: number) => {
    const a = acct(address);
    a.lastLedger = Math.max(a.lastLedger, ledger);
    return a;
  };

  for (const ev of events) {
    switch (ev.type) {
      case "register": {
        const a = seen(ev.account, ev.ledger);
        a.spendable = 0n;
        rows.push({ ev, text: "registered", amount: null, senderBalance: null, channelsAgree: true });
        break;
      }
      case "deposit": {
        const a = seen(ev.to, ev.ledger);
        a.receiving += ev.amount;
        rows.push({
          ev,
          text: "deposit (public amount)",
          amount: ev.amount,
          senderBalance: null,
          channelsAgree: true,
        });
        break;
      }
      case "merge": {
        const a = seen(ev.account, ev.ledger);
        if (a.spendable !== null) a.spendable += a.receiving;
        a.receiving = 0n;
        rows.push({
          ev,
          text: "merged receiving → spendable",
          amount: null,
          senderBalance: a.spendable,
          channelsAgree: true,
        });
        break;
      }
      case "withdraw": {
        const a = seen(ev.from, ev.ledger);
        const { senderBalance } = auditWithdraw(auditorSk, ev);
        a.spendable = senderBalance;
        rows.push({
          ev,
          text: "withdrawal (public amount) — checkpoint decrypted",
          amount: ev.amount,
          senderBalance,
          channelsAgree: true,
        });
        break;
      }
      case "transfer": {
        const from = seen(ev.from, ev.ledger);
        const to = seen(ev.to, ev.ledger);
        const d = auditTransfer(auditorSk, ev);
        if (d.channelsAgree) {
          from.spendable = d.senderBalance;
          to.receiving += d.amount;
        }
        rows.push({
          ev,
          text: d.channelsAgree
            ? "confidential transfer — both channels decrypted"
            : "transfer did NOT decrypt under this key",
          amount: d.channelsAgree ? d.amount : null,
          senderBalance: d.channelsAgree ? d.senderBalance : null,
          channelsAgree: d.channelsAgree,
        });
        break;
      }
    }
  }

  return {
    rows: rows.reverse(),
    accounts: [...accounts.values()].sort((a, b) => b.lastLedger - a.lastLedger),
  };
}

/** Remembered auditor secrets, most-recent-first — see the module doc comment. */
const SAVED_SECRETS_KEY = "lucent:auditor:secrets";
const MAX_SAVED_SECRETS = 6;

function loadSavedSecrets(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_SECRETS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveSavedSecrets(secrets: string[]): void {
  localStorage.setItem(SAVED_SECRETS_KEY, JSON.stringify(secrets));
}

export default function AuditorPage() {
  const [tab, setTab] = useState<Tab>("decrypt");
  const [secretInput, setSecretInput] = useState("");
  const [auditorSk, setAuditorSk] = useState<bigint | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [savedSecrets, setSavedSecrets] = useState<string[]>([]);

  useEffect(() => {
    setSavedSecrets(loadSavedSecrets());
  }, []);

  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasIndexer = !!DEPLOYMENT.indexerUrl;

  function remember(secret: string) {
    setSavedSecrets((prev) => {
      const next = [secret, ...prev.filter((s) => s !== secret)].slice(0, MAX_SAVED_SECRETS);
      saveSavedSecrets(next);
      return next;
    });
  }

  function forgetSecret(secret: string) {
    setSavedSecrets((prev) => {
      const next = prev.filter((s) => s !== secret);
      saveSavedSecrets(next);
      return next;
    });
  }

  function unlockWith(secret: string) {
    setKeyError(null);
    try {
      const sk = fromHex(secret.trim());
      setAuditorSk(sk);
      remember(secret.trim());
    } catch {
      setKeyError("Not a valid hex secret key (expected a 0x… 32-byte scalar).");
    }
  }

  function unlock() {
    unlockWith(secretInput);
  }

  function lock() {
    setAuditorSk(null);
    setSecretInput("");
    setRows(null);
    setAccounts([]);
    setError(null);
  }

  const load = useCallback(async (sk: bigint) => {
    setBusy(true);
    setError(null);
    try {
      const client = new ChainClient({
        rpcUrl: DEPLOYMENT.rpcUrl,
        networkPassphrase: DEPLOYMENT.networkPassphrase,
        contracts: DEPLOYMENT.contracts,
      });
      // Hybrid source: the indexer (when configured) backfills the full history
      // below the RPC's ~7-day window — exactly what an auditor needs. The RPC
      // leg is clamped to the retention boundary internally.
      const indexer = DEPLOYMENT.indexerUrl
        ? new IndexerClient({ baseUrl: DEPLOYMENT.indexerUrl })
        : undefined;
      const { events } = await hybridFetchEvents(client, indexer, {
        fromLedger: DEPLOYMENT.deployedAtLedger,
      });
      const result = replay(events, sk);
      setRows(result.rows);
      setAccounts(result.accounts);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (auditorSk !== null) void load(auditorSk);
  }, [auditorSk, load]);

  const kAud = auditorSk !== null ? pointCoords(auditorPublicKey(auditorSk)) : null;

  const transferRows = rows?.filter((r) => r.ev.type === "transfer" && r.channelsAgree) ?? [];
  const totalVolume = transferRows.reduce((sum, r) => sum + (r.amount ?? 0n), 0n);

  const hasCompliance = !!DEPLOYMENT.contracts.policy;

  return (
    <AppShell>
      <PageHeader title="Auditor" showBack={false} />

      <div className="flex flex-col gap-5 px-4 pb-8 md:mx-auto md:max-w-2xl md:px-8">
        {hasCompliance && (
          <div className="flex gap-2 rounded-2xl border border-border bg-card p-1">
            {(["decrypt", "compliance"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-sm font-medium capitalize transition-all duration-200",
                  tab === t ? "bg-accent text-black" : "text-text-muted hover:text-text-secondary",
                )}
              >
                {t === "decrypt" ? "Decrypt" : "Compliance"}
              </button>
            ))}
          </div>
        )}

        {tab === "compliance" && hasCompliance ? (
          <CompliancePanel />
        ) : (
          <>
        <p className="text-sm leading-relaxed text-text-secondary">
          Whoever holds a registered auditor's Grumpkin secret decrypts every transfer and withdrawal
          addressed to that key — no wallet, no proofs, no account cooperation required.
        </p>

        {auditorSk === null && (
          <Callout>
            The key you paste below never leaves this browser: it&apos;s never sent anywhere, and any
            key you unlock with is only remembered locally.
          </Callout>
        )}

        {auditorSk === null ? (
          <GlassCard padding="md" className="border-accent/25">
            <SectionLabel>Unlock Console</SectionLabel>
            <p className="mb-3 mt-3 text-xs text-text-muted">
              Paste your auditor secret key (the <code className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.85em] text-accent/90">k</code> whose
              public point <code className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.85em] text-accent/90">K_aud = k·H</code> was
              registered on-chain) to decrypt with it.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Auditor secret key"
                  placeholder="0x…"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  error={keyError ?? undefined}
                  className="font-mono"
                />
              </div>
              <Button onClick={unlock} disabled={!secretInput.trim()}>
                Unlock
              </Button>
            </div>

            {savedSecrets.length > 0 && (
              <div className="mt-4 flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Recent keys</span>
                {savedSecrets.map((s) => (
                  <div
                    key={s}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2"
                  >
                    <button
                      onClick={() => unlockWith(s)}
                      className="flex-1 truncate text-left font-mono text-[13px] text-text-secondary transition-colors hover:text-accent"
                    >
                      {shortAddr(s)}
                    </button>
                    <button
                      onClick={() => forgetSecret(s)}
                      aria-label="Forget this key"
                      className="shrink-0 text-text-muted transition-colors hover:text-error"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        ) : (
          <>
            {/* <GlassCard padding="md" className="border-accent/25">
              <div className="mb-1 mt-0 flex items-center justify-between">
                <SectionLabel>Auditor Console</SectionLabel>
                <Button size="sm" variant="ghost" onClick={lock}>
                  Lock
                </Button>
              </div>
              <p className="mb-3 mt-3 text-xs text-text-muted">
                Console unlocked with the key you pasted in. Only <code className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.85em] text-accent/90">K_aud</code> —
                the public point — is shown below; the secret itself is never redisplayed.
              </p>
              {kAud && (
                <dl className="space-y-1 break-all font-mono text-xs text-text-secondary">
                  <div>
                    <dt className="inline text-text-muted">K_aud.x: </dt>
                    <dd className="inline">{toHex32(kAud.x)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-text-muted">K_aud.y: </dt>
                    <dd className="inline">{toHex32(kAud.y)}</dd>
                  </div>
                </dl>
              )}
            </GlassCard> */}

            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Transfers decrypted" value={transferRows.length.toLocaleString()} />
              <StatCard label="Volume seen" value={displayAmount(totalVolume)} />
              <StatCard label="Accounts tracked" value={accounts.length.toLocaleString()} />
            </div>

            <GlassCard padding="md">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-text-primary">Accounts as you see them</h3>
                <Button size="sm" variant="secondary" isLoading={busy} onClick={() => load(auditorSk)}>
                  Reload
                </Button>
              </div>
              <p className="mb-3 text-xs text-text-muted">
                Reconstructed from sender-channel balance checkpoints and decrypted inbound credits.{" "}
                {hasIndexer
                  ? "Backed by the Goldsky indexer, so the full deployment history is decrypted."
                  : "Only events inside the RPC's ~7-day retention window are available — accounts with older history may be incomplete."}
              </p>
              {accounts.length === 0 && !busy && (
                <p className="text-sm text-text-muted">No accounts in the retention window.</p>
              )}
              {busy && accounts.length === 0 && (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              )}
              {accounts.length > 0 && (
                <table className="w-full text-left text-xs">
                  <thead className="text-text-muted">
                    <tr>
                      <th className="pb-2 font-normal">account</th>
                      <th className="pb-2 font-normal">spendable</th>
                      <th className="pb-2 font-normal">receiving</th>
                      <th className="pb-2 font-normal">last seen</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-secondary">
                    {accounts.map((a) => (
                      <tr key={a.address} className="border-t border-border">
                        <td className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <AddressDisplay address={a.address} chars={6} className="text-xs" />
                            {!a.address.startsWith("G") && <Pill tone="neutral">contract</Pill>}
                          </div>
                        </td>
                        <td className="py-1.5 font-mono tabular-nums text-text-primary">{a.spendable === null ? "?" : displayAmount(a.spendable)}</td>
                        <td className="py-1.5 font-mono tabular-nums text-text-primary">{displayAmount(a.receiving)}</td>
                        <td className="py-1.5 text-text-muted">ledger {a.lastLedger}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </GlassCard>

            <GlassCard padding="md">
              <h3 className="mb-1 font-semibold text-text-primary">Decrypted activity</h3>
              <p className="mb-3 text-xs text-text-muted">
                Every token-contract event {hasIndexer ? "since deployment" : "in the retention window"},
                newest first. Amounts every other screen shows encrypted appear here in cleartext —
                decrypted with your key alone.
              </p>
              <ErrorBanner error={error} onDismiss={() => setError(null)} className="mb-3" size="sm" />
              {!rows && busy && <p className="text-sm text-text-muted">Syncing events…</p>}
              {rows && rows.length === 0 && <p className="text-sm text-text-muted">No activity in the retention window.</p>}
              {rows && (
                <ul className="flex flex-col gap-2">
                  {rows.map((row) => (
                    <AuditRowView key={row.ev.cursor} row={row} />
                  ))}
                </ul>
              )}
            </GlassCard>

          </>
        )}
          </>
        )}

        <footer className="font-mono text-xs text-text-muted">
          auditor contract {shortAddr(DEPLOYMENT.contracts.auditor)} · token {shortAddr(DEPLOYMENT.contracts.token)}
        </footer>
      </div>
    </AppShell>
  );
}

/**
 * Freeze/unfreeze + allowlist management. Separate from the key-paste
 * decryption flow above: those are Grumpkin viewing keys, but compliance
 * actions are real on-chain transactions the token's `#[only_admin]` check
 * gates — they need a connected, signing Freighter wallet, not the auditor
 * secret. The app doesn't duplicate that authorization check; a connected
 * wallet that isn't the admin will just have its transaction rejected
 * on-chain, surfaced here as an error like anywhere else in the app.
 */
function CompliancePanel() {
  const { wallet, connect, connecting, error, setError } = useWallet();
  const { run, busy } = useAction();
  const [addr, setAddr] = useState("");
  const [status, setStatus] = useState<{ address: string; allowed: boolean; frozen: boolean } | null>(null);

  async function checkStatus() {
    if (!wallet || !addr.trim()) return;
    setError(null);
    try {
      const [allowed, frozen] = await Promise.all([wallet.isAllowed(addr.trim()), wallet.isFrozen(addr.trim())]);
      setStatus({ address: addr.trim(), allowed, frozen });
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <GlassCard padding="md" className="border-warning/25">
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>Compliance</SectionLabel>
        <Pill tone="amber">admin-only</Pill>
      </div>
      <p className="mb-3 mt-3 text-xs leading-relaxed text-text-muted">
        Accounts not on the allowlist cannot deposit, transfer, receive, or withdraw. Frozen accounts
        are blocked outright regardless of allowlist status. Both are enforced on-chain by the token
        contract, not by this page — only the compliance admin set at deploy time can act here.
      </p>

      {!wallet ? (
        <Button fullWidth isLoading={connecting} onClick={connect}>
          Connect Freighter to manage compliance
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <ErrorBanner error={error} onDismiss={() => setError(null)} size="sm" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Account address"
                placeholder="G…"
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                className="font-mono"
              />
            </div>
            <Button variant="secondary" onClick={checkStatus} disabled={!addr.trim()}>
              Check status
            </Button>
          </div>

          {status && status.address === addr.trim() && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>allowlisted:</span>
              <Pill tone={status.allowed ? "green" : "neutral"}>{status.allowed ? "yes" : "no"}</Pill>
              <span>frozen:</span>
              <Pill tone={status.frozen ? "red" : "neutral"}>{status.frozen ? "yes" : "no"}</Pill>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              size="sm"
              variant="secondary"
              disabled={!addr.trim()}
              isLoading={busy === "policyAdd"}
              onClick={() => run("policyAdd", async () => { await wallet.policyAdd(addr.trim()); await checkStatus(); }, { refresh: false })}
            >
              Allow
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!addr.trim()}
              isLoading={busy === "policyRemove"}
              onClick={() => run("policyRemove", async () => { await wallet.policyRemove(addr.trim()); await checkStatus(); }, { refresh: false })}
            >
              Remove
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!addr.trim()}
              isLoading={busy === "freeze"}
              onClick={() => run("freeze", async () => { await wallet.freeze(addr.trim()); await checkStatus(); }, { refresh: false })}
            >
              Freeze
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!addr.trim()}
              isLoading={busy === "unfreeze"}
              onClick={() => run("unfreeze", async () => { await wallet.unfreeze(addr.trim()); await checkStatus(); }, { refresh: false })}
            >
              Unfreeze
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function AuditRowView({ row }: { row: AuditRow }) {
  const { ev } = row;
  return (
    <li className="rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={badgeTone(ev.type)}>{ev.type}</Pill>
        {ev.type === "register" || ev.type === "merge" ? (
          <AddressDisplay address={ev.account} chars={6} className="text-xs" />
        ) : (
          <div className="flex items-center gap-1">
            <AddressDisplay address={ev.from} chars={6} className="text-xs" />
            <span className="text-xs text-text-muted">→</span>
            <AddressDisplay address={ev.to} chars={6} className="text-xs" />
          </div>
        )}
        <span className="flex-1" />
        {row.amount !== null && (
          <span className="font-mono text-sm font-medium tabular-nums text-accent">{displayAmount(row.amount)}</span>
        )}
        {!row.channelsAgree && <Pill tone="red">undecryptable</Pill>}
      </div>
      <div className="mt-1.5 text-xs text-text-muted">
        {row.text}
        {row.senderBalance !== null && (
          <>
            {" "}
            · sender&apos;s balance now <span className="text-text-secondary">{displayAmount(row.senderBalance)}</span>
          </>
        )}
      </div>
      <div className="mt-1 text-xs text-text-muted/70">
        ledger {ev.ledger} · tx{" "}
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${ev.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-accent/40 hover:text-accent-hover/50 hover:underline"
        >
          {ev.txHash.slice(0, 10)}…
        </a>
      </div>
    </li>
  );
}

function badgeTone(type: ConfidentialEvent["type"]): PillTone {
  switch (type) {
    case "transfer":
      return "amber";
    case "deposit":
      return "sky";
    case "withdraw":
      return "amber";
    case "register":
      return "violet";
    case "merge":
      return "neutral";
  }
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard padding="sm">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
        <span className="font-display text-xl font-bold tabular-nums text-text-primary">{value}</span>
      </div>
    </GlassCard>
  );
}
