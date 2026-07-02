"use client";

import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import { cn } from "@/lib/cn";

interface NumericKeypadProps {
  value: string;
  onChange: (val: string) => void;
  maxDecimals?: number;
  className?: string;
  unit?: string;
  maxValue?: string;
  onMax?: () => void;
  error?: string;
  disabled?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export function NumericKeypad({
  value,
  onChange,
  maxDecimals = 7,
  className,
  unit,
  maxValue,
  onMax,
  error,
  disabled = false,
}: NumericKeypadProps) {
  function press(key: string) {
    if (key === "⌫") {
      onChange(value.slice(0, -1) || "");
      return;
    }
    let nextVal = value;
    if (key === ".") {
      if (value.includes(".")) return;
      nextVal = (value || "0") + ".";
    } else if (value === "0" && key !== ".") {
      nextVal = key;
    } else {
      const [, frac] = value.split(".");
      if (frac !== undefined && frac.length >= maxDecimals) return;
      nextVal = value + key;
    }

    if (maxValue !== undefined) {
      const parsedNext = parseFloat(nextVal);
      const parsedMax = parseFloat(maxValue);
      if (!isNaN(parsedNext) && !isNaN(parsedMax) && parsedNext > parsedMax) {
        return;
      }
    }

    onChange(nextVal);
  }

  const display = value || "0";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col items-center gap-1 py-2">
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-display text-5xl font-bold tabular-nums tracking-tight text-text-primary">
            {display}
          </span>
          <motion.span
            aria-hidden
            className="h-9 w-[3px] bg-accent"
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
          />
          {unit && <span className="font-mono text-base text-text-muted">{unit}</span>}
        </div>

        <div className="flex h-5 items-center gap-2">
          {error ? (
            <span className="font-mono text-xs text-error">{error}</span>
          ) : maxValue !== undefined ? (
            <>
              <span className="font-mono text-xs text-text-muted">
                Max {maxValue} {unit}
              </span>
              {onMax && (
                <button
                  onClick={onMax}
                  className="text-xs font-medium text-accent underline-offset-2 transition-colors hover:text-accent-hover hover:underline"
                >
                  Use max
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className={cn("grid grid-cols-3 gap-2", disabled && "pointer-events-none opacity-30")}>
        {KEYS.map((key) => (
          <motion.button
            key={key}
            whileTap={disabled ? undefined : { scale: 0.95 }}
            onClick={() => !disabled && press(key)}
            className={cn(
              "flex h-16 select-none items-center justify-center rounded-2xl bg-card font-display text-2xl font-semibold text-text-primary transition-colors duration-100",
              !disabled && "hover:bg-card-hover active:scale-95",
            )}
          >
            {key === "⌫" ? <Delete className="h-5 w-5 text-text-secondary" /> : key}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
