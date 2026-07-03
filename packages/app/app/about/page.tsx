import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, Shield, Users, Briefcase, Globe } from "lucide-react";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";

export default function AboutPage() {
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

      <div className="pt-14">
        {/* Hero */}
        <section className="px-6 pb-20 pt-24">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.05] px-4 py-1.5 font-mono text-xs text-accent/70">
              Private payments for public chains
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Finance has always needed
              <br />
              <span className="text-accent">selective privacy.</span>
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-text-secondary">
              You wouldn&apos;t hand your bank statement to a stranger on the street. Yet every payment
              on a public blockchain is permanently, irrevocably visible to anyone who cares to look.
              Lucent fixes that — without hiding who you paid, only how much.
            </p>
          </div>
        </section>

        {/* The problem — two columns */}
        <section className="border-t border-border px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-accent/50">
              The problem
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-5 rounded-3xl border border-border bg-white/[0.02] p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error/10">
                  <Eye className="h-5 w-5 text-error" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="mb-3 text-lg font-semibold">The transparency trap</h2>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    Public blockchains expose every transaction to everyone, forever. Your salary, your
                    vendor payments, your treasury moves — all permanently readable by competitors, data
                    harvesters, and anyone with a block explorer. No traditional financial system would
                    accept this level of exposure if it fully understood what it was publishing.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-5 rounded-3xl border border-border bg-white/[0.02] p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/10">
                  <EyeOff className="h-5 w-5 text-warning" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="mb-3 text-lg font-semibold">The opacity trap</h2>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    Existing privacy tools — mixers, shielded pools, fully opaque coins — solve
                    transparency by hiding everything. You lose the auditability that makes blockchains
                    useful in the first place. Counterparties can&apos;t verify who they paid. Compliance
                    becomes impossible. You swap one problem for another.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Lucent approach */}
        <section className="border-t border-border px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-accent/50">
              The approach
            </p>
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-bg">
                <Lock className="h-7 w-7 text-accent" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
                Encrypt the amount.
                <br />
                Keep everything else public.
              </h2>
              <p className="max-w-xl text-base leading-relaxed text-text-secondary">
                Lucent takes a surgical approach: addresses stay fully visible on-chain, but amounts are
                held as Pedersen commitments and moved with zero-knowledge proofs. You can verify that a
                payment was made from wallet A to wallet B — but you cannot read how much was sent.
                Counterparties remain auditable. Amounts stay confidential.
              </p>
              <p className="max-w-xl text-base leading-relaxed text-text-secondary">
                The result: payroll can be distributed without exposing individual salaries, escrow can
                be settled without revealing the locked sum to third parties, and payments can be made
                without your transaction history becoming a public business-intelligence dataset.
              </p>
            </div>
          </div>
        </section>

        {/* Trust model */}
        <section className="border-t border-border px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-accent/50">
              Trust model
            </p>
            <div className="flex flex-col gap-6 rounded-3xl border border-border bg-white/[0.02] p-10">
              <div className="flex flex-col items-center gap-3 text-center">
                <Shield className="h-8 w-8 text-accent" strokeWidth={1.5} />
                <h2 className="text-xl font-semibold">The math is the trust.</h2>
              </div>
              <div className="grid grid-cols-1 gap-5 text-center sm:grid-cols-3">
                {[
                  {
                    title: "No off-chain operators",
                    desc: "Every proof is generated in your browser and verified natively by Stellar's Protocol 26 host functions — no separate privacy infrastructure to trust.",
                  },
                  {
                    title: "No operator keys",
                    desc: "There is no private key that could be stolen to decrypt your balances. The encryption is enforced by mathematics, not by a trusted party.",
                  },
                  {
                    title: "No bridge custody",
                    desc: "Your USDC stays in Soroban contracts on Stellar. There is no bridge, no wrapped token, and no custodian holding your funds.",
                  },
                ].map(({ title, desc }) => (
                  <div key={title} className="flex flex-col gap-2">
                    <div className="mb-2 h-px bg-border sm:hidden" />
                    <p className="text-sm font-semibold text-text-primary">{title}</p>
                    <p className="text-xs leading-relaxed text-text-secondary">{desc}</p>
                  </div>
                ))}
              </div>
              <p className="border-t border-border pt-6 text-center text-sm leading-relaxed text-text-secondary">
                Lucent inherits its security guarantees entirely from Stellar&apos;s native UltraHonk
                verifier — a zero-knowledge proof system verified inside Soroban itself. Encryption is
                enforced at the protocol level. No configuration, no trust assumptions, no operator.
              </p>
            </div>
          </div>
        </section>

        {/* Who it is for */}
        <section className="border-t border-border px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-accent/50">
              Who it&apos;s for
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Briefcase,
                  title: "Stellar teams",
                  desc: "Pay contributors and vendors without publishing your treasury's payment history to competitors.",
                },
                {
                  icon: Users,
                  title: "DAOs",
                  desc: "Run payroll with per-person confidential salaries. No member can see another's compensation on-chain.",
                },
                {
                  icon: Globe,
                  title: "Freelancers",
                  desc: "Invoice and get paid in USDC without your entire client list and rate card becoming public record.",
                },
                {
                  icon: Shield,
                  title: "Protocols",
                  desc: "Need confidential escrow in your settlement layer? Integrate PrivateEscrow directly into your Soroban contracts.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex flex-col gap-4 rounded-2xl border border-border bg-white/[0.02] p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-bg">
                    <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-semibold">{title}</p>
                    <p className="text-xs leading-relaxed text-text-secondary">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Built on Stellar */}
        <section className="border-t border-border px-6 py-16">
          <div className="mx-auto max-w-2xl">
            <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-accent/50">Built on</p>
            <div className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-white/[0.02] p-10 text-center">
              <div className="flex items-center gap-5">
                <LucentLogoMark size={44} />
                <span className="text-xl text-text-muted">×</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface-2">
                  <span className="text-xs font-bold tracking-tight text-text-primary">USDC</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">Lucent is powered by Stellar Soroban</h2>
                <p className="max-w-md text-sm leading-relaxed text-text-secondary">
                  Soroban is Stellar&apos;s smart contract platform, and Protocol 26 shipped native ZK
                  host functions that verify UltraHonk proofs on-chain without a coprocessor. Lucent
                  builds on OpenZeppelin&apos;s confidential-token module — Pedersen commitments,
                  Poseidon2 hashing, and a Rust contract stack — to bring amount-hidden payments to
                  Stellar.
                </p>
                <a
                  href="https://github.com/OpenZeppelin/stellar-contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mx-auto inline-flex items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-hover"
                >
                  Learn about Stellar <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
            <h2 className="text-2xl font-semibold">Ready to pay privately?</h2>
            <p className="text-sm text-text-secondary">Connect Freighter and deposit your first USDC.</p>
            <Link
              href="/shield"
              className="mx-auto inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
            >
              Launch App <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border px-6 py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <LucentLogoMark size={22} />
              <span className="text-sm font-semibold">Lucent</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-text-muted">
              <Link href="/docs" className="transition-colors hover:text-text-secondary">
                Docs
              </Link>
              <Link href="/stats" className="transition-colors hover:text-text-secondary">
                Stats
              </Link>
              <a
                href="https://developers.stellar.org"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-text-secondary"
              >
                Stellar Developers
              </a>
              <Link href="/" className="transition-colors hover:text-text-secondary">
                Home
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
