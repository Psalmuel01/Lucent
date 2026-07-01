/**
 * Lucent landing — the product overview and entry points to the six screens.
 */

import Link from "next/link";
import { DEPLOYMENT } from "@/lib/deployment";

const CARDS = [
  { href: "/shield", title: "Shield", blurb: "Move public XLM into a confidential balance and back out. Deposit, merge, and withdraw — amounts never appear on-chain." },
  { href: "/send", title: "Send", blurb: "Confidential transfers to any registered account. The amount is a curve commitment; only a client-side proof moves it." },
  { href: "/payroll", title: "Payroll", blurb: "Distribute salaries so no employee can see another's. The employer, as auditor, can decrypt every amount." },
  { href: "/escrow", title: "Escrow", blurb: "Two-party escrow whose locked amount stays hidden through the full state machine — release, dispute, resolve, refund." },
  { href: "/auditor", title: "Auditor", blurb: "The compliance console: decrypt every transfer amount with the registered Grumpkin auditor key." },
  { href: "/prove", title: "Prove", blurb: "Selective disclosure — prove one transfer paid exactly X to one counterparty, revealing nothing else." },
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-14">
      <header className="mb-12 max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
          Confidential payments · Stellar testnet
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-50">
          Payments that stay private,
          <br />
          <span className="text-amber-400">auditable when they must be.</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Lucent is a confidential-payments product built on Stellar&apos;s confidential token:
          balances are Grumpkin Pedersen commitments and every spend is an UltraHonk zero-knowledge
          proof generated in your browser. On top sit payroll and escrow, a dual-auditor compliance
          channel, and off-chain selective disclosure.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition-colors hover:border-amber-400/40"
          >
            <h2 className="text-lg font-semibold text-neutral-100 group-hover:text-amber-300">
              {c.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{c.blurb}</p>
          </Link>
        ))}
      </div>

      <footer className="mt-12 font-mono text-xs text-neutral-600">
        token {short(DEPLOYMENT.contracts.token)} · verifier {short(DEPLOYMENT.contracts.verifier)} ·
        auditor {short(DEPLOYMENT.contracts.auditor)} · Stellar testnet · unaudited reference demo
      </footer>
    </main>
  );
}

function short(id: string): string {
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
