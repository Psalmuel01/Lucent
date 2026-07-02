"use client";

/**
 * Auditor console (DESIGN.md §8). The auditor persona holds the Grumpkin
 * secret behind auditor id 0 — the id every account in this demo registers
 * under — and decrypts the dual-channel ciphertexts that each transfer and
 * withdraw event carries. Pure key-and-events work: no wallet, no proving,
 * no holder cooperation.
 *
 * Beyond per-event amounts, the page replays the event stream into the
 * auditor's running view of every account (§8.1/§8.2): spendable balance from
 * the sender-channel checkpoints, receiving balance as the sum of decrypted
 * inbound transfers plus public deposits, folded on merge.
 *
 * ⚠️ The secret key is shipped in the client bundle ON PURPOSE so anyone can
 * play this persona. Real deployments keep it far away from a browser.
 */

import { useCallback, useEffect, useState } from "react";
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
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { displayAmount } from "@/lib/amount";
import { DEPLOYMENT } from "@/lib/deployment";
import { errMsg } from "@/lib/err";
import { CopyButton } from "../copy-button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const AUDITOR_SK = fromHex(DEPLOYMENT.auditorSecretHex);

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

function replay(events: ConfidentialEvent[]): { rows: AuditRow[]; accounts: AccountView[] } {
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
        const { senderBalance } = auditWithdraw(AUDITOR_SK, ev);
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
        const d = auditTransfer(AUDITOR_SK, ev);
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

export default function AuditorPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kAud = pointCoords(auditorPublicKey(AUDITOR_SK));
  const hasIndexer = !!DEPLOYMENT.indexerUrl;

  const load = useCallback(async () => {
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
      const result = replay(events);
      setRows(result.rows);
      setAccounts(result.accounts);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageHeader title="Auditor" showBack={false} />

      <div className="flex flex-col gap-5 px-4 pb-8 md:mx-auto md:max-w-2xl md:px-8">
        <p className="text-sm leading-relaxed text-text-secondary">
          You are the designated auditor for this deployment: every account registers under your
          auditor id. Amounts that everyone else sees as a commitment, you read in cleartext — each
          transfer and withdrawal carries ciphertexts addressed to your key. No wallet, no proofs, and
          no account cooperation required.
        </p>

        <GlassCard padding="md" className="border-accent/25">
          <SectionLabel>Auditor Console</SectionLabel>
          <h3 className="mb-1 mt-3 text-sm font-semibold text-accent">Your auditor key (id {DEPLOYMENT.auditorId})</h3>
          <p className="mb-3 text-xs text-text-muted">
            Demo-only: this secret ships with the app so anyone can take the auditor role. In a real
            deployment it lives in the auditor&apos;s vault and only the public key{" "}
            <code className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.85em] text-accent/90">K_aud = k·H</code> is
            registered on-chain.
          </p>
          <dl className="space-y-1 break-all font-mono text-xs text-text-secondary">
            <div>
              <dt className="inline text-text-muted">secret k: </dt>
              <dd className="inline">{DEPLOYMENT.auditorSecretHex}</dd>{" "}
              <CopyButton label="Copy" payload={() => DEPLOYMENT.auditorSecretHex} />
            </div>
            <div>
              <dt className="inline text-text-muted">K_aud.x: </dt>
              <dd className="inline">{toHex32(kAud.x)}</dd>
            </div>
            <div>
              <dt className="inline text-text-muted">K_aud.y: </dt>
              <dd className="inline">{toHex32(kAud.y)}</dd>
            </div>
          </dl>
        </GlassCard>

        <GlassCard padding="md">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">Accounts as you see them</h3>
            <Button size="sm" variant="secondary" isLoading={busy} onClick={load}>
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
                    <td className="py-1.5 font-mono">{shortAddr(a.address)}</td>
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

        <footer className="font-mono text-xs text-text-muted">
          auditor contract {shortAddr(DEPLOYMENT.contracts.auditor)} · token {shortAddr(DEPLOYMENT.contracts.token)}
        </footer>
      </div>
    </AppShell>
  );
}

function AuditRowView({ row }: { row: AuditRow }) {
  const { ev } = row;
  const parties =
    ev.type === "register" || ev.type === "merge"
      ? shortAddr(ev.account)
      : `${shortAddr(ev.from)} → ${shortAddr(ev.to)}`;
  return (
    <li className="rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={badgeTone(ev.type)}>{ev.type}</Pill>
        <span className="font-mono text-xs text-text-muted">{parties}</span>
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
