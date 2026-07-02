"use client";

import { motion } from "framer-motion";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { WalletBar } from "./WalletBar";
import { cn } from "@/lib/cn";

interface AppShellProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function AppShell({ children, showNav = true }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-void">
      <div className={cn("min-h-dvh flex flex-col", "md:flex-row md:h-dvh md:max-w-[1280px] md:mx-auto md:overflow-hidden")}>
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        <motion.div
          className={cn("flex-1 overflow-y-auto", showNav ? "pb-24 md:pb-0" : "")}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <div className="mx-auto w-full max-w-[430px] md:max-w-2xl">
            <div className="pt-3 md:pt-6">
              <WalletBar />
            </div>
            {children}
          </div>
        </motion.div>
      </div>

      {showNav && <BottomNav />}
    </div>
  );
}
