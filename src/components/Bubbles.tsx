import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

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

export function SectionHeader({
  title,
  subtitle,
  tone = "grape",
  as = "h2",
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  tone?: "grape" | "flame" | "neutral";
  as?: "h1" | "h2" | "h3";
  className?: string;
  children?: ReactNode;
}) {
  const Title = as;
  const tones = {
    grape: "border-grape/50 bg-grape/15",
    flame: "border-flame/50 bg-flame/15",
    neutral: "border-border/70 bg-surface/80",
  } as const;
  return (
    <div className={cn("flex w-full flex-col items-center gap-2 rounded-3xl border px-4 py-4 text-center", tones[tone], className)}>
      <Title className="text-2xl font-black leading-tight text-foreground sm:text-3xl">{title}</Title>
      {subtitle ? <p className="max-w-2xl text-sm font-semibold leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p> : null}
      {children}
    </div>
  );
}

export function InfoPanel({
  children,
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: "neutral" | "grape" | "flame" | "danger" }) {
  const tones = {
    neutral: "border-border/70 bg-surface-2/60",
    grape: "border-grape/45 bg-grape/10",
    flame: "border-flame/45 bg-flame/10",
    danger: "border-destructive/50 bg-destructive/10",
  } as const;
  return (
    <div className={cn("w-full rounded-2xl border p-4 text-left text-sm font-semibold leading-relaxed text-foreground", tones[tone], className)} {...rest}>
      {children}
    </div>
  );
}

export function InfoList({
  items,
  tone = "neutral",
  className,
}: {
  items: ReactNode[];
  tone?: "neutral" | "grape" | "flame";
  className?: string;
}) {
  return (
    <InfoPanel tone={tone} className={className}>
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-flame" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </InfoPanel>
  );
}

export function PrimaryCTA({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex w-full flex-wrap items-center justify-center gap-2 text-center", className)}>{children}</div>;
}

/**
 * Class for a card whose WHOLE area is one action (wrap a Link or button with
 * it). Informational surfaces use `Panel` and must never carry hover states,
 * so a coach can tell at a glance what is tappable.
 */
export const actionCardCls =
  "block w-full rounded-3xl border border-border/70 bg-surface/80 p-3 text-left shadow-lg shadow-black/30 transition-all hover:border-grape/70 hover:bg-surface-2/70 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape";

export function Pill({
  className,
  tone = "neutral",
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "grape" | "flame" | "muted" | "success" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-2 text-foreground border-border",
    grape: "bg-grape/20 text-foreground border-grape/60",
    flame: "bg-flame/20 text-foreground border-flame/60",
    muted: "bg-surface-2/60 text-muted-foreground border-border/60",
    success: "bg-chart-4/20 text-foreground border-chart-4/60",
    danger: "bg-destructive/20 text-foreground border-destructive/60",
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
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border text-center font-bold tracking-wide shadow-lg shadow-black/20 transition-all active:scale-95 disabled:opacity-40",
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
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
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
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-black leading-none text-foreground sm:text-2xl">{value}</div>
      {hint ? (
        <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

/** Big heading bubble (page titles inside cards). */
export function Heading({
  children,
  tone = "grape",
  className,
}: {
  children: ReactNode;
  tone?: "grape" | "flame" | "neutral";
  className?: string;
}) {
  const tones = {
    grape: "border-grape/60 bg-grape/20",
    flame: "border-flame/60 bg-flame/20",
    neutral: "border-border bg-surface-2/80",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-2xl border px-4 py-2 text-xl font-black leading-tight text-foreground sm:text-2xl",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Helper / body copy always sits on a surface. */
export function Note({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "grape" | "flame" | "danger";
  className?: string;
}) {
  const tones = {
    muted: "border-border/60 bg-surface-2/70 text-muted-foreground",
    grape: "border-grape/50 bg-grape/15 text-foreground",
    flame: "border-flame/50 bg-flame/15 text-foreground",
    danger: "border-destructive/50 bg-destructive/15 text-foreground",
  } as const;
  return (
    <p
      className={cn(
        "inline-flex w-fit max-w-full rounded-2xl border px-3 py-2 text-xs font-semibold leading-relaxed",
        tones[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-2.5 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-grape disabled:opacity-60";

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...rest} />;
}

export function SelectInput({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, "appearance-none", className)} {...rest}>
      {children}
    </select>
  );
}

/** Labelled form row: label pill above an input. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Empty / loading state that still lives inside a bubble. */
export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl border border-dashed border-border/70 bg-surface-2/40 px-4 py-6",
        className,
      )}
    >
      <p className="text-center text-sm font-semibold leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
