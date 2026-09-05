import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/**
 * Shared "everything lives inside a surface" primitives.
 * No text in this product is ever placed directly on the page background.
 */

export function Panel({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border/70 bg-surface/80 p-3 shadow-lg shadow-black/30 backdrop-blur",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Pill({
  className,
  tone = "neutral",
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "grape" | "flame" | "muted" }) {
  const tones = {
    neutral: "bg-surface-2 text-foreground border-border",
    grape: "bg-grape/20 text-foreground border-grape/60",
    flame: "bg-flame/20 text-foreground border-flame/60",
    muted: "bg-surface-2/60 text-muted-foreground border-border/60",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

type BubbleTone = "grape" | "flame" | "neutral" | "danger" | "ghost";

export function BubbleButton({
  className,
  tone = "neutral",
  size = "md",
  children,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: BubbleTone;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}) {
  const tones: Record<BubbleTone, string> = {
    grape:
      "bg-grape text-primary-foreground border-grape hover:bg-grape/90 shadow-grape/30",
    flame: "bg-flame text-accent-foreground border-flame hover:bg-flame/90 shadow-flame/30",
    neutral: "bg-surface-2 text-foreground border-border hover:border-grape/70",
    danger: "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90",
    ghost: "bg-surface/70 text-muted-foreground border-border/70 hover:text-foreground",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
  } as const;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border font-bold tracking-wide shadow-lg shadow-black/20 transition-all active:scale-95 disabled:opacity-40",
        tones[tone],
        sizes[size],
        active && "ring-2 ring-flame ring-offset-2 ring-offset-background",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full bg-surface-2/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "grape" | "flame";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-2/80 border-border",
    grape: "bg-grape/20 border-grape/50",
    flame: "bg-flame/15 border-flame/50",
  } as const;
  return (
    <div className={cn("rounded-2xl border px-3 py-2 text-center", tones[tone], className)}>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-black leading-tight text-foreground">{value}</div>
    </div>
  );
}
