import { AlertTriangle, KeyRound } from "lucide-react";

export function Callout({
  tone = "warning",
  children,
}: {
  tone?: "warning" | "key";
  children: React.ReactNode;
}) {
  const Icon = tone === "key" ? KeyRound : AlertTriangle;
  return (
    <div
      className={`mb-0 flex items-start gap-2.5 rounded-2xl border px-4 py-3.5 ${
        tone === "key" ? "border-accent/25 bg-accent/[0.06]" : "border-warning/25 bg-warning/[0.08]"
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "key" ? "text-accent" : "text-warning"}`} />
      <div className={`text-[13.5px] leading-relaxed ${tone === "key" ? "text-accent/90" : "text-warning/85"}`}>
        {children}
      </div>
    </div>
  );
}
