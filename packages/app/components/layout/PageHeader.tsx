"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, showBack = true, onBack, right, className }: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className={cn("flex items-center gap-3 px-4 pt-14 pb-4 md:px-8 md:pt-8", className)}>
      {showBack && (
        <button
          onClick={() => (onBack ? onBack() : router.back())}
          aria-label="Go back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <h1 className="flex-1 font-display text-lg font-semibold tracking-tight text-text-primary">{title}</h1>
      {right}
    </header>
  );
}
