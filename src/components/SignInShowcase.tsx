import { Check, Crosshair, Lock, PencilRuler, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import { Pill } from "@/components/Bubbles";
import { COMPLETE_NAME, COMPLETE_PRICE, MODULES, type ModuleKey } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

/**
 * Compact product comparison shown under the sign-in card. Mirrors the public
 * landing page hierarchy (three core products, free vs paid) without becoming
 * a second marketing page. Prices come from entitlements constants.
 */

type Tone = "grape" | "flame";

type Product = {
  name: string;
  module: ModuleKey;
  icon: LucideIcon;
  tone: Tone;
  free: string[];
  paid: string[];
};

const PRODUCTS: Product[] = [
  {
    name: "Play Maker + Playbook",
    module: "playbook_plus",
    icon: PencilRuler,
    tone: "grape",
    free: ["Create and animate plays", "Browse the public Play Library", "Coach's Board"],
    paid: [
      "Save Library plays to your team",
      "Unlimited team playbooks and folders",
      "Publish plays",
      "Export MP4 videos",
      "Share organized playbook content with players",
    ],
  },
  {
    name: "Locker Room",
    module: "team_hub_plus",
    icon: UsersRound,
    tone: "flame",
    free: ["Roster", "Player QR / invite onboarding", "Basic schedule", "Basic Locker Room access"],
    paid: [
      "Team chat and announcements",
      "Plans and assignments",
      "Shared play folders and resources",
      "Google Calendar sync",
      "Richer family sharing and engagement tools",
    ],
  },
  {
    name: "Game Day",
    module: "gameday_plus",
    icon: Crosshair,
    tone: "grape",
    free: ["Scoreboard mode", "Team score + period tracking", "No player stats required"],
    paid: [
      "Location-based shot and stat tracking",
      "Individual player stats",
      "Rebounds, assists, turnovers, fouls, free throws",
      "Shot charts",
      "Substitution and lineup tracking",
      "Advanced game history and reports",
    ],
  },
];

const MORE_FREE: { title: string; note?: string }[] = [
  { title: "Drill Maker" },
  {
    title: "Practice Planner",
    note: "CoachSide AI Assistant can suggest practice plans with Complete.",
  },
  { title: "Coach's Board" },
  { title: "Public Play Library" },
  { title: "Roster + player onboarding" },
  { title: "Basic schedule" },
];

const AI_EXAMPLES = [
  "Add schedule from a photo",
  "Add players to roster",
  "Ask what games are next week",
  "Help build a practice plan",
];

const TONE = {
  grape: {
    border: "border-grape/50",
    soft: "bg-grape/10",
    icon: "border-grape/50 bg-grape/20 text-grape-bright",
    dot: "text-grape-bright",
  },
  flame: {
    border: "border-flame/50",
    soft: "bg-flame/10",
    icon: "border-flame/50 bg-flame/20 text-flame",
    dot: "text-flame",
  },
} as const;

function Column({ kind, title, price, items, tone }: { kind: "free" | "paid"; title: string; price: string; items: string[]; tone: Tone }) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl border p-3.5",
        kind === "free" ? "border-border/70 bg-surface-2/50" : cn(t.border, t.soft),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider text-foreground",
            kind === "free" ? "bg-success/20" : "bg-background/60",
          )}
        >
          {kind === "paid" ? <Lock aria-hidden className="h-3.5 w-3.5" /> : null}
          {title}
        </span>
        <span className="rounded-full bg-background/50 px-3 py-1 text-xs font-black text-foreground">{price}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm font-semibold leading-snug text-foreground">
            <Check aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", kind === "free" ? "text-success" : t.dot)} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductBlock({ p }: { p: Product }) {
  const m = MODULES[p.module];
  const t = TONE[p.tone];
  const Icon = p.icon;
  return (
    <section className={cn("flex flex-col gap-3 rounded-3xl border-2 bg-surface/85 p-4 sm:p-5", t.border)}>
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", t.icon)}>
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="rounded-full bg-background/60 px-3 py-1 text-base font-black uppercase tracking-wide text-foreground sm:text-lg">
          {p.name}
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Column kind="free" title="Free" price="$0" items={p.free} tone={p.tone} />
        <Column kind="paid" title={m.name} price={`$${m.price}/month`} items={p.paid} tone={p.tone} />
      </div>
    </section>
  );
}

export function SignInShowcase() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-col items-center gap-2 rounded-3xl border border-border/70 bg-surface/80 px-4 py-4 text-center">
        <h2 className="text-xl font-black leading-tight text-foreground sm:text-2xl">What CoachSide gives your team</h2>
        <p className="rounded-full bg-background/50 px-3 py-1 text-sm font-semibold text-muted-foreground">
          Three core tools. Start free, upgrade only where you need more.
        </p>
      </header>

      {PRODUCTS.map((p) => (
        <ProductBlock key={p.module} p={p} />
      ))}

      <section className="flex flex-col gap-3 rounded-3xl border-2 border-success/30 bg-surface/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="success">Free</Pill>
          <h3 className="rounded-full bg-background/60 px-3 py-1 text-base font-black text-foreground">More free tools</h3>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MORE_FREE.map((tool) => (
            <li key={tool.title} className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-surface-2/50 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Check aria-hidden className="h-4 w-4 shrink-0 text-success" />
                {tool.title}
              </span>
              {tool.note ? (
                <span className="rounded-xl bg-background/50 px-2.5 py-1.5 text-xs font-semibold leading-snug text-muted-foreground">
                  {tool.note}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border-2 border-flame/60 bg-gradient-to-br from-grape/15 to-flame/15 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="rounded-full bg-background/60 px-3 py-1 text-base font-black text-foreground sm:text-lg">{COMPLETE_NAME}</h3>
          <span className="rounded-full bg-flame px-3 py-1 text-sm font-black text-accent-foreground">${COMPLETE_PRICE}/month</span>
        </div>
        <p className="rounded-2xl bg-background/50 px-3 py-2 text-sm font-semibold leading-relaxed text-foreground">
          All 3 paid modules + the CoachSide AI Assistant.
        </p>
        <div className="flex flex-col gap-2 rounded-2xl border border-grape/40 bg-background/40 p-3">
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-grape/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-foreground">
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            AI Assistant · Included
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {AI_EXAMPLES.map((ex) => (
              <li key={ex} className="rounded-full border border-border/60 bg-surface-2/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                {ex}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-2 rounded-3xl border border-border/70 bg-surface/80 px-4 py-3">
        <Pill tone="flame">Start Free</Pill>
        <Pill tone="success">No credit card required</Pill>
        <Pill tone="muted">Paid features only unlock when selected</Pill>
      </div>
    </div>
  );
}
