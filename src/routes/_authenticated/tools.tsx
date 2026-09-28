import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, BookOpen, Clapperboard, ClipboardPenLine, Dumbbell, ListChecks, PenLine, Swords, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { actionCardCls } from "@/components/Bubbles";
import { Court } from "@/components/court/Court";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({
    meta: [
      { title: "Coach Tools — CoachSide" },
      { name: "description", content: "Open CoachSide's basketball planning, game, playmaking, and stat tools." },
      { property: "og:title", content: "Coach Tools — CoachSide" },
      { property: "og:description", content: "Basketball planning, game, playmaking, and stat tools in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ToolsPage,
});

type PreviewType = "board" | "plan" | "drill" | "play" | "book" | "game" | "stats";
type ToolCard = { name: string; description: string; cta: string; to: "/board" | "/practice" | "/drills/new" | "/plays/new" | "/plays" | "/games/new" | "/stats"; icon: LucideIcon; preview: PreviewType; tone: "grape" | "flame" };

const TOOLS: ToolCard[] = [
  { name: "Playmaker", description: "Build, sequence, and animate every action.", cta: "Create a Play", to: "/plays/new", icon: ClipboardPenLine, preview: "play", tone: "grape" },
  { name: "Coach's Board", description: "Draw a timeout adjustment in seconds.", cta: "Open Board", to: "/board", icon: PenLine, preview: "board", tone: "flame" },
  { name: "Drill Maker", description: "Design movement with players and equipment.", cta: "Build a Drill", to: "/drills/new", icon: Dumbbell, preview: "drill", tone: "flame" },
  { name: "Practice Planner", description: "Order every block and keep practice on time.", cta: "Plan Practice", to: "/practice", icon: ListChecks, preview: "plan", tone: "grape" },
  { name: "Live Game", description: "Capture every shot from where it happened.", cta: "Start Live Game", to: "/games/new", icon: Swords, preview: "game", tone: "grape" },
  { name: "Team Stats", description: "See results, leaders, and shooting efficiency.", cta: "Open Team Stats", to: "/stats", icon: BarChart3, preview: "stats", tone: "flame" },
  { name: "Playbook", description: "Find the right play and run it instantly.", cta: "Open Playbook", to: "/plays", icon: BookOpen, preview: "book", tone: "flame" },
];

const miniTool = "rounded-full border border-border bg-surface px-2 py-1 text-[9px] font-black text-foreground";
const player = (position: string, label: string, defense = false) => (
  <span key={`${position}-${label}`} className={cn("absolute flex h-6 w-6 items-center justify-center text-[9px] font-black", position, defense ? "rounded-md border-2 border-dashed border-flame bg-background text-flame" : "rounded-full border-2 border-grape bg-background text-foreground")}>{defense ? `X${label}` : label}</span>
);

function MiniCourt({ children }: { children: ReactNode }) {
  return <Court variant="full" className="rounded-lg border" overlay={<div className="absolute inset-0">{children}</div>} />;
}

function BoardPreview() {
  return <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface-2/70 p-2"><MiniCourt>{player("left-[20%] top-[57%]", "1")}{player("left-[55%] top-[25%]", "3")}{player("left-[72%] top-[60%]", "5")}<span className="absolute left-[25%] top-[53%] h-1 w-[42%] origin-left -rotate-12 rounded-full bg-flame" /><span className="absolute left-[49%] top-[43%] text-flame">➤</span></MiniCourt><div className="flex flex-wrap gap-1"><span className={miniTool}>Marker</span><span className={miniTool}>Arrow</span><span className={miniTool}>Players</span><span className={miniTool}>Eraser</span><span className="h-6 w-6 rounded-full border-2 border-flame bg-grape" /><span className="h-6 w-6 rounded-full border-2 border-grape bg-flame" /><span className={cn(miniTool, "ml-auto")}>Clear Board</span></div></div>;
}

function ActionCourt({ drill = false }: { drill?: boolean }) {
  return <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface-2/70 p-2"><MiniCourt>{player("left-[54%] top-[49%]", "1")}{player("left-[68%] top-[20%]", "2")}{player("left-[76%] top-[68%]", "3")}{drill ? player("left-[63%] top-[58%]", "1", true) : null}<span className="absolute left-[57%] top-[48%] h-1 w-[18%] origin-left -rotate-[25deg] rounded-full bg-grape" /><span className="absolute left-[67%] top-[23%] h-0 w-[15%] origin-left rotate-[55deg] border-t-2 border-dashed border-flame" />{drill ? <><span className="absolute left-[57%] top-[72%] text-base text-flame">▲</span><span className="absolute left-[70%] top-[44%] text-base text-flame">●</span></> : null}</MiniCourt><div className="flex items-center gap-1 overflow-hidden"><span className={cn(miniTool, "border-grape")}>{drill ? "Move" : "Cut"}</span><span className={miniTool}>Pass</span><span className={miniTool}>{drill ? "Equipment" : "Screen"}</span><span className="ml-auto rounded-full border border-flame bg-flame/20 px-2 py-1 text-[9px] font-black text-foreground">Step 2</span></div></div>;
}

function PlannerPreview() {
  return <div className="grid min-h-36 gap-1.5 rounded-xl border border-border/70 bg-surface-2/70 p-2">{[["1","Dynamic warm-up","8 min"],["2","Finishing stations","15 min"],["3","Shell defense","20 min"],["4","Live scrimmage","12 min"]].map(([n,label,time], i) => <div key={label} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-grape/25 text-[9px] font-black text-foreground">{n}</span><span className="truncate text-[10px] font-bold text-foreground">{label}</span><span className={cn("rounded-full px-2 py-1 text-[9px] font-black", i === 2 ? "bg-flame/20 text-flame" : "bg-surface-2 text-muted-foreground")}>{time}</span></div>)}</div>;
}

function GamePreview() {
  return <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface-2/70 p-2"><MiniCourt><span className="absolute left-[72%] top-[35%] h-4 w-4 rounded-full border-2 border-chart-4 bg-chart-4/40" /><span className="absolute left-[63%] top-[66%] flex h-4 w-4 items-center justify-center rounded-full border-2 border-destructive bg-background text-[9px] font-black text-destructive">×</span><span className="absolute left-[82%] top-[53%] h-4 w-4 rounded-full border-2 border-chart-4 bg-chart-4/40" /><span className="absolute left-[52%] top-[48%] rounded-full border border-flame bg-flame/20 px-2 py-1 text-[9px] font-black text-foreground">Tap location</span></MiniCourt><div className="grid grid-cols-3 gap-1"><span className={miniTool}>#1 selected</span><span className="rounded-full border border-chart-4 bg-chart-4/20 px-2 py-1 text-center text-[9px] font-black text-foreground">MADE</span><span className="rounded-full border border-destructive bg-destructive/20 px-2 py-1 text-center text-[9px] font-black text-foreground">MISS</span></div></div>;
}

function StatsPreview() {
  return <div className="space-y-2 rounded-xl border border-border/70 bg-surface-2/70 p-2"><div className="grid grid-cols-4 gap-1">{[["RECORD","18–4"],["PPG","67.8"],["FG%","48%"],["AST","16.2"]].map(([label,value], i) => <div key={label} className={cn("rounded-lg border p-1 text-center", i % 2 ? "border-flame/40 bg-flame/10" : "border-grape/40 bg-grape/10")}><div className="text-[7px] font-bold text-muted-foreground">{label}</div><div className="text-xs font-black text-foreground">{value}</div></div>)}</div><div className="grid grid-cols-[1fr_1.2fr] gap-2"><div className="space-y-1">{[["#1 Bolton","14.8 PPG"],["#24 Danforth","7.3 RPG"],["#3 Chatham","5.6 APG"]].map(([name, stat]) => <div key={name} className="rounded-lg border border-border bg-surface px-2 py-1"><div className="text-[8px] font-black text-foreground">{name}</div><div className="text-[8px] font-bold text-flame">{stat}</div></div>)}</div><MiniCourt><span className="absolute left-[70%] top-[34%] h-3 w-3 rounded-full bg-chart-4" /><span className="absolute left-[62%] top-[62%] h-3 w-3 rounded-full bg-destructive" /><span className="absolute left-[82%] top-[50%] h-3 w-3 rounded-full bg-chart-4" /></MiniCourt></div></div>;
}

function BookPreview() {
  return <div className="grid min-h-36 grid-cols-2 gap-2 rounded-xl border border-border/70 bg-surface-2/70 p-2">{[["Horns Flare","Offense"],["Box BLOB","BLOB"]].map(([name,cat], i) => <div key={name} className="overflow-hidden rounded-lg border border-border bg-surface"><div className="p-1"><MiniCourt>{player("left-[55%] top-[48%]", "1")}<span className={cn("absolute left-[58%] top-[48%] h-0 w-[25%] origin-left border-t-2", i ? "rotate-[35deg] border-dashed border-flame" : "-rotate-[20deg] border-grape")} /></MiniCourt></div><div className="px-2 pb-2"><div className="text-[10px] font-black text-foreground">{name}</div><div className="text-[8px] font-bold text-muted-foreground">{cat} · Run Play</div></div></div>)}</div>;
}

function FilmPreview() {
  return <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface-2/70 p-2"><div className="flex h-20 items-center justify-center rounded-lg border border-border bg-background"><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-grape bg-grape/25 text-sm text-foreground">▶</span></div><div className="space-y-1">{[["12:34","#24 MADE","90%"],["12:31","#3 REBOUND","Review"],["12:20","#1 ASSIST","85%"]].map(([time,label,conf], i) => <div key={time} className="grid grid-cols-[36px_1fr_auto] items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1"><span className="text-[8px] font-black text-muted-foreground">{time}</span><span className="truncate text-[9px] font-bold text-foreground">{label}</span><span className={cn("rounded-full px-1.5 py-0.5 text-[7px] font-black", i === 1 ? "bg-flame/20 text-flame" : "bg-grape/20 text-foreground")}>{conf}</span></div>)}</div></div>;
}

function Preview({ type }: { type: PreviewType }) {
  if (type === "board") return <BoardPreview />;
  if (type === "drill") return <ActionCourt drill />;
  if (type === "play") return <ActionCourt />;
  if (type === "plan") return <PlannerPreview />;
  if (type === "game") return <GamePreview />;
  if (type === "stats") return <StatsPreview />;
  if (type === "film") return <FilmPreview />;
  return <BookPreview />;
}

function ToolsPage() {
  return <AppShell title="Coach Tools" subtitle="Build it. Teach it. Track it." wide><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{TOOLS.map((tool) => { const Icon = tool.icon; return <Link key={tool.name} to={tool.to} className={cn(actionCardCls, "group flex h-full flex-col gap-3 p-3")}><Preview type={tool.preview} /><div className="flex items-center justify-center gap-2 text-center"><Icon className={cn("h-5 w-5", tool.tone === "grape" ? "text-grape-bright" : "text-flame")} aria-hidden /><span className="text-xl font-black text-foreground">{tool.name}</span></div><p className="flex-1 text-center text-sm font-semibold text-muted-foreground">{tool.description}</p><span className={cn("flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-black", tool.tone === "grape" ? "border-grape bg-grape text-primary-foreground" : "border-flame bg-flame text-accent-foreground")}>{tool.cta}</span></Link>; })}</div></AppShell>;
}