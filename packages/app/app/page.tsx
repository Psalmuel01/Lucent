"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowDownUp, Send, Briefcase, Lock, ScanLine, Shield } from "lucide-react";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { cn } from "@/lib/cn";

const STEPS = [
  {
    num: "01",
    title: "Deposit XLM",
    desc: "Move public XLM into a confidential balance in one transaction. From then on your balance is a Pedersen commitment, not a number.",
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
  },
  {
    icon: Briefcase,
    title: "Confidential Payroll",
    desc: "Employee addresses are on-chain. Salary amounts are not. No colleague can read another's, even on a public explorer.",
  },
  {
    icon: Lock,
    title: "Encrypted Escrow",
    desc: "The locked amount stays hidden through creation, dispute, and release. Parties and finality are public. The number is private.",
  },
  {
    icon: ScanLine,
    title: "Selective Disclosure",
    desc: "Prove a specific transfer paid exactly one amount to one counterparty — without revealing anything else, on-chain or off.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-void text-text-primary">
      {/* Fixed nav */}
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-void/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <LucentLogoMark size={28} />
            <span className="font-display text-base font-semibold">Lucent</span>
          </div>
          <div className="flex items-center gap-7">
            <Link href="/docs" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
              Docs
            </Link>
            <Link href="/about" className="hidden text-sm text-text-secondary transition-colors hover:text-text-primary sm:inline">
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
        </div>
      </nav>

      {/* Hero */}
      <section className="flex min-h-dvh flex-col items-center justify-center px-6 pt-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
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
            <LucentLogoMark size={120} />
          </motion.div>

          <motion.div
            className="flex flex-col gap-5"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
          >
            <motion.h1 variants={fadeUp} className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              The amount is
              <br />
              <span className="text-accent">the only secret.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mx-auto max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
              Sender and receiver are public. Only the number is encrypted — with ZK proofs verified
              natively on Stellar. Same chain, same finality, different visibility.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/shield"
                className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
              >
                Launch App
                <ArrowRight className="h-4 w-4" />
              </Link>
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
              <span>·</span>
              <span>Soroban testnet</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-accent/70">How it works</p>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">Private payments in three steps</h2>
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
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-accent/70">Features</p>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              The relationship stays public. The number doesn&apos;t.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="glass-card flex gap-4 p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-bg">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
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
          <div className="glow-divider mb-10" />
          <motion.div
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-bg">
              <Shield className="h-7 w-7 text-accent" strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              Encrypted by math, not by trust.
            </h2>
            <p className={cn("max-w-lg leading-relaxed text-text-secondary")}>
              Zero-knowledge proofs are generated in your browser and verified on-chain by Stellar&apos;s
              Protocol 26 host functions. There are no off-chain operators and no custodians — the same
              chain, the same finality, just a different visibility rule for one number.
            </p>
            <div className="rounded-full border border-accent/20 bg-accent/[0.05] px-4 py-2">
              <span className="font-mono text-xs text-accent/70">Stellar Protocol 26 · Soroban testnet</span>
            </div>
          </motion.div>
          <div className="glow-divider mt-10" />
        </div>
      </section>

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
              href="https://github.com/OpenZeppelin/stellar-contracts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-muted transition-colors hover:text-text-secondary"
            >
              GitHub
            </a>
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              Built on <span className="ml-1 font-semibold">Stellar</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
