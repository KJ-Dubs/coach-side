import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  ClipboardPenLine,
  Dumbbell,
  ListChecks,
  PenLine,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { actionCardCls, Pill } from "@/components/Bubbles";
import { Court } from "@/components/court/Court";
import teamStats from "@/assets/snapshot-team-stats.jpg";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({
    meta: [
      { title: "Coach Tools — CoachSide" },
      {
        name: "description",
        content: "Open CoachSide's basketball planning, game, playmaking, and stat tools.",
      },
      { property: "og:title", content: "Coach Tools — CoachSide" },
      {
        property: "og:description",
        content: "Basketball planning, game, playmaking, and stat tools in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ToolsPage,
});

type ToolCard = {
  name: string;
  description: string;
  cta: string;
  to: "/board" | "/practice" | "/drills/new" | "/plays/new" | "/plays" | "/games/new" | "/stats";
  icon: LucideIcon;
  preview: "board" | "plan" | "drill" | "play" | "book" | "game" | "stats";
  tone: "grape" | "flame";
};

const TOOLS: ToolCard[] = [
  { name: "Coach's Board", description: "Sketch a timeout adjustment on a full basketball court.", cta: "Open Board", to: "/board", icon: PenLine, preview: "board", tone: "flame" },
  { name: "Practice Planner", description: "Build a timed practice plan and share it with the team.", cta: "Plan Practice", to: "/practice", icon: ListChecks, preview: "plan", tone: "grape" },
  { name: "Drill Maker", description: "Create a reusable drill with court movement and coaching notes.", cta: "Build a Drill", to: "/drills/new", icon: Dumbbell, preview: "drill", tone: "flame" },
  { name: "Playmaker", description: "Build and animate deterministic basketball plays.", cta: "Create a Play", to: "/plays/new", icon: ClipboardPenLine, preview: "play", tone: "grape" },
  { name: "Playbook", description: "Open your plays or discover ideas in the CoachSide Library.", cta: "Open Playbook", to: "/plays", icon: BookOpen, preview: "book", tone: "flame" },
  { name: "Live Game", description: "Track a game quickly while the court stays on screen.", cta: "Start Live Game", to: "/games/new", icon: Swords, preview: "game", tone: "grape" },
  { name: "Team Stats", description: "Review team, player, game, and contextual shot data.", cta: "Open Stat Book", to: "/stats", icon: BarChart3, preview: "stats", tone: "flame" },
];

function CourtPreview({ kind }: { kind: "board" | "drill" | "play" | "game" }) {
  return (
    <div className="pointer-events-none overflow-hidden rounded-2xl border border-border/70 bg-surface-2/70 p-2">
      <Court
        variant="full"
        className="rounded-xl border"
        overlay={
          <>
            <span className="absolute left-[24%] top-[42%] flex h-7 w-7 items-center justify-center rounded-full border-2 border-grape bg-background text-xs font-black text-foreground">1</span>
            <span className="absolute left-[54%] top-[25%] flex h-7 w-7 items-center justify-center rounded-full border-2 border-flame bg-background text-xs font-black text-foreground">3</span>
            <span className="absolute left-[69%] top-[61%] flex h-7 w-7 items-center justify-center rounded-full border-2 border-grape bg-background text-xs font-black text-foreground">5</span>
            {kind !== "game" ? <span className="absolute left-[31%] top-[49%] h-1 w-[36%] origin-left -rotate-12 rounded-full bg-flame" /> : null}
          </>
        }
      />
    </div>
  );
}

function PlannerPreview({ drill = false }: { drill?: boolean }) {
  return (
    <div className="grid h-full min-h-36 gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-3">
      {[drill ? "Warm-up footwork" : "Dynamic warm-up", drill ? "Closeout series" : "Shooting stations", drill ? "Finish at the rim" : "Team concepts"].map((label, i) => (
        <div key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-grape/60 bg-grape/20 text-xs font-black text-foreground">{i + 1}</span>
          <span className="truncate text-xs font-bold text-foreground">{label}</span>
          <Pill tone={i === 1 ? "flame" : "muted"}>{drill ? "Drill" : `${10 + i * 5} min`}</Pill>
        </div>
      ))}
    </div>
  );
}

function BookPreview() {
  return (
    <div className="grid min-h-36 grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-3">
      {["Offense", "BLOB", "Defense", "Press Break"].map((label, i) => (
        <div key={label} className={cn("flex items-center justify-center rounded-xl border p-2 text-center text-xs font-black text-foreground", i % 2 ? "border-flame/50 bg-flame/15" : "border-grape/50 bg-grape/15")}>{label}</div>
      ))}
    </div>
  );
}

function Preview({ type }: { type: ToolCard["preview"] }) {
  if (type === "stats") return <img src={teamStats} alt="CoachSide team stats screen" className="h-40 w-full rounded-2xl border border-border/70 object-cover object-top" />;
  if (type === "plan") return <PlannerPreview />;
  if (type === "drill") return <PlannerPreview drill />;
  if (type === "book") return <BookPreview />;
  return <CourtPreview kind={type} />;
}

function ToolsPage() {
  return (
    <AppShell title="Coach Tools" subtitle="Everything you need to plan, teach, track, and review" wide>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.name} to={tool.to} className={cn(actionCardCls, "group flex h-full flex-col gap-3 p-4")}>
              <Preview type={tool.preview} />
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface-2/70 p-3">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", tool.tone === "grape" ? "border-grape/60 bg-grape/20 text-grape-bright" : "border-flame/60 bg-flame/20 text-flame")}><Icon className="h-5 w-5" aria-hidden /></span>
                <span className="text-xl font-black leading-tight text-foreground">{tool.name}</span>
              </div>
              <p className="flex-1 rounded-2xl border border-border/70 bg-surface-2/60 p-3 text-left text-sm font-semibold leading-relaxed text-muted-foreground">{tool.description}</p>
              <span className={cn("flex min-h-11 items-center justify-center rounded-full border px-4 text-center text-sm font-black transition-colors", tool.tone === "grape" ? "border-grape bg-grape text-primary-foreground group-hover:bg-grape/90" : "border-flame bg-flame text-accent-foreground group-hover:bg-flame/90")}>{tool.cta}</span>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}