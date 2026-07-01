"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

interface ProofLoadingOverlayProps {
  open: boolean;
  /** Estimated proof-generation time in seconds — drives the progress-bar fill. */
  estSeconds?: number;
  message?: string;
  /** Render as a fixed full-screen overlay instead of an inline card. */
  fullScreen?: boolean;
  className?: string;
}

export function ProofLoadingOverlay({
  open,
  estSeconds = 15,
  message,
  fullScreen = false,
  className,
}: ProofLoadingOverlayProps) {
  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "glass-card flex flex-col items-center gap-4 px-6 py-10 text-center",
        fullScreen && "w-full max-w-xs",
        className,
      )}
    >
      <motion.div
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-encrypted-bg text-encrypted"
      >
        <Lock className="h-8 w-8" strokeWidth={1.5} />
      </motion.div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-base font-semibold text-text-primary">
          Generating zero-knowledge proof
        </h3>
        <p className="max-w-[26ch] text-xs leading-relaxed text-text-muted">
          {message ?? `This runs entirely in your browser and takes about ${estSeconds} seconds. Don't close this tab.`}
        </p>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-card">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: "0%" }}
          animate={{ width: "92%" }}
          transition={{ duration: estSeconds, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {open &&
        (fullScreen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          >
            {content}
          </motion.div>
        ) : (
          content
        ))}
    </AnimatePresence>
  );
}
