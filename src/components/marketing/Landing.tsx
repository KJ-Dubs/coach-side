import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FolderOpen,
  ListChecks,
  MessagesSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { trackAnon, type AnonEvent } from "@/lib/funnel";
import { SocialCTA } from "@/components/SocialCTA";
import { Panel, Pill } from "@/components/Bubbles";
import { DemoPlay } from "@/components/marketing/DemoPlay";
import { InstallAppPill } from "@/components/InstallApp";
import { COMPLETE_NAME, COMPLETE_PRICE, FREE_CORE, MODULE_LIST, MODULES, type ModuleKey } from "@/lib/entitlements";
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
    "inline-flex items-center justify-center gap-2 rounded-full border text-center font-bold tracking-wide shadow-lg shadow-black/20 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape",
    CTA_TONE[tone],
    CTA_SIZE[size],
    className,
  );
}

const track = (e: AnonEvent) => () => void trackAnon(e);

function ExplorePlays({ size = "lg", label = "Explore Plays", className }: { size?: keyof typeof CTA_SIZE; label?: string; className?: string }) {
  return (
    <Link to="/library" onClick={track("landing_explore_plays")} className={ctaCls("flame", size, className)}>
      {label}
    </Link>
  );
}

function BuildPlay({ size = "lg", className }: { size?: keyof typeof CTA_SIZE; className?: string }) {
  // Signed-out coaches create an account, then land straight in play creation.
  return (
    <Link
      to="/auth"
      search={{ mode: "signup", next: "/plays/new" }}
      onClick={track("landing_build_play")}
      className={ctaCls("grape", size, className)}
    >
      Build a Play
    </Link>
  );
}

function StartFree({ size = "md", label = "Start Free", event = "landing_start_free", tone = "flame", className }: { size?: keyof typeof CTA_SIZE; label?: string; event?: AnonEvent; tone?: CtaTone; className?: string }) {
  return (
    <Link to="/auth" search={{ mode: "signup" }} onClick={track(event)} className={ctaCls(tone, size, className)}>
      {label}
    </Link>
  );
}

function AnchorCta({ href, children, tone = "neutral" }: { href: string; children: ReactNode; tone?: CtaTone }) {
  return (
    <a href={href} className={ctaCls(tone, "md")}>
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Story section shell: one surface, one heading, one CTA.            */
/* ------------------------------------------------------------------ */

function StorySection({
  id,
  eyebrow,
  title,
  lead,
  points,
  cta,
  media,
  tone = "grape",
  reverse = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  points: string[];
  cta: ReactNode;
  media?: ReactNode;
  tone?: "grape" | "flame";
  reverse?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-20 rounded-3xl border border-l-4 bg-surface/80 p-4 shadow-lg shadow-black/30 sm:p-6",
        tone === "flame" ? "border-flame/40 border-l-flame" : "border-grape/40 border-l-grape",
      )}
    >
      <div className={cn("grid items-center gap-5", media && "lg:grid-cols-2", reverse && media && "lg:[&>*:first-child]:order-2")}>
        <div className="flex min-w-0 flex-col gap-3">
          <Pill tone={tone} className="self-start">{eyebrow}</Pill>
          <h2 id={`${id}-title`} className="text-2xl font-black leading-tight text-foreground sm:text-4xl">
            {title}
          </h2>
          <p className="text-base font-semibold leading-relaxed text-muted-foreground">{lead}</p>
          <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm font-semibold text-foreground">
                <span
                  aria-hidden
                  className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone === "flame" ? "bg-flame" : "bg-grape")}
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="pt-1">{cta}</div>
        </div>
        {media ? <div className="min-w-0">{media}</div> : null}
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

const LOCKER_AREAS: { label: string; note: string; icon: LucideIcon }[] = [
  { label: "Team Chat", note: "Announcements & messages", icon: MessagesSquare },
  { label: "Schedule", note: "Games & practices", icon: CalendarDays },
  { label: "Playbook", note: "Shared play folders", icon: FolderOpen },
  { label: "Plans", note: "Assignments to review", icon: ListChecks },
];

const SEASON_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: "Practice plans built from your drills", icon: ClipboardList },
  { label: "One team calendar for games and practices", icon: CalendarDays },
  { label: "Google Calendar support for the coach's schedule", icon: CalendarDays },
  { label: "Upcoming games and practices on your Home screen", icon: ListChecks },
  { label: "Team notifications when the schedule changes", icon: Bell },
  { label: "Assignments and resources for players", icon: FolderOpen },
];

const AI_PROMPTS = [
  "Add this schedule from the photo.",
  "Add these players to my roster.",
  "What games do we have next week?",
  "Build a 20-minute press-break segment.",
  "Move Thursday practice to 5:30.",
];

/* ------------------------------------------------------------------ */
/* Pricing — every number and benefit comes from entitlements.ts.     */
/* ------------------------------------------------------------------ */

const MODULE_ANCHOR: Record<ModuleKey, string> = {
  playbook_plus: "playbook-plus",
  gameday_plus: "gameday-plus",
  team_hub_plus: "team-hub-plus",
};

function PriceCard({
  id,
  name,
  price,
  blurb,
  items,
  highlight,
  badge,
  footer,
}: {
  id?: string;
  name: string;
  price: number;
  blurb: string;
  items: ReactNode[];
  highlight?: boolean;
  badge?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "flex scroll-mt-24 flex-col gap-3 rounded-3xl border p-4 target:ring-2 target:ring-flame",
        highlight ? "border-2 border-flame bg-flame/10" : "border-border/70 bg-surface-2/60",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-black text-foreground">{name}</h3>
        {badge}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-black text-foreground">${price}</span>
        <span className="text-sm font-bold text-muted-foreground">{price === 0 ? "forever" : "/ month per team"}</span>
      </div>
      <p className="text-sm font-semibold leading-relaxed text-muted-foreground">{blurb}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm font-semibold text-foreground">
            <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", highlight ? "bg-flame" : "bg-grape")} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-auto pt-1">{footer}</div> : null}
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
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="pricing"
      aria-labelledby="pricing-title"
      className="scroll-mt-20 rounded-3xl border border-border/70 bg-surface/80 p-4 shadow-lg shadow-black/30 sm:p-6"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Pill tone="flame">Pricing</Pill>
        <h2 id="pricing-title" className="text-2xl font-black leading-tight text-foreground sm:text-4xl">
          Start free. Add only what you use.
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          <Pill tone="success">Start free</Pill>
          <Pill tone="success">No credit card required to create an account</Pill>
          <Pill tone="muted">Paid features unlock when you choose a module or Complete</Pill>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <PriceCard
          name="Free Core"
          price={0}
          blurb="Everything you need to try CoachSide with your team."
          items={FREE_CORE}
        />
        {MODULE_LIST.map((m) => (
          <PriceCard
            key={m.key}
            id={MODULE_ANCHOR[m.key]}
            name={m.name}
            price={m.price}
            blurb={m.blurb}
            items={m.benefits}
          />
        ))}
        <PriceCard
          name={COMPLETE_NAME}
          price={COMPLETE_PRICE}
          highlight
          badge={<Pill tone="flame">Best Value</Pill>}
          blurb={`All three modules on one monthly team charge — $${MODULE_LIST.reduce((s, m) => s + m.price, 0)} worth for $${COMPLETE_PRICE}.`}
          items={[
            `Everything in ${MODULES.playbook_plus.name}, ${MODULES.gameday_plus.name} and ${MODULES.team_hub_plus.name}`,
            "One recurring charge for the whole team",
            <span key="ai" className="inline-flex flex-wrap items-center gap-1.5">
              CoachSide AI Assistant when it launches <Pill tone="muted">Coming soon</Pill>
            </span>,
          ]}
        />
      </div>

      <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <StartFree size="lg" className="w-full sm:w-auto" />
        <Link
          to="/auth"
          search={{ mode: "signup", next: "/membership" }}
          onClick={track("landing_membership_options")}
          className={ctaCls("neutral", "lg", "w-full sm:w-auto")}
        >
          See Membership Options
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const NAV = [
  { href: "#plays", label: "Plays" },
  { href: "#gameday", label: "GameDay" },
  { href: "#team", label: "Team" },
  { href: "#pricing", label: "Pricing" },
];

export function Landing() {
  useEffect(() => {
    void trackAnon("landing_view");
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2">
          <a href="#top" className="inline-flex shrink-0 items-center rounded-2xl border border-grape/50 bg-grape/15 px-2.5 py-1">
            <img src={wordmark.url} alt="CoachSide" className="h-7 w-auto sm:h-8" />
          </a>
          <nav aria-label="Sections" className="ml-2 hidden items-center gap-1 md:flex">
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
            <StartFree size="sm" />
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-4 sm:gap-6">
        {/* HERO */}
        <section
          aria-labelledby="hero-title"
          className="rounded-3xl border-2 border-grape/60 bg-grape/10 p-4 shadow-lg shadow-black/30 sm:p-6"
        >
          <div className="grid items-center gap-5 lg:grid-cols-[1.05fr_1fr]">
            <div className="flex min-w-0 flex-col gap-4">
              <Pill tone="flame" className="self-start">Basketball coaching platform</Pill>
              <h1 id="hero-title" className="text-4xl font-black leading-[1.05] text-foreground sm:text-6xl">
                Coach better from one place.
              </h1>
              <p className="text-base font-semibold leading-relaxed text-muted-foreground sm:text-lg">
                Build and find basketball plays, track games and stats, organize your team, and run the
                season from CoachSide.
              </p>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <ExplorePlays />
                <BuildPlay />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  onClick={track("landing_setup_team")}
                  className={ctaCls("neutral", "sm")}
                >
                  Set Up My Team
                </Link>
                <Pill tone="success">Start free</Pill>
                <Pill tone="success">No credit card required</Pill>
              </div>
              <InstallAppPill />
            </div>
            <div className="rounded-3xl border border-border/70 bg-surface/80 p-2 sm:p-3">
              <DemoPlay />
            </div>
          </div>
        </section>

        {/* A — PLAYS */}
        <StorySection
          id="plays"
          eyebrow="Plays"
          title="Build it. Find it. Teach it."
          lead="Grab a play from the CoachSide Library or draw your own, then watch it run step by step before your players ever see it."
          points={[
            "Browse the CoachSide Play Library",
            "Animated plays with cuts, screens, passes, dribbles and handoffs",
            "Sequence every action and play it back",
            "Options and counters for the same set",
            "Team playbook folders",
            "Share links and export play videos",
            "Players review the plays you assign",
          ]}
          cta={<ExplorePlays size="md" label="Explore the Playbook" />}
          media={
            <div className="rounded-3xl border border-border/70 bg-surface-2/60 p-2 sm:p-3">
              <DemoPlay variant="horns" />
            </div>
          }
        />

        {/* B — GAMEDAY */}
        <StorySection
          id="gameday"
          tone="flame"
          reverse
          eyebrow="GameDay"
          title="Track the game from the court."
          lead="Tap where it happened, tap the player, tap the stat. The court never leaves the screen, and the numbers turn into reports the moment the game ends."
          points={[
            "Tap shot locations",
            "Individual player or team-only stats",
            "Assists, rebounds, turnovers, fouls and free throws",
            "Choose which stats you track",
            "Fix stats after the game",
            "Player and team reports",
            "Season history and shot charts",
          ]}
          cta={<AnchorCta href="#gameday-plus" tone="flame">See GameDay+</AnchorCta>}
          media={
            <div className="grid grid-cols-2 gap-2">
              <Shot src={shotChart} alt="CoachSide shot chart with makes and misses" caption="Shot chart" className="col-span-2" imgClassName="aspect-[4/3] object-center" />
              <Shot src={teamStats} alt="CoachSide team season stats screen" caption="Team stats" />
              <Shot src={leaders} alt="CoachSide season leaders screen" caption="Leaders" />
            </div>
          }
        />

        {/* C — TEAM */}
        <StorySection
          id="team"
          eyebrow="Team"
          title="Your team gets its own Locker Room."
          lead="Players scan one code and land in a simple team space. Families get a read-only link — no account needed."
          points={[
            "Roster and player accounts",
            "Team chat and announcements",
            "Schedule",
            "Shared play folders",
            "Plans and assignments",
            "Player and team stats",
            "Read-only family access",
          ]}
          cta={<AnchorCta href="#team-hub-plus" tone="grape">See the Locker Room</AnchorCta>}
          media={
            <div className="grid grid-cols-2 gap-2">
              {LOCKER_AREAS.map((a) => {
                const Icon = a.icon;
                return (
                  <div key={a.label} className="flex flex-col gap-2 rounded-2xl border border-grape/40 bg-grape/10 p-3">
                    <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-grape/50 bg-grape/20 text-grape-bright">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-base font-black text-foreground">{a.label}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{a.note}</span>
                  </div>
                );
              })}
            </div>
          }
        />

        {/* D — SEASON */}
        <section
          id="season"
          aria-labelledby="season-title"
          className="scroll-mt-20 rounded-3xl border border-l-4 border-flame/40 border-l-flame bg-surface/80 p-4 shadow-lg shadow-black/30 sm:p-6"
        >
          <div className="flex flex-col gap-3">
            <Pill tone="flame" className="self-start">Season</Pill>
            <h2 id="season-title" className="text-2xl font-black leading-tight text-foreground sm:text-4xl">
              Practice. Schedule. Prepare.
            </h2>
            <p className="text-base font-semibold leading-relaxed text-muted-foreground">
              Walk into every practice with a plan and every week knowing what's next — and your players do too.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SEASON_ITEMS.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.label} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface-2/60 p-3">
                    <Icon aria-hidden className="h-5 w-5 shrink-0 text-flame" />
                    <span className="text-sm font-semibold text-foreground">{s.label}</span>
                  </li>
                );
              })}
            </ul>
            <div className="pt-1">
              <StartFree label="Plan My Season" />
            </div>
          </div>
        </section>

        {/* E — AI */}
        <section
          id="ai"
          aria-labelledby="ai-title"
          className="scroll-mt-20 rounded-3xl border border-l-4 border-grape/40 border-l-grape bg-surface/80 p-4 shadow-lg shadow-black/30 sm:p-6"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="grape">
                <Sparkles aria-hidden className="h-3.5 w-3.5" /> CoachSide AI Assistant · Complete feature
              </Pill>
              <Pill tone="muted">Coming soon</Pill>
            </div>
            <h2 id="ai-title" className="text-2xl font-black leading-tight text-foreground sm:text-4xl">
              Have CoachSide handle the busy work.
            </h2>
            <p className="text-base font-semibold leading-relaxed text-muted-foreground">
              Ask in plain words and review every change before it's saved. Included with {COMPLETE_NAME} when AI
              access is active.
            </p>
            <ul className="flex flex-wrap gap-2">
              {AI_PROMPTS.map((p) => (
                <li
                  key={p}
                  className="rounded-2xl rounded-bl-md border border-grape/40 bg-grape/10 px-3.5 py-2 text-sm font-semibold text-foreground"
                >
                  “{p}”
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Pricing />

        {/* FINAL */}
        <section
          aria-labelledby="final-title"
          className="flex flex-col items-center gap-4 rounded-3xl border-2 border-flame/60 bg-flame/10 p-5 text-center shadow-lg shadow-black/30 sm:p-8"
        >
          <h2 id="final-title" className="max-w-3xl text-2xl font-black leading-tight text-foreground sm:text-4xl">
            Start with a play. Build the rest of your season here.
          </h2>
          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
            <ExplorePlays />
            <StartFree size="lg" label="Create Free Coach Account" event="landing_setup_team" tone="grape" />
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
