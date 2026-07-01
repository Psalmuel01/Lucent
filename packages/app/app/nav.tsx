"use client";

/**
 * Lucent product nav — brand mark, the six product screens, and live wallet /
 * sync status. Replaces the demo's persona chooser.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useWallet } from "@/lib/wallet-context";
import { LockGlyph, Pill, cn } from "@/lib/ui";

export const SCREENS = [
  { href: "/shield", label: "Shield" },
  { href: "/send", label: "Send" },
  { href: "/payroll", label: "Payroll" },
  { href: "/escrow", label: "Escrow" },
  { href: "/auditor", label: "Auditor" },
  { href: "/prove", label: "Prove" },
] as const;

export function ProductNav() {
  const pathname = usePathname();
  const { view, connecting, connect, lastSync } = useWallet();

  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-2 px-5 py-3">
        <Link href="/" className="mr-2 flex items-center gap-2">
          <LockGlyph className="h-6 w-6 text-amber-400" />
          <span className="text-sm font-semibold tracking-tight text-neutral-100">Lucent</span>
        </Link>

        <div className="flex flex-wrap items-center gap-1">
          {SCREENS.map((s) => {
            const active = pathname.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-amber-400/15 text-amber-300"
                    : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </div>

        <span className="flex-1" />

        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="hidden text-[11px] text-neutral-500 sm:inline" title="Last local sync">
              synced {lastSync.toLocaleTimeString()}
            </span>
          )}
          {view && view.matchesChain !== null && (
            <Pill tone={view.matchesChain ? "green" : "red"}>
              {view.matchesChain ? "matches chain ✓" : "mismatch ✗"}
            </Pill>
          )}
          {view ? (
            <Pill tone="amber">{`${view.address.slice(0, 4)}…${view.address.slice(-4)}`}</Pill>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
