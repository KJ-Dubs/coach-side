import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, Label, Note, Panel, Pill, StatTile } from "@/components/Bubbles";
import { StatsTabs } from "@/components/StatsTabs";
import { fetchSeasonBundle } from "@/lib/data";
import { aggregateTeam, fmtPct, fmtPer, fmtSplit, gameResult, gameScore, groupByGame } from "@/lib/stats";
import { useCurrentTeam } from "@/lib/teamContext";

export const Route = createFileRoute("/_authenticated/stats/")({
  head: () => ({
    meta: [
      { title: "Stats Overview — CoachSide" },
      {
        name: "description",
        content:
          "Season record, scoring and shooting at a glance, with game history, player stats, team stats and shot charts in one place.",
      },
      { property: "og:title", content: "Stats Overview — CoachSide" },
      { property: "og:description", content: "Your season in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatsOverview,
});

function StatsOverview() {
  const { team, teams, teamId, setTeam } = useCurrentTeam();
  const bundle = useQuery({
    queryKey: ["season-bundle", "final"],
    queryFn: () => fetchSeasonBundle({ finalOnly: true }),
  });

  const games = useMemo(
    () => (bundle.data?.games ?? []).filter((g) => !teamId || g.team_id === teamId),
    [bundle.data, teamId],
  );
  const events = useMemo(() => {
    const ids = new Set(games.map((g) => g.id));
    return (bundle.data?.events ?? []).filter((e) => ids.has(e.game_id));
  }, [bundle.data, games]);

  const line = aggregateTeam(games, events);
  const byGame = groupByGame(events);
  const record = games.reduce(
    (acc, g) => {
      const r = gameResult(g, byGame.get(g.id) ?? []);
      if (r === "W") acc.w += 1;
      else if (r === "L") acc.l += 1;
      return acc;
    },
    { w: 0, l: 0 },
  );
  const recent = [...games].slice(0, 5);

  return (
    <AppShell title="Stats" subtitle={team ? `${team.name} · ${team.season}` : "Season reporting"}>
      <StatsTabs />

      {teams.length > 1 ? (
        <Panel className="mb-3 flex flex-wrap items-center gap-2">
          <Label>Team</Label>
          {teams.map((t) => (
            <BubbleButton
              key={t.id}
              size="sm"
              tone={t.id === teamId ? "grape" : "neutral"}
              onClick={() => setTeam(t.id)}
            >
              {t.name}
            </BubbleButton>
          ))}
        </Panel>
      ) : null}

      <Panel className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Record" value={`${record.w}-${record.l}`} tone="grape" />
        <StatTile label="Games" value={games.length} />
        <StatTile label="Points / game" value={fmtPer(line.pts, games.length)} tone="flame" />
        <StatTile label="FG" value={fmtSplit(line.fg)} hint={fmtPct(line.fg)} />
      </Panel>

      <Panel className="mb-3 flex flex-col gap-2">
        <Label>Recent games</Label>
        {!recent.length ? (
          <EmptyState>Finish a game to start building season reports</EmptyState>
        ) : (
          recent.map((g) => {
            const evs = byGame.get(g.id) ?? [];
            const s = gameScore(g, evs);
            return (
              <div
                key={g.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-2"
              >
                <Pill tone={gameResult(g, evs) === "W" ? "success" : "muted"}>
                  {gameResult(g, evs) ?? "—"}
                </Pill>
                <span className="text-base font-black text-foreground">
                  {g.home_away === "away" ? "@" : "vs"} {g.opponent}
                </span>
                <Pill tone="muted">
                  {s.team}-{s.opp}
                </Pill>
                <Pill tone="muted">{new Date(g.game_date).toLocaleDateString()}</Pill>
                <Link
                  to="/review/$gameId"
                  params={{ gameId: g.id }}
                  className="ml-auto"
                >
                  <BubbleButton size="sm" tone="grape">
                    Review
                  </BubbleButton>
                </Link>
              </div>
            );
          })
        )}
      </Panel>

      <Panel className="flex flex-col items-center gap-3">
        <Note className="w-full text-left">Game history, player reporting and shot charts all live in these tabs.</Note>
        <div className="flex flex-wrap justify-center gap-2"><Link to="/games">
          <BubbleButton size="sm" tone="neutral">
            All games
          </BubbleButton>
        </Link>
        <Link to="/stats/players">
          <BubbleButton size="sm" tone="neutral">
            Player stats
          </BubbleButton>
        </Link>
        <Link to="/stats/team">
          <BubbleButton size="sm" tone="neutral">
            Team stats
          </BubbleButton>
        </Link></div>
      </Panel>
    </AppShell>
  );
}
