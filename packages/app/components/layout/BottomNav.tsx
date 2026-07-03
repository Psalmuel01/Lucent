"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import {
  LayoutDashboard,
  ArrowDownUp,
  Send,
  Briefcase,
  MoreHorizontal,
  Lock,
  ScanLine,
  ScanEye,
  Settings,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

const PRIMARY_TABS = [
  { href: "/home", icon: LayoutDashboard, label: "Home" },
  { href: "/shield", icon: ArrowDownUp, label: "Shield" },
  { href: "/send", icon: Send, label: "Send" },
  { href: "/payroll", icon: Briefcase, label: "Payroll" },
];

const MORE_ITEMS = [
  { href: "/escrow", icon: Lock, label: "Escrow", desc: "Private escrows with optional arbitration" },
  { href: "/prove", icon: ScanLine, label: "Prove", desc: "Selective disclosure for transfers" },
  { href: "/auditor", icon: ScanEye, label: "Auditor", desc: "Decrypt all transaction amounts" },
  { href: "/profile", icon: Settings, label: "Profile", desc: "Wallet settings and key info" },
];

const MORE_ROUTES = MORE_ITEMS.map((i) => i.href);

export function BottomNav() {
  const pathname = usePathname();
  const { wallet, disconnect } = useWallet();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = MORE_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around
                   border-t border-border bg-[rgba(9,9,11,0.92)] pb-safe pt-2
                   backdrop-blur-2xl md:hidden"
      >
        {PRIMARY_TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} aria-label={label} className="flex min-w-[48px] flex-col items-center gap-1 px-3 py-1.5">
              <motion.div whileTap={{ scale: 0.85 }}>
                <Icon className={cn("h-[22px] w-[22px]", active ? "text-accent" : "text-text-muted")} strokeWidth={active ? 2.2 : 1.8} />
              </motion.div>
              {active && <motion.span layoutId="nav-dot" className="h-1 w-1 rounded-full bg-accent" />}
            </Link>
          );
        })}

        {/* More button */}
        <button onClick={() => setMoreOpen(true)} aria-label="More" className="flex min-w-[48px] flex-col items-center gap-1 px-3 py-1.5">
          <motion.div whileTap={{ scale: 0.85 }}>
            <MoreHorizontal className={cn("h-[22px] w-[22px]", moreActive ? "text-accent" : "text-text-muted")} strokeWidth={moreActive ? 2.2 : 1.8} />
          </motion.div>
          {moreActive && <motion.span layoutId="nav-dot" className="h-1 w-1 rounded-full bg-accent" />}
        </button>
      </nav>

      {/* More bottom sheet */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-border bg-surface pb-safe md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              {/* Handle */}
              <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-border" />

              {/* Wallet info if connected */}
              {wallet && (
                <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <LucentLogoMark size={28} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-xs font-medium text-text-primary">Connected</span>
                    <span className="truncate font-mono text-[11px] text-text-muted">{shortAddress(wallet.address, 6)}</span>
                  </div>
                </div>
              )}

              {/* More nav items */}
              <div className="flex flex-col gap-0.5 px-4 pb-2">
                {MORE_ITEMS.map(({ href, icon: Icon, label, desc }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors",
                        active ? "bg-accent-bg text-accent" : "text-text-primary hover:bg-white/[0.04] active:bg-white/[0.06]",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                          active ? "border-accent/30 bg-accent-bg" : "border-border bg-card",
                        )}
                      >
                        <Icon className={cn("h-[18px] w-[18px]", active ? "text-accent" : "text-text-secondary")} strokeWidth={active ? 2.2 : 1.8} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="mb-0.5 text-sm font-medium leading-none">{label}</span>
                        <span className="text-xs leading-snug text-text-muted">{desc}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                    </Link>
                  );
                })}
              </div>

              {/* Disconnect */}
              {wallet && (
                <div className="mx-4 mb-4 mt-2">
                  <button
                    onClick={() => {
                      disconnect();
                      setMoreOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-error/80 transition-colors hover:bg-error/[0.07]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-error/20 bg-error/[0.07]">
                      <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </div>
                    <span className="text-sm font-medium">Disconnect</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
