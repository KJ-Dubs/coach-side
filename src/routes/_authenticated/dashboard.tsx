import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Panel, Pill, StatTile } from "@/components/Bubbles";
import { fetchGames, fetchAllPlayers, fetchPlays } from "@/lib/data";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Coach Dashboard — CourtSide Coach" },
      {
        name: "description",
        content: "Start a game, design plays, open the playbook and review team and player stats.",
      },
      { property: "og:title", content: "Coach Dashboard — CourtSide Coach" },
      { property: "og:description", content: "Your basketball coaching home base." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type CardDef = {
  to: NonNullable<LinkProps["to"]>;
  title: string;
  blurb: string;
  action: string;
  tone: "flame" | "grape" | "neutral";
  glyph: string;
};

const CARDS: CardDef[] = [
  {
    to: "/games/new",
    title: "Start a Game",
    blurb: "Pick the team, opponent and starting five, then run live stats from the court.",
    action: "Set up game",
    tone: "flame",
    glyph: "▶",
  },
  {
    to: "/plays/new",
    title: "Create Plays",
    blurb: "Open a fresh frame-by-frame diagram: passes, cuts, curls, dribbles and screens.",
    action: "New play",
    tone: "grape",
    glyph: "✎",
  },
  {
    to: "/plays",
    title: "Playbook",
    blurb: "Browse Offense, BLOB, SLOB, Defense, Press Break and Presses. Present or share.",
    action: "Open playbook",
    tone: "neutral",
    glyph: "▤",
  },
  {
    to: "/stats/team",
    title: "Team Stats",
    blurb: "Record, points per game, shooting splits and a team shot chart from saved games.",
    action: "Team stats",
    tone: "neutral",
    glyph: "◆",
  },
  {
    to: "/stats/players",
    title: "Player Stats",
    blurb: "Per-player minutes, scoring, rebounds, splits and shot chart for the season.",
    action: "Player stats",
    tone: "neutral",
    glyph: "◉",
  },
  {
    to: "/roster",
    title: "Rosters",
    blurb: "Every player across your teams with games, points and minutes. Add teams and players.",
    action: "Player directory",
    tone: "neutral",
    glyph: "☰",
  },
  {
    to: "/games",
    title: "Game History",
    blurb: "Every saved game with final score, W/L and a link straight into the review and PDF.",
    action: "History",
    tone: "neutral",
    glyph: "◷",
  },
  {
    to: "/settings",
    title: "Settings",
    blurb: "Team name, logo, season, coaches, game defaults and assistant-coach invites.",
    action: "Settings",
    tone: "neutral",
    glyph: "⚙",
  },
  {
    to: "/profile",
    title: "Profile",
    blurb: "Your coach name, email, role and the teams you have access to.",
    action: "Profile",
    tone: "neutral",
    glyph: "☺",
  },
];

function Dashboard() {
  const me = useMe();
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });
  const players = useQuery({ queryKey: ["players", "all"], queryFn: fetchAllPlayers });
  const plays = useQuery({ queryKey: ["plays"], queryFn: fetchPlays });

  const live = (games.data ?? []).filter((g) => g.status !== "final");
  const finals = (games.data ?? []).filter((g) => g.status === "final");
  const greeting = me.profile?.full_name?.split(" ")[0] || "Coach";

  return (
    <AppShell
      title={`Welcome back, ${greeting}`}
      subtitle={me.org?.name ?? "Your basketball program"}
    >
      <Panel className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Teams" value={me.teams.length} tone="grape" />
        <StatTile label="Players" value={players.data?.length ?? "—"} />
        <StatTile label="Saved games" value={finals.length} />
        <StatTile label="Plays" value={plays.data?.length ?? "—"} tone="flame" />
      </Panel>

      {live.length ? (
        <Panel className="mb-3 flex flex-wrap items-center gap-2">
          <Pill tone="flame">In progress</Pill>
          {live.map((g) => (
            <Link key={g.id} to="/game/$gameId" params={{ gameId: g.id }}>
              <BubbleButton size="sm" tone="grape">
                vs {g.opponent} · resume live court
              </BubbleButton>
            </Link>
          ))}
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.title}
            to={c.to}
            className={cn(
              "group flex min-h-[176px] flex-col justify-between rounded-3xl border p-4 shadow-lg shadow-black/30 transition-transform active:scale-[0.99]",
              c.tone === "flame"
                ? "border-flame/60 bg-gradient-to-br from-flame/25 to-surface/80"
                : c.tone === "grape"
                  ? "border-grape/60 bg-gradient-to-br from-grape/25 to-surface/80"
                  : "border-border/70 bg-surface/80 hover:border-grape/60",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-2xl border border-border bg-surface-2/80 px-3 py-1.5 text-base font-black text-foreground">
                {c.title}
              </span>
              <span
                aria-hidden
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-2xl border text-lg font-black",
                  c.tone === "flame"
                    ? "border-flame bg-flame text-accent-foreground"
                    : "border-grape/60 bg-grape/25 text-foreground",
                )}
              >
                {c.glyph}
              </span>
            </div>
            <p className="my-3 rounded-2xl border border-border/50 bg-surface-2/60 px-3 py-2 text-xs font-semibold leading-relaxed text-muted-foreground">
              {c.blurb}
            </p>
            <span
              className={cn(
                "inline-flex w-fit rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider",
                c.tone === "flame"
                  ? "border-flame bg-flame text-accent-foreground"
                  : c.tone === "grape"
                    ? "border-grape bg-grape text-primary-foreground"
                    : "border-border bg-surface-2 text-foreground group-hover:border-grape/70",
              )}
            >
              {c.action} →
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
