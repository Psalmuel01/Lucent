"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Circle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type TxStepStatus = "pending" | "active" | "done" | "error";

export interface TxStep {
  id: string;
  label: string;
  status: TxStepStatus;
  /** Estimated seconds for a proof-generating step — rendered as "(~Ns)". */
  estSeconds?: number;
}

interface TxStatusProps {
  steps: TxStep[];
  className?: string;
}

export function TxStatus({ steps, className }: TxStatusProps) {
  return (
    <motion.div
      className={cn("flex flex-col gap-3", className)}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {steps.map((step) => (
        <motion.div
          key={step.id}
          variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
          className="flex items-center gap-3"
        >
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
            <AnimatePresence mode="wait">
              {step.status === "done" && (
                <motion.div
                  key="done"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-success/10 text-success"
                >
                  <Check className="h-4 w-4" />
                </motion.div>
              )}
              {step.status === "active" && (
                <motion.div
                  key="active"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent"
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
                  <Loader2 className="relative h-4 w-4 animate-spin" />
                </motion.div>
              )}
              {step.status === "pending" && (
                <motion.div
                  key="pending"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-text-muted"
                >
                  <Circle className="h-3.5 w-3.5" />
                </motion.div>
              )}
              {step.status === "error" && (
                <motion.div
                  key="error"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-error/10 text-error"
                >
                  <X className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <span
            className={cn(
              "text-sm transition-colors duration-200",
              step.status === "done" && "text-text-secondary line-through",
              step.status === "active" && "font-medium text-text-primary",
              step.status === "pending" && "text-text-muted",
              step.status === "error" && "text-error",
            )}
          >
            {step.label}
            {step.estSeconds ? (
              <span className="text-text-muted"> (~{step.estSeconds}s)</span>
            ) : null}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}
