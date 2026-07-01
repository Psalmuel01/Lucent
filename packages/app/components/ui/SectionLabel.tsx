import { cn } from "@/lib/cn";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-text-muted">
        {children}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
