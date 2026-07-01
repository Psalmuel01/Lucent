"use client";

/**
 * Lucent UI kit — dark, glassy, amber-accented primitives shared across the
 * product screens. Every proof-carrying action renders through {@link ProofButton},
 * which never lets the UI look frozen: the moment it's pressed it shows a
 * spinner and a phase label ("Generating proof…" / "Submitting…").
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Open-padlock brand mark. */
export function LockGlyph({ className = "h-6 w-6 text-amber-400" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" fill="currentColor" fillOpacity="0.14"
        stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.5-1.9" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <motion.span
      aria-hidden
      className={cn("inline-block rounded-full border-2 border-current border-t-transparent", className)}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }}
    />
  );
}

export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-100">{title}</h2>
      {hint && <p className="mt-1 text-sm leading-relaxed text-neutral-400">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="mt-0.5 text-2xl font-medium tabular-nums text-neutral-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: PillTone }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PILL[tone])}>{children}</span>;
}

type PillTone = "neutral" | "amber" | "green" | "red" | "sky" | "violet";
const PILL: Record<PillTone, string> = {
  neutral: "bg-white/10 text-neutral-300",
  amber: "bg-amber-500/15 text-amber-300",
  green: "bg-emerald-500/15 text-emerald-300",
  red: "bg-red-500/15 text-red-300",
  sky: "bg-sky-500/15 text-sky-300",
  violet: "bg-violet-500/15 text-violet-300",
};

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-amber-400/60";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

/**
 * Action button that surfaces async progress. Pass `busy` (this button is
 * running) and an optional `phase` for a proof-carrying op.
 */
export function ProofButton({
  children,
  onClick,
  disabled,
  busy,
  phase,
  variant = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  phase?: "proving" | "submitting" | null;
  variant?: "primary" | "ghost" | "danger";
}) {
  const label = busy
    ? phase === "proving"
      ? "Generating proof…"
      : phase === "submitting"
        ? "Submitting…"
        : "Working…"
    : null;
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        VARIANT[variant],
      )}
    >
      {busy && <Spinner />}
      {label ?? children}
    </button>
  );
}

const VARIANT: Record<string, string> = {
  primary: "bg-amber-400 text-black hover:bg-amber-300",
  ghost: "border border-white/15 text-neutral-200 hover:border-white/30",
  danger: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
};

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function ConnectPrompt({ onConnect, busy }: { onConnect: () => void; busy: boolean }) {
  return (
    <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
      <LockGlyph className="h-10 w-10 text-amber-400" />
      <p className="text-sm text-neutral-400">Connect Freighter to use this screen.</p>
      <ProofButton onClick={onConnect} busy={busy}>
        Connect Freighter
      </ProofButton>
    </GlassCard>
  );
}
