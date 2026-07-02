"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowDownUp,
  Send,
  Briefcase,
  Lock,
  ScanLine,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { ChainClient, fetchEvents } from "@lucent/sdk";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { GithubMark } from "@/components/icons/GithubMark";
import { Skeleton } from "@/components/ui/Skeleton";
import { DEPLOYMENT } from "@/lib/deployment";

const STEPS = [
  {
    num: "01",
    title: "Deposit USDC",
    desc: "Move public USDC into a confidential balance in one transaction. From then on your balance is a Pedersen commitment, not a number.",
    icon: ArrowDownUp,
  },
  {
    num: "02",
    title: "Pay Privately",
    desc: "Send, run payroll, lock escrow. Every amount is proven with a zero-knowledge proof generated right in your browser.",
    icon: Lock,
  },
  {
    num: "03",
    title: "Stay Auditable",
    desc: "Sender and receiver stay on-chain and public. The auditor key can decrypt every amount for compliance — nobody else can.",
    icon: ScanLine,
  },
];

const FEATURES = [
  {
    icon: Send,
    title: "Private Payments",
    desc: "Sender and receiver are public. The amount is not — hidden behind a commitment and a proof, not an assumption.",
    color: "text-accent bg-accent-bg",
  },
  {
    icon: Briefcase,
    title: "Confidential Payroll",
    desc: "Employee addresses are on-chain. Salary amounts are not. No colleague can read another's, even on a public explorer.",
    color: "text-sky-400 bg-sky-500/10",
  },
  {
    icon: Lock,
    title: "Encrypted Escrow",
    desc: "The locked amount stays hidden through creation, dispute, and release. Parties and finality are public. The number is private.",
    color: "text-encrypted bg-encrypted-bg",
  },
  {
    icon: ScanLine,
    title: "Selective Disclosure",
    desc: "Prove a specific transfer paid exactly one amount to one counterparty — without revealing anything else, on-chain or off.",
    color: "text-success bg-success/10",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

function StatsBar() {
  const [count, setCount] = useState<number | null>(null);
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
        if (!cancelled) setCount(events.length);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border-t border-border py-6">
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-12 px-6">
        <div className="text-center">
          <div className="font-mono text-sm font-semibold text-text-secondary">Protocol 26</div>
          <div className="mt-1 text-xs text-text-muted">ZK verified on-chain</div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          {loading ? (
            <Skeleton className="mx-auto h-9 w-14" />
          ) : (
            <div className="font-display text-3xl font-bold tabular-nums text-accent">{count ?? "—"}</div>
          )}
          <div className="mt-1 text-xs text-text-muted">confidential transactions</div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <div className="font-mono text-sm font-semibold text-text-secondary">Stellar testnet</div>
          <div className="mt-1 text-xs text-text-muted">live deployment</div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-void text-text-primary">
      {/* Fixed nav */}
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-void/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <LucentLogoMark size={28} />
            <span className="text-base font-semibold">Lucent</span>
          </div>

          {/* Desktop links */}
          <div className="hidden items-center gap-7 md:flex">
            <Link href="/docs" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
              Docs
            </Link>
            <Link href="/about" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
              About
            </Link>
            <Link
              href="/shield"
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
            >
              Launch App
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-2 text-text-secondary transition-colors hover:text-text-primary md:hidden"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-border bg-void/95 backdrop-blur-2xl md:hidden"
            >
              <div className="flex flex-col gap-5 px-6 py-5">
                <Link
                  href="/docs"
                  className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Docs
                </Link>
                <Link
                  href="/about"
                  className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About
                </Link>
                <Link
                  href="/shield"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
                >
                  Launch App
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-28 pt-36">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: "radial-gradient(circle, rgba(251,187,36,0.22) 0%, transparent 70%)",
                filter: "blur(48px)",
                transform: "scale(3)",
              }}
            />
            <LucentLogoMark size={88} />
          </motion.div>

          <motion.div
            className="flex flex-col gap-5"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
          >
            <motion.h1 variants={fadeUp} className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              The amount is
              <br />
              <span className="text-accent">the only secret.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mx-auto max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
              Sender and receiver are public. Only the number is encrypted — with ZK proofs verified
              natively on Stellar. Same chain, same finality, different visibility.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/shield"
                className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
              >
                Launch App
                <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="hidden h-8 w-px bg-border sm:block" />
              <Link
                href="/docs"
                className="flex items-center justify-center gap-2 rounded-2xl border border-border px-7 py-3.5 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
              >
                Read Docs
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 font-mono text-xs text-text-muted">
              <span>Powered by</span>
              <span className="font-medium text-text-secondary">Stellar Protocol 26</span>
              <span className="text-accent">·</span>
              <span>Soroban testnet</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-accent/60">How it works</p>
            <h2 className="text-2xl font-semibold md:text-3xl">Private payments in three steps</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {STEPS.map(({ num, title, desc, icon: Icon }, i) => (
              <motion.div
                key={num}
                className="glass-card flex flex-col gap-5 p-7"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-bg">
                    <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
                  </div>
                  <span className="font-mono text-3xl font-bold text-white/[0.07]">{num}</span>
                </div>
                <div>
                  <h3 className="mb-2 text-base font-semibold text-text-primary">{title}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-accent/60">Features</p>
            <h2 className="text-2xl font-semibold md:text-3xl">
              The relationship stays public. The number doesn&apos;t.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc, color }, i) => (
              <motion.div
                key={title}
                className="glass-card flex gap-4 p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${color}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold text-text-primary">{title}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust model */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            className="glass-card flex flex-col items-center gap-6 p-10 md:p-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-bg">
              <Shield className="h-7 w-7 text-accent" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold md:text-3xl">Privacy that works for real payments.</h2>
              <p className="max-w-lg leading-relaxed text-text-secondary">
                Most privacy tools hide identity and break compliance. Lucent encrypts only the amount —
                the relationship stays auditable, on the same chain, with the same finality. No off-chain
                operators, no custodians, no separate infrastructure.
              </p>
            </div>
            <div className="rounded-full border border-accent/20 bg-accent/[0.05] px-4 py-2">
              <span className="font-mono text-xs text-accent/70">Stellar Protocol 26 · Soroban testnet</span>
            </div>
          </motion.div>
        </div>
      </section>

      <StatsBar />

      {/* Footer */}
      <footer className="border-t border-border px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <LucentLogoMark size={26} />
            <div>
              <p className="text-sm font-semibold">Lucent</p>
              <p className="text-xs text-text-muted">The amount is the only secret</p>
            </div>
          </div>
          <div className="flex items-center gap-7">
            <Link href="/docs" className="text-sm text-text-muted transition-colors hover:text-text-secondary">
              Docs
            </Link>
            <Link href="/about" className="text-sm text-text-muted transition-colors hover:text-text-secondary">
              About
            </Link>
            <a
              href="https://github.com/Psalmuel01/Lucent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-secondary"
            >
              <GithubMark className="h-4 w-4" />
              GitHub
            </a>
            <a
              href="https://github.com/OpenZeppelin/stellar-contracts"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
            >
              Built on <span className="ml-1 font-semibold">Stellar</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
