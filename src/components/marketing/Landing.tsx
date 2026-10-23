import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Crosshair,
  Dumbbell,
  FolderOpen,
  LibraryBig,
  ListChecks,
  Lock,
  MessageSquareText,
  PencilRuler,
  Presentation,
  QrCode,
  Sparkles,
  Timer,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { trackAnon, type AnonEvent } from "@/lib/funnel";
import { SocialCTA } from "@/components/SocialCTA";
import { Panel, Pill } from "@/components/Bubbles";
import { DemoPlay } from "@/components/marketing/DemoPlay";
import { InstallAppPill } from "@/components/InstallApp";
import { COMPLETE_NAME, COMPLETE_PRICE, MODULES, type ModuleKey } from "@/lib/entitlements";
import { cn } from "@/lib/utils";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";
import mark from "@/assets/coachside-mark.jpg.asset.json";
import shotChart from "@/assets/snapshot-shot-chart.jpg";
import teamStats from "@/assets/snapshot-team-stats.jpg";
import leaders from "@/assets/snapshot-leaders.jpg";

/* ------------------------------------------------------------------ */
/* Links styled as buttons (no button-inside-link nesting).           */
/* ------------------------------------------------------------------ */

type CtaTone = "flame" | "grape" | "neutral" | "ghost";
const CTA_TONE: Record<CtaTone, string> = {
  flame: "bg-flame text-accent-foreground border-flame hover:bg-flame/90 shadow-flame/30",
  grape: "bg-grape text-primary-foreground border-grape hover:bg-grape/90 shadow-grape/30",
  neutral: "bg-surface-2 text-foreground border-border hover:border-grape/70",
  ghost: "bg-surface/70 text-muted-foreground border-border/70 hover:text-foreground",
};
const CTA_SIZE = {
  sm: "min-h-10 px-3.5 py-1.5 text-xs",
  md: "min-h-12 px-5 py-2.5 text-sm",
  lg: "min-h-14 px-6 py-3 text-base",
} as const;
function ctaCls(tone: CtaTone, size: keyof typeof CTA_SIZE = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full border text-center font-bold tracking-wide shadow-lg shadow-background/40 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape",
    CTA_TONE[tone],
    CTA_SIZE[size],
    className,
  );
}

const track = (e: AnonEvent) => () => void trackAnon(e);

/** Sign up, then continue straight to `next` (preserved through auth). */
function SignupCta({
  next,
  event,
  tone = "flame",
  size = "md",
  className,
  children,
}: {
  next?: string;
  event: AnonEvent;
  tone?: CtaTone;
  size?: keyof typeof CTA_SIZE;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="/auth"
      search={next ? { mode: "signup", next } : { mode: "signup" }}
      onClick={track(event)}
      className={ctaCls(tone, size, className)}
    >
      {children}
    </Link>
  );
}

function ExplorePlays({ size = "lg", tone = "neutral", className }: { size?: keyof typeof CTA_SIZE; tone?: CtaTone; className?: string }) {
  return (
    <Link to="/library" onClick={track("landing_explore_plays")} className={ctaCls(tone, size, className)}>
      Explore Plays
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* The three primary products.                                        */
/* ------------------------------------------------------------------ */

type Tone = "grape" | "flame";

type Product = {
  id: string;
  module: ModuleKey;
  tone: Tone;
  icon: LucideIcon;
  name: string;
  tagline: string;
  tileFree: string;
  tilePaid: string;
  heading: string;
  lead: string;
  free: string[];
  paid: string[];
};

const PRODUCTS: Product[] = [
  {
    id: "playmaker",
    module: "playbook_plus",
    tone: "grape",
    icon: PencilRuler,
    name: "Play Maker + Playbook",
    tagline: "Draw animated basketball plays and keep your team's playbook in one place.",
    tileFree: "Create and animate plays",
    tilePaid: "Save, organize and export your team playbook",
    heading: "Build plays. Organize your playbook.",
    lead: "Draw a play, sequence every action and watch it run before your players ever see it.",
    free: [
      "Create plays in the Play Maker",
      "Draw cuts, screens, passes, dribbles and handoffs",
      "Run animated sequences",
      "Browse the public CoachSide Play Library",
    ],
    paid: [
      "Save CoachSide Library plays to your team",
      "Unlimited saved and custom team plays",
      "Organize plays into team folders",
      "Publish plays to the Library",
      "Export plays as MP4 video",
      "Share organized playbook content with your players",
    ],
  },
  {
    id: "lockerroom",
    module: "team_hub_plus",
    tone: "flame",
    icon: UsersRound,
    name: "Locker Room",
    tagline: "Your team's own space: roster, schedule and everything players need.",
    tileFree: "Roster, player invites and a basic team space",
    tilePaid: "Chat, plans, resources and calendar sync",
    heading: "Run your team from the Locker Room.",
    lead: "Players scan one code and land in a simple team space built around your roster.",
    free: [
      "Create your roster",
      "Player QR and invite-link onboarding",
      "Basic team schedule viewing",
      "Basic Locker Room access",
      "Players see their team and core information",
    ],
    paid: [
      "Team chat and announcements",
      "Plans and assignments",
      "Shared play folders",
      "Resources",
      "Google Calendar sync",
      "Richer parent and family sharing",
      "Player engagement and read-status tools where supported",
    ],
  },
  {
    id: "gameday",
    module: "gameday_plus",
    tone: "grape",
    icon: Crosshair,
    name: "GameDay Stats",
    tagline: "Run the scoreboard free, or track every shot from the court.",
    tileFree: "Scoreboard with score and periods",
    tilePaid: "Tap-the-court player stats and shot charts",
    heading: "Track the game from the court.",
    lead: "Tap where it happened, tap the player, tap the stat. The court never leaves the screen.",
    free: [
      "Game scoreboard",
      "Period and quarter tracking",
      "Team score only",
      "Team fouls and an optional game clock",
      "No individual player stats required",
    ],
    paid: [
      "Tap-the-court location stat tracking",
      "Individual player stats",
      "Made and missed shots",
      "Rebounds, assists and steals",
      "Turnovers, fouls and free throws",
      "Shot charts",
      "Substitution and lineup tracking",
      "Advanced game history and reports",
    ],
  },
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

function ProductTile({ p }: { p: Product }) {
  const m = MODULES[p.module];
  const t = TONE[p.tone];
  const Icon = p.icon;
  return (
    <a
      href={`#${p.id}`}
      className={cn(
        "group flex flex-col gap-4 rounded-3xl border-2 bg-surface/90 p-5 shadow-lg shadow-background/40 transition-colors hover:bg-surface-2/80",
        t.border,
      )}
    >
      <span aria-hidden className={cn("inline-flex h-14 w-14 items-center justify-center rounded-2xl border", t.icon)}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="text-xl font-black uppercase leading-tight tracking-wide text-foreground">{p.name}</span>
        <span className="text-sm font-semibold leading-relaxed text-muted-foreground">{p.tagline}</span>
      </span>
      <span className="mt-auto flex flex-col overflow-hidden rounded-2xl border border-border/70">
        <span className="flex items-start gap-3 bg-surface-2/60 px-3 py-2.5">
          <span className="w-14 shrink-0 rounded-full bg-success/20 px-2 py-0.5 text-center text-[11px] font-black text-foreground">FREE</span>
          <span className="text-sm font-bold text-foreground">{p.tileFree}</span>
        </span>
        <span className={cn("flex items-start gap-3 border-t border-border/70 px-3 py-2.5", t.soft)}>
          <span className="w-14 shrink-0 rounded-full bg-background/60 px-2 py-0.5 text-center text-[11px] font-black text-foreground">${m.price}/mo</span>
          <span className="text-sm font-bold text-foreground">
            {m.name}: {p.tilePaid}
          </span>
        </span>
      </span>
      <span className="self-start rounded-full bg-background/50 px-3 py-1 text-xs font-bold text-muted-foreground group-hover:text-foreground">
        Free vs paid ↓
      </span>
    </a>
  );
}

function CompareColumn({
  kind,
  title,
  price,
  items,
  tone,
}: {
  kind: "free" | "paid";
  title: string;
  price: string;
  items: string[];
  tone: Tone;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4",
        kind === "free" ? "border-border/70 bg-surface-2/50" : cn(t.border, t.soft),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider",
            kind === "free" ? "bg-success/20 text-foreground" : "bg-background/60 text-foreground",
          )}
        >
          {kind === "paid" ? <Lock aria-hidden className="h-3.5 w-3.5" /> : null}
          {title}
        </span>
        <span className="rounded-full bg-background/50 px-3 py-1 text-sm font-black text-foreground">{price}</span>
      </div>
      <ul className="flex flex-col gap-2">
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

function ProductSection({
  p,
  index,
  cta,
  visual,
  reverse,
}: {
  p: Product;
  index: number;
  cta: ReactNode;
  visual: ReactNode;
  reverse?: boolean;
}) {
  const m = MODULES[p.module];
  const t = TONE[p.tone];
  const Icon = p.icon;
  return (
    <section
      id={p.id}
      aria-labelledby={`${p.id}-title`}
      className={cn("scroll-mt-20 rounded-[2rem] border-2 bg-surface/80 p-5 shadow-xl shadow-background/40 sm:p-8", t.border)}
    >
      <div className={cn("grid items-start gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8", reverse && "lg:[&>*:first-child]:order-2")}>
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl border", t.icon)}>
              <Icon className="h-5 w-5" />
            </span>
            <Pill tone={p.tone}>
              {String(index).padStart(2, "0")} · {p.name}
            </Pill>
          </div>
          <div className="flex flex-col gap-2">
            <h2 id={`${p.id}-title`} className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
              {p.heading}
            </h2>
            <p className="text-base font-semibold leading-relaxed text-muted-foreground sm:text-lg">{p.lead}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompareColumn kind="free" title="Free" price="$0" items={p.free} tone={p.tone} />
            <CompareColumn kind="paid" title={m.name} price={`$${m.price}/month`} items={p.paid} tone={p.tone} />
          </div>
          <div>{cta}</div>
        </div>
        <div className="min-w-0">{visual}</div>
      </div>
    </section>
  );
}

function Shot({ src, alt, caption, className, imgClassName = "aspect-[4/5]" }: { src: string; alt: string; caption: string; className?: string; imgClassName?: string }) {
  return (
    <figure className={cn("flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-surface-2/60 p-1.5", className)}>
      <img src={src} alt={alt} loading="lazy" className={cn("w-full rounded-xl object-cover object-top", imgClassName)} />
      <figcaption className="self-center rounded-full bg-background/60 px-3 py-0.5 text-[11px] font-bold text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

/** Generic, illustrative Locker Room preview — no real team data. */
function LockerPreview() {
  const rows: { label: string; note: string; icon: LucideIcon; paid: boolean }[] = [
    { label: "Roster", note: "12 players joined", icon: UsersRound, paid: false },
    { label: "Schedule", note: "Thu · Practice 4:30 PM", icon: CalendarDays, paid: false },
    { label: "Team Chat", note: "Coach: Film at 3:45 tomorrow", icon: MessageSquareText, paid: true },
    { label: "Plans", note: "Review Horns Flex before Friday", icon: ListChecks, paid: true },
    { label: "Playbook", note: "Shared folder · Press Break", icon: FolderOpen, paid: true },
  ];
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-2 rounded-[2rem] border-2 border-flame/40 bg-background/70 p-3 shadow-xl shadow-background/50">
      <div className="flex items-center justify-between rounded-2xl bg-surface-2/80 px-3 py-2">
        <span className="text-sm font-black text-foreground">East High · Locker Room</span>
        <span className="rounded-full bg-flame/20 px-2 py-0.5 text-[10px] font-black uppercase text-foreground">Preview</span>
      </div>
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <div key={r.label} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/80 px-3 py-2.5">
            <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-flame/40 bg-flame/15 text-flame">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-black text-foreground">{r.label}</span>
              <span className="truncate text-xs font-semibold text-muted-foreground">{r.note}</span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                r.paid ? "bg-flame/20 text-foreground" : "bg-success/20 text-foreground",
              )}
            >
              {r.paid ? MODULES.team_hub_plus.name : "Free"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* More free tools — one section, simple rows.                        */
/* ------------------------------------------------------------------ */

const FREE_TOOLS: { title: string; body: string; note?: string; icon: LucideIcon }[] = [
  { title: "Coach's Board", body: "Draw up plays quickly during practice, timeouts or meetings.", icon: Presentation },
  {
    title: "Scoreboard Mode",
    body: "Run a game with score and period tracking, no individual player stats needed.",
    note: `Player and location stats are available with ${MODULES.gameday_plus.name}.`,
    icon: Timer,
  },
  { title: "Drill Maker", body: "Build and save basketball drills visually.", icon: Dumbbell },
  {
    title: "Practice Planner",
    body: "Organize your drills into practice plans.",
    note: `CoachSide AI Assistant can help build practice plans with Complete when AI access is active.`,
    icon: ClipboardList,
  },
  { title: "Roster + Player Onboarding", body: "Create teams and rosters, then invite players with a QR code or link.", icon: QrCode },
  { title: "Public Play Library", body: "Browse basketball plays from CoachSide and other coaches.", icon: LibraryBig },
  { title: "Basic Schedule", body: "View games and practices for your team.", icon: CalendarDays },
];

/* ------------------------------------------------------------------ */
/* Pricing comparison — names and prices come from entitlements.ts.   */
/* ------------------------------------------------------------------ */

const AI_EXAMPLES = [
  "Add this schedule from a photo",
  "Add players to my roster",
  "What games are next week?",
  "Help build a practice plan",
];

type Tier = { name: string; price: number; summary: string; tone: "free" | Tone; highlight?: boolean };

const TIERS: Tier[] = [
  {
    name: "Free Core",
    price: 0,
    summary: "Play Maker basics, Coach's Board, score-only GameDay, drill and practice tools, roster and basic schedule.",
    tone: "free",
  },
  { name: MODULES.playbook_plus.name, price: MODULES.playbook_plus.price, summary: "Full Playbook: save, organize, publish and export plays.", tone: "grape" },
  { name: MODULES.team_hub_plus.name, price: MODULES.team_hub_plus.price, summary: "Full Locker Room and team coordination.", tone: "flame" },
  { name: MODULES.gameday_plus.name, price: MODULES.gameday_plus.price, summary: "Location-based player stat tracking and analytics.", tone: "grape" },
];

const GLANCE: { feature: string; plan: string; free: boolean }[] = [
  { feature: "Create and animate plays", plan: "Free", free: true },
  { feature: "Coach's Board, Drill Maker, Practice Planner", plan: "Free", free: true },
  { feature: "Roster, player invites, basic schedule", plan: "Free", free: true },
  { feature: "Scoreboard: score, periods, team fouls", plan: "Free", free: true },
  { feature: "Save, organize, publish and export team plays", plan: MODULES.playbook_plus.name, free: false },
  { feature: "Team chat, plans, resources, calendar sync", plan: MODULES.team_hub_plus.name, free: false },
  { feature: "Tap-the-court player stats, shot charts, lineups", plan: MODULES.gameday_plus.name, free: false },
  { feature: "All three paid modules + AI Assistant when active", plan: COMPLETE_NAME, free: false },
];

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-3xl border p-4",
        tier.tone === "free" ? "border-success/40 bg-surface-2/60" : cn(TONE[tier.tone].border, "bg-surface-2/60"),
      )}
    >
      <span className="text-sm font-black uppercase tracking-wider text-foreground">{tier.name}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-4xl font-black text-foreground">${tier.price}</span>
        <span className="text-xs font-bold text-muted-foreground">{tier.price === 0 ? "forever" : "/ month per team"}</span>
      </span>
      <span className="text-sm font-semibold leading-relaxed text-muted-foreground">{tier.summary}</span>
    </div>
  );
}

function Pricing() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void trackAnon("landing_pricing_view");
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const moduleTotal = MODULES.playbook_plus.price + MODULES.team_hub_plus.price + MODULES.gameday_plus.price;

  return (
    <section
      ref={ref}
      id="pricing"
      aria-labelledby="pricing-title"
      className="scroll-mt-20 rounded-[2rem] border-2 border-border/70 bg-surface/80 p-5 shadow-xl shadow-background/40 sm:p-8"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Pill tone="flame">Pricing</Pill>
        <h2 id="pricing-title" className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
          Free to start. Pay only for what you use.
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          <Pill tone="success">No credit card required</Pill>
          <Pill tone="muted">One monthly charge per team</Pill>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {TIERS.map((t) => (
            <TierCard key={t.name} tier={t} />
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border-2 border-flame bg-flame/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-lg font-black uppercase tracking-wider text-foreground">{COMPLETE_NAME}</span>
            <Pill tone="flame">Best value</Pill>
          </div>
          <span className="flex items-baseline gap-1">
            <span className="text-5xl font-black text-foreground">${COMPLETE_PRICE}</span>
            <span className="text-sm font-bold text-muted-foreground">/ month per team</span>
          </span>
          <ul className="flex flex-col gap-2">
            {[
              `${MODULES.playbook_plus.name}, ${MODULES.team_hub_plus.name} and ${MODULES.gameday_plus.name}`,
              `$${moduleTotal} of modules for $${COMPLETE_PRICE}`,
              "One recurring charge for the whole team",
            ].map((it) => (
              <li key={it} className="flex items-start gap-2 text-sm font-bold text-foreground">
                <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-flame" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 rounded-2xl border border-grape/50 bg-background/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles aria-hidden className="h-4 w-4 text-grape-bright" />
              <span className="text-sm font-black text-foreground">CoachSide AI Assistant</span>
              <Pill tone="muted">Coming soon</Pill>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              Included with Complete when AI access is active.
            </span>
            <ul className="flex flex-wrap gap-2">
              {AI_EXAMPLES.map((p) => (
                <li
                  key={p}
                  className="rounded-2xl rounded-bl-md border border-grape/40 bg-grape/10 px-3 py-1.5 text-xs font-semibold text-foreground"
                >
                  “{p}”
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-border/70">
        <div className="bg-surface-2/80 px-4 py-2.5">
          <span className="text-sm font-black uppercase tracking-wider text-foreground">Free vs paid at a glance</span>
        </div>
        <table className="w-full text-left">
          <caption className="sr-only">Which CoachSide features are free and which plan includes each paid feature</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Plan</th>
            </tr>
          </thead>
          <tbody>
            {GLANCE.map((row) => (
              <tr key={row.feature} className="border-t border-border/60">
                <th scope="row" className="px-4 py-3 text-sm font-semibold text-foreground">
                  {row.feature}
                </th>
                <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black",
                      row.free ? "bg-success/20 text-foreground" : "bg-flame/20 text-foreground",
                    )}
                  >
                    {row.free ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Lock aria-hidden className="h-3.5 w-3.5" />}
                    {row.plan}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <SignupCta event="landing_start_free" size="lg" className="w-full sm:w-auto">
          Start Free
        </SignupCta>
        <SignupCta next="/membership" event="landing_membership_options" tone="neutral" size="lg" className="w-full sm:w-auto">
          See Membership Options
        </SignupCta>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const NAV = [
  { href: "#playmaker", label: "Play Maker" },
  { href: "#lockerroom", label: "Locker Room" },
  { href: "#gameday", label: "GameDay" },
  { href: "#free-tools", label: "Free tools" },
  { href: "#pricing", label: "Pricing" },
];

export function Landing() {
  useEffect(() => {
    void trackAnon("landing_view");
  }, []);

  const [playmaker, lockerroom, gameday] = PRODUCTS as [Product, Product, Product];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2">
          <a href="#top" className="inline-flex shrink-0 items-center rounded-2xl border border-grape/50 bg-grape/15 px-2.5 py-1">
            <img src={wordmark.url} alt="CoachSide" className="h-7 w-auto sm:h-8" />
          </a>
          <nav aria-label="Sections" className="ml-2 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-full px-3 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/auth" search={{ mode: "signin" }} className={ctaCls("ghost", "sm")}>
              Sign In
            </Link>
            <SignupCta event="landing_start_free" size="sm">
              Start Free
            </SignupCta>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-3 py-6 sm:gap-10 sm:py-10">
        {/* HERO + THREE PRODUCTS */}
        <section aria-labelledby="hero-title" className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 rounded-[2rem] border-2 border-grape/50 bg-grape/10 px-5 py-8 text-center sm:py-10">
            <Pill tone="flame">Basketball coaching platform</Pill>
            <h1 id="hero-title" className="max-w-3xl text-4xl font-black leading-[1.05] text-foreground sm:text-6xl">
              Coach better from one place.
            </h1>
            <p className="text-lg font-bold text-muted-foreground sm:text-2xl">
              Build plays. Run your team. Track the game.
            </p>
            <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
              <SignupCta event="landing_start_free" size="lg">
                Start Free
              </SignupCta>
              <ExplorePlays />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Pill tone="success">No credit card required</Pill>
              <InstallAppPill />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PRODUCTS.map((p) => (
              <ProductTile key={p.id} p={p} />
            ))}
          </div>
        </section>

        <ProductSection
          p={playmaker}
          index={1}
          cta={
            <SignupCta next="/plays/new" event="landing_build_play" tone="grape" size="lg" className="w-full sm:w-auto">
              Try the Play Maker
            </SignupCta>
          }
          visual={
            <div className="flex flex-col gap-2 rounded-3xl border border-grape/40 bg-background/50 p-2 sm:p-3">
              <DemoPlay />
              <span className="self-center rounded-full bg-surface-2/80 px-3 py-1 text-xs font-bold text-muted-foreground">
                Live Play Maker preview
              </span>
            </div>
          }
        />

        <ProductSection
          p={lockerroom}
          index={2}
          reverse
          cta={
            <SignupCta next="/lockerroom" event="landing_setup_team" tone="flame" size="lg" className="w-full sm:w-auto">
              See the Locker Room
            </SignupCta>
          }
          visual={<LockerPreview />}
        />

        <ProductSection
          p={gameday}
          index={3}
          cta={
            <SignupCta next="/games/new" event="landing_start_free" tone="grape" size="lg" className="w-full sm:w-auto">
              Start a Free Game
            </SignupCta>
          }
          visual={
            <div className="grid grid-cols-2 gap-2">
              <Shot src={shotChart} alt="CoachSide shot chart with makes and misses" caption="Shot chart" className="col-span-2" imgClassName="aspect-[4/3] object-center" />
              <Shot src={teamStats} alt="CoachSide team season stats screen" caption="Team stats" />
              <Shot src={leaders} alt="CoachSide season leaders screen" caption="Leaders" />
            </div>
          }
        />

        {/* MORE FREE TOOLS */}
        <section
          id="free-tools"
          aria-labelledby="free-tools-title"
          className="scroll-mt-20 rounded-[2rem] border-2 border-success/30 bg-surface/80 p-5 shadow-xl shadow-background/40 sm:p-8"
        >
          <div className="flex flex-col gap-2">
            <Pill tone="success" className="self-start">Free</Pill>
            <h2 id="free-tools-title" className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
              More tools included free.
            </h2>
          </div>
          <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
            {FREE_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <li key={tool.title} className="flex items-start gap-3 border-t border-border/60 py-4">
                  <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-success/40 bg-success/10 text-success">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-base font-black text-foreground">{tool.title}</span>
                    <span className="text-sm font-semibold leading-relaxed text-muted-foreground">{tool.body}</span>
                    {tool.note ? (
                      <span className="mt-1 self-start rounded-full bg-grape/15 px-2.5 py-0.5 text-xs font-bold text-foreground">
                        {tool.note}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <Pricing />

        {/* FINAL */}
        <section
          aria-labelledby="final-title"
          className="flex flex-col items-center gap-4 rounded-[2rem] border-2 border-flame/60 bg-flame/10 p-6 text-center shadow-xl shadow-background/40 sm:p-10"
        >
          <h2 id="final-title" className="max-w-3xl text-3xl font-black leading-tight text-foreground sm:text-4xl">
            Start free today. Upgrade only when you need more.
          </h2>
          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
            <SignupCta event="landing_setup_team" size="lg">
              Create Free Coach Account
            </SignupCta>
            <ExplorePlays />
          </div>
          <Pill tone="success">No credit card required</Pill>
        </section>

        <SocialCTA />
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-3 pb-6">
        <Panel className="flex w-full flex-wrap items-center gap-2 p-2">
          <span className="inline-flex items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-1.5">
            <img src={mark.url} alt="" aria-hidden className="h-6 w-6 rounded-lg object-cover" />
            <span className="text-sm font-bold text-foreground">CoachSide</span>
          </span>
          <Pill tone="muted">coachside.live</Pill>
          <Link to="/library" className="rounded-full px-3 py-1 text-xs font-bold text-muted-foreground hover:text-foreground">
            Play Library
          </Link>
          <Link to="/auth" search={{ mode: "signin" }} className="ml-auto rounded-full px-3 py-1 text-xs font-bold text-muted-foreground hover:text-foreground">
            Sign In
          </Link>
        </Panel>
      </footer>
    </div>
  );
}
