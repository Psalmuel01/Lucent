import { cn } from "@/lib/cn";

export type PillTone = "neutral" | "amber" | "green" | "red" | "sky" | "violet";

const TONE: Record<PillTone, string> = {
  neutral: "bg-white/10 text-text-secondary",
  amber: "bg-accent-bg text-accent",
  green: "bg-success/10 text-success",
  red: "bg-error/10 text-error",
  sky: "bg-sky-500/10 text-sky-400",
  violet: "bg-encrypted-bg text-encrypted",
};

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: PillTone }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", TONE[tone])}>{children}</span>;
}
