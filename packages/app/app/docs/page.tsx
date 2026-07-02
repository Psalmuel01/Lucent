"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { DEPLOYMENT } from "@/lib/deployment";

const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "how-it-works", label: "How it Works" },
  { id: "deposit-withdraw", label: "Deposit & Withdraw" },
  { id: "private-payments", label: "Private Payments" },
  { id: "payroll", label: "Confidential Payroll" },
  { id: "escrow", label: "Encrypted Escrow" },
  { id: "disclosure", label: "Selective Disclosure" },
  { id: "auditor", label: "Auditor View Key" },
  { id: "contracts", label: "Contracts" },
  { id: "faq", label: "FAQ" },
];

function Code({ children }: { children: string }) {
  return (
    <code className="inline-block rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.82em] text-accent/90">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-border bg-[#0A0A0A] p-5 font-mono text-xs leading-relaxed text-text-secondary">
      {children}
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-14 mb-5 scroll-mt-24 font-display text-2xl font-semibold text-text-primary first:mt-0">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-8 font-display text-base font-semibold text-text-primary">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-relaxed text-text-secondary">{children}</p>;
}

function AddressRow({ name, addr }: { name: string; addr: string }) {
  if (!addr) {
    return (
      <div className="flex flex-col justify-between gap-1.5 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center">
        <span className="text-sm font-medium text-text-primary">{name}</span>
        <span className="font-mono text-xs text-text-muted">not deployed yet</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-between gap-1.5 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center">
      <span className="text-sm font-medium text-text-primary">{name}</span>
      <a
        href={`https://stellar.expert/explorer/testnet/contract/${addr}`}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all font-mono text-xs text-accent/80 transition-colors hover:text-accent"
      >
        {addr}
      </a>
    </div>
  );
}

export default function DocsPage() {
  const [activeId, setActiveId] = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const addresses = {
    ConfidentialToken: DEPLOYMENT.contracts.token,
    Verifier: DEPLOYMENT.contracts.verifier,
    Auditor: DEPLOYMENT.contracts.auditor,
    PayrollVault: DEPLOYMENT.contracts.payroll,
    "PrivateEscrow Factory": DEPLOYMENT.contracts.escrowFactory,
  };

  return (
    <div className="min-h-dvh bg-void text-text-primary">
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-void/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-75">
            <LucentLogoMark size={24} />
            <span className="text-sm font-semibold">Lucent</span>
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            <span className="text-sm text-text-muted">Docs</span>
          </Link>
          <Link
            href="/shield"
            className="hidden items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-accent-hover sm:flex"
          >
            Launch App <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      <div className="mx-auto flex max-w-7xl pt-14">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col overflow-y-auto border-r border-border py-8 pr-4 lg:flex">
          <p className="mb-4 px-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">Contents</p>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeId === id ? "bg-accent-bg font-medium text-accent" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="fixed bottom-6 right-4 z-30 lg:hidden">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-text-secondary shadow-xl"
          >
            {SECTIONS.find((s) => s.id === activeId)?.label ?? "Contents"}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {sidebarOpen && (
            <div className="absolute bottom-12 right-0 w-48 rounded-2xl border border-border bg-surface-2 py-2 shadow-2xl">
              {SECTIONS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-4 py-2.5 text-sm transition-colors ${
                    activeId === id ? "text-accent" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

        <main className="min-w-0 max-w-3xl flex-1 px-6 py-10 pb-32 lg:px-12">
          <H2 id="introduction">Introduction</H2>
          <P>
            Lucent is a confidential payments layer built on Stellar. It lets you send, receive, run
            payroll, and lock escrow while keeping every amount hidden on-chain — visible to no one
            except the parties you authorize, not even validators.
          </P>
          <H3>The trust model</H3>
          <P>
            Lucent doesn&apos;t rely on trusted relayers or off-chain custody. Privacy comes from
            zero-knowledge proofs generated in your browser and verified natively by Stellar&apos;s
            Protocol 26 host functions. There is no operator key that could be compromised, and no
            bridge holding your funds.
          </P>
          <H3>The privacy model</H3>
          <P>
            Lucent encrypts <em>amounts only</em>. Counterparty addresses remain fully public, so
            on-chain auditability is preserved — you can verify that a payment moved from wallet A to
            wallet B without knowing how much. That is the right trade-off for payments and payroll:
            the <em>who</em> is public; the <em>how much</em> is private.
          </P>
          <P>
            Every balance is a Pedersen commitment on the Grumpkin curve, <Code>C = v·G + r·H</Code>.
            The network only ever sees commitments and the UltraHonk proofs that the arithmetic behind
            them is correct — no plaintext amount ever appears in a transaction, event, or contract
            state entry.
          </P>

          <H2 id="how-it-works">How it Works</H2>
          <P>
            Every confidential account holds a <strong>spendable</strong> balance (what you can send or
            withdraw) and a <strong>receiving</strong> balance (where deposits and incoming transfers
            land). A <Code>merge</Code> folds receiving into spendable — a homomorphic point addition
            that needs no proof.
          </P>
          <Pre>{`register    proof  Bind your Grumpkin keys to the contract (one-time)
deposit     —      Public XLM -> your receiving balance
merge       —      Fold receiving -> spendable
withdraw    proof  Spendable -> public XLM
transfer    proof  Spendable -> another account's receiving balance`}</Pre>
          <P>
            Every transfer also emits dual auditor ciphertexts — one for the sender&apos;s channel, one
            for the recipient&apos;s — so the registered auditor key can decrypt every amount without
            either party&apos;s cooperation.
          </P>

          <H2 id="deposit-withdraw">Deposit & Withdraw</H2>
          <H3>Deposit</H3>
          <P>
            Go to <strong>Shield</strong> and deposit. This moves public XLM into your confidential
            receiving balance at a 1:1 ratio — no proof required, since the deposit commitment has zero
            blinding. Merge it into spendable before sending or withdrawing.
          </P>
          <H3>Withdraw</H3>
          <P>
            Withdrawing is a two-step, in-browser flow: a withdraw proof is generated locally (this
            takes a few seconds), then submitted on-chain. The Soroban verifier checks the proof and
            converts your spendable balance back into public XLM.
          </P>

          <H2 id="private-payments">Private Payments</H2>
          <P>
            Go to <strong>Send</strong>, choose a registered recipient, and enter an amount. A transfer
            proof is generated in your browser and submitted with the transaction — the recipient
            address is visible on-chain; the amount is not.
          </P>

          <H2 id="payroll">Confidential Payroll</H2>
          <P>
            <strong>PayrollVault</strong> is an orchestrator, not a custodian: an employer creates a
            template of employees and opens a run. Salaries never touch chain storage — at execution
            the employer&apos;s browser proves one confidential transfer per employee, and the vault
            routes them atomically. No employee can read another&apos;s salary.
          </P>
          <Pre>{`create_template(employer, employees) -> template_id
create_run(template_id)               -> run_id
fund_run(run_id)
execute_run(run_id, transfers)        // one proof per employee
cancel_run(run_id)
claim()                               // employee folds salary into spendable`}</Pre>

          <H2 id="escrow">Encrypted Escrow</H2>
          <P>
            <strong>PrivateEscrow</strong> is custodial: each escrow deploys its own instance contract
            — its own confidential account with an isolated balance. The depositor funds it and hands
            over two pre-generated payout proofs (to the recipient, and back to themselves); the
            instance submits exactly the one the state machine selects.
          </P>
          <Pre>{`Depositor creates -> funds escrow      (CREATED -> FUNDED)
Recipient delivers -> mark_completed   (FUNDED -> COMPLETED)
Depositor reviews -> release           (COMPLETED -> RELEASED)

If depositor stalls past the release window:
  With arbiter    -> recipient disputes    (DISPUTED, arbiter resolves)
  Without arbiter -> recipient claims      (auto RELEASED)

No delivery -> depositor waits for timeout -> reclaims (REFUNDED)`}</Pre>

          <H2 id="disclosure">Selective Disclosure</H2>
          <P>
            Go to <strong>Prove</strong> to disclose one transfer to one counterparty — off-chain,
            revealing nothing else. A verifier mints a one-time request; the holder proves the amount
            with a zero-knowledge proof bound to that request; the verifier checks it against the chain
            itself, never trusting the bundle.
          </P>

          <H2 id="auditor">Auditor View Key</H2>
          <P>
            Every account registers under an auditor id. The holder of that Grumpkin secret key can
            decrypt every transfer amount and balance checkpoint on the <strong>Auditor</strong> screen —
            the institutional compliance primitive. Nobody else can.
          </P>

          <H2 id="contracts">Contracts</H2>
          <P>
            All contracts are deployed on Stellar testnet. Source is available on GitHub, built on{" "}
            <Code>OpenZeppelin/stellar-contracts</Code>.
          </P>
          <div className="mb-8 rounded-2xl border border-border bg-white/[0.02] px-5">
            {Object.entries(addresses).map(([name, addr]) => (
              <AddressRow key={name} name={name} addr={addr} />
            ))}
          </div>

          <H2 id="faq">FAQ</H2>
          <H3>Can anyone see my balance?</H3>
          <P>
            No. Your balance is a Pedersen commitment on-chain. The plaintext openings live only in
            events, reconstructed and persisted locally by your browser&apos;s state engine — never
            broadcast in the clear.
          </P>
          <H3>Does the escrow arbiter see the locked amount?</H3>
          <P>
            No. The arbiter resolves disputes by state transition alone; the amount stays hidden through
            the entire lifecycle.
          </P>
          <H3>Is Lucent audited?</H3>
          <P>
            No. Lucent runs on Stellar testnet and the UltraHonk verifier and circuits are unaudited. Do
            not use it with real value.
          </P>
          <H3>What happens if I lose my wallet?</H3>
          <P>
            Confidential keys are derived deterministically from a Freighter signature, so they can be
            re-derived from the same wallet. Local balance history persisted in your browser is not
            recoverable if lost, but re-syncing from chain events reconstructs it within the RPC&apos;s
            ~7-day retention window.
          </P>
          <H3>Where is the source code?</H3>
          <P>
            The contracts and frontend are open source on{" "}
            <a
              href="https://github.com/Psalmuel01/Lucent"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent transition-colors hover:text-accent-hover"
            >
              GitHub
            </a>
            .
          </P>
        </main>
      </div>
    </div>
  );
}
