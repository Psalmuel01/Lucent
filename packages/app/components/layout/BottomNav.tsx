"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownUp, Send, Briefcase, Lock, UserCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/shield", icon: ArrowDownUp, label: "Shield" },
  { href: "/send", icon: Send, label: "Send" },
  { href: "/payroll", icon: Briefcase, label: "Payroll" },
  { href: "/escrow", icon: Lock, label: "Escrow" },
  { href: "/profile", icon: UserCircle, label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 md:hidden">
      <div
        className="flex items-center justify-around px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        style={{
          background: "rgba(9,9,11,0.90)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="relative flex min-w-[56px] flex-col items-center gap-1 px-4 py-2"
            >
              <motion.span whileTap={{ scale: 0.85 }} className="flex">
                <Icon className={cn("h-5 w-5 transition-colors duration-200", active ? "text-accent" : "text-text-muted")} strokeWidth={active ? 2.4 : 1.8} />
              </motion.span>
              <AnimatePresence>
                {active && (
                  <motion.span
                    layoutId="lucent-nav-dot"
                    className="mt-1 h-1 w-1 rounded-full bg-accent"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
