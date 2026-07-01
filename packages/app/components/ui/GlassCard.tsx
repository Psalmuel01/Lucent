"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  hover?: boolean;
  glow?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children?: ReactNode;
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ hover = false, glow = false, padding = "md", className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={hover ? { y: -2 } : undefined}
        transition={{ duration: 0.15 }}
        className={cn(
          "glass-card relative overflow-hidden group",
          paddings[padding],
          glow && "shadow-[0_0_30px_rgba(251,187,36,0.12)]",
          hover && "cursor-pointer",
          className,
        )}
        {...props}
      >
        {hover && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:animate-shimmer group-hover:opacity-100"
          />
        )}
        {children}
      </motion.div>
    );
  },
);
GlassCard.displayName = "GlassCard";
