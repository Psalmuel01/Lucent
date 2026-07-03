"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowDownUp, Send, Briefcase, Lock, ScanEye, ScanLine, Settings, LogOut } from "lucide-react";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/home", icon: LayoutDashboard, label: "Home" },
  { href: "/shield", icon: ArrowDownUp, label: "Shield" },
  { href: "/send", icon: Send, label: "Send" },
  { href: "/payroll", icon: Briefcase, label: "Payroll" },
  { href: "/escrow", icon: Lock, label: "Escrow" },
  { href: "/auditor", icon: ScanEye, label: "Auditor" },
  { href: "/verify", icon: ScanLine, label: "Verify" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { wallet, disconnect } = useWallet();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border">
      <Link
        href="/"
        className="flex items-center gap-2.5 border-b border-border px-5 py-5 transition-opacity hover:opacity-75"
      >
        <LucentLogoMark size={22} />
        <span className="font-display text-base font-semibold tracking-tight text-text-primary">Lucent</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150",
                active ? "bg-accent-bg text-accent" : "text-text-muted hover:bg-white/[0.04] hover:text-text-secondary",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-3 py-4">
        {wallet && (
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150",
              pathname === "/profile" ? "bg-accent-bg text-accent" : "text-text-muted hover:bg-white/[0.04] hover:text-text-secondary",
            )}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium leading-none">Profile</span>
              <span className="mt-0.5 truncate font-mono text-[11px] text-text-muted">
                {shortAddress(wallet.address, 5)}
              </span>
            </div>
          </Link>
        )}
        {wallet && (
          <button
            onClick={disconnect}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-text-muted transition-all duration-150 hover:bg-error/[0.07] hover:text-error/80"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <span className="text-sm font-medium">Disconnect</span>
          </button>
        )}
      </div>
    </aside>
  );
}
