import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatsTabs } from "@/components/StatsTabs";
import { BubbleButton, EmptyState, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { ShotChart } from "@/components/court/ShotChart";
import { fetchAllPlayers, fetchSeasonBundle, fetchTeams } from "@/lib/data";
import {
  aggregatePlayers,
  aggregateTeam,
  fmtMinutes,
  fmtPct,
  fmtPer,
  fmtSplit,
  gameResult,
  gameScore,
  groupByGame,
  lineupStats,
  seasonsOf,
} from "@/lib/stats";

type Search = { team?: string | undefined; season?: string | undefined };

export const Route = createFileRoute("/_authenticated/stats/team")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["team"] === "string" && s["team"] ? { team: s["team"] as string } : {}),
    ...(typeof s["season"] === "string" && s["season"] ? { season: s["season"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Team Stats — CoachSide" },
      {
        name: "description",
        content: "Record, points per game, shooting splits, rebounds, assists and a team shot chart.",
      },
      { property: "og:title", content: "Team Stats — CoachSide" },
      { property: "og:description", content: "Season team stats from saved games." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamStatsPage,
});

function TeamStatsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const players = useQuery({ queryKey: ["players", "all"], queryFn: fetchAllPlayers });
  const bundle = useQuery({
    queryKey: ["season-bundle", "final"],
    queryFn: () => fetchSeasonBundle({ finalOnly: true }),
  });

  const setSearch = (patch: Partial<Search>) =>
    navigate({
      search: (prev) => {
        const next = { ...prev, ...patch } as Search;
        for (const k of Object.keys(next) as (keyof Search)[]) if (!next[k]) delete next[k];
        return next;
      },
      replace: true,
    });

  const seasons = seasonsOf(teams.data ?? []);
  const season = search.season ?? "ALL";
  const teamsInSeason = (teams.data ?? []).filter((t) => season === "ALL" || t.season === season);
  const teamId =
    search.team && teamsInSeason.some((t) => t.id === search.team)
      ? search.team
      : teamsInSeason[0]?.id;
  const team = teamsInSeason.find((t) => t.id === teamId) ?? null;

  useEffect(() => {
    if (!search.team && teamId) setSearch({ team: teamId });
  }, [search.team, teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const games = useMemo(
    () => (bundle.data?.games ?? []).filter((g) => g.team_id === teamId),
    [bundle.data, teamId],
  );
  const ids = useMemo(() => new Set(games.map((g) => g.id)), [games]);
  const events = useMemo(
    () => (bundle.data?.events ?? []).filter((e) => ids.has(e.game_id)),
    [bundle.data, ids],
  );
  const subs = useMemo(
    () => (bundle.data?.subs ?? []).filter((s) => ids.has(s.game_id)),
    [bundle.data, ids],
  );
  const line = useMemo(() => aggregateTeam(games, events), [games, events]);
  const evByGame = useMemo(() => groupByGame(events), [events]);
  const playerLines = useMemo(() => aggregatePlayers(games, events, subs), [games, events, subs]);
  const leaders = useMemo(() => {
    const roster = (players.data ?? []).filter((p) => p.team_id === teamId);
    const rows = roster
      .map((p) => ({ p, l: playerLines.get(p.id) }))
      .filter((r) => r.l && r.l.games > 0) as { p: (typeof roster)[number]; l: NonNullable<ReturnType<typeof playerLines.get>> }[];
    const top = (key: "pts" | "reb" | "ast" | "stl" | "blk") =>
      [...rows].sort((a, b) => b.l[key] - a.l[key])[0] ?? null;
    return { pts: top("pts"), reb: top("reb"), ast: top("ast"), stl: top("stl"), blk: top("blk") };
  }, [players.data, playerLines, teamId]);

  const [combo, setCombo] = useState<string[]>([]);
  const roster = useMemo(
    () => (players.data ?? []).filter((p) => p.team_id === teamId),
    [players.data, teamId],
  );
  useEffect(() => setCombo([]), [teamId]);
  const together = useMemo(
    () => lineupStats(games, events, subs, combo),
    [games, events, subs, combo],
  );

  const recent = [...games].sort((a, b) => b.game_date.localeCompare(a.game_date)).slice(0, 8);
  const g = line.games;

  return (
    <AppShell
      title="Team Stats"
      subtitle="Season numbers from saved games only"
      actions={
        <Link to="/stats/players" search={{ team: teamId }}>
          <BubbleButton tone="neutral">Player Stats</BubbleButton>
        </Link>
      }
    >
      <StatsTabs shotCharts="team" />
      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Team</Label>
        {teamsInSeason.map((t) => (
          <BubbleButton
            key={t.id}
            size="sm"
            tone={t.id === teamId ? "grape" : "neutral"}
            onClick={() => setSearch({ team: t.id })}
          >
            {t.name}
          </BubbleButton>
        ))}
        {seasons.length > 1 ? (
          <>
            <Label className="ml-2">Season</Label>
            <BubbleButton
              size="sm"
              tone={season === "ALL" ? "flame" : "neutral"}
              onClick={() => setSearch({ season: undefined })}
            >
              All
            </BubbleButton>
            {seasons.map((s) => (
              <BubbleButton
                key={s}
                size="sm"
                tone={season === s ? "flame" : "neutral"}
                onClick={() => setSearch({ season: s })}
              >
                {s}
              </BubbleButton>
            ))}
          </>
        ) : null}
        {bundle.isLoading ? <Pill tone="muted">Loading…</Pill> : null}
      </Panel>

      {!team ? (
        <EmptyState>No team selected</EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Panel className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-2xl border border-grape/60 bg-grape/20 px-3 py-2 text-xl font-black leading-tight text-foreground sm:text-2xl">
                  {team.name}
                </span>
                <Pill tone="muted">{team.season}</Pill>
                <Pill tone="flame">
                  {line.wins}–{line.losses}
                  {line.ties ? `–${line.ties}` : ""}
                </Pill>
                <Pill tone="muted">{g} saved games</Pill>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <StatTile label="W – L" value={`${line.wins} – ${line.losses}`} tone="grape" />
                <StatTile label="Total points" value={line.pts} tone="flame" />
                <StatTile label="Points / game" value={fmtPer(line.pts, g)} tone="flame" />
                <StatTile label="Opp points / game" value={fmtPer(line.oppPts, g)} />
                <StatTile label="Rebounds / game" value={fmtPer(line.reb, g)} hint={`${line.reb} total`} />
                <StatTile label="Assists / game" value={fmtPer(line.ast, g)} hint={`${line.ast} total`} />
                <StatTile label="Steals / game" value={fmtPer(line.stl, g)} hint={`${line.stl} total`} />
                <StatTile label="Turnovers / game" value={fmtPer(line.to, g)} hint={`${line.to} total`} />
                <StatTile label="Blocks / game" value={fmtPer(line.blk, g)} hint={`${line.blk} total`} />
                <StatTile label="Fouls / game" value={fmtPer(line.pf, g)} hint={`${line.pf} total`} />
                <StatTile label="Opp fouls / game" value={fmtPer(line.oppFouls, g)} hint={`${line.oppFouls} total`} />
                <StatTile label="Margin / game" value={g ? ((line.pts - line.oppPts) / g).toFixed(1) : "—"} />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <StatTile label="FG%" value={fmtPct(line.fg)} hint={fmtSplit(line.fg)} tone="grape" />
                <StatTile label="2PT%" value={fmtPct(line.two)} hint={fmtSplit(line.two)} />
                <StatTile label="3PT%" value={fmtPct(line.three)} hint={fmtSplit(line.three)} />
                <StatTile label="FT%" value={fmtPct(line.ft)} hint={fmtSplit(line.ft)} />
                <StatTile label="Layup / Rim%" value={fmtPct(line.rim)} hint={fmtSplit(line.rim)} />
              </div>
            </Panel>

            <Panel className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Pill tone="grape">Season leaders</Pill>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(
                  [
                    ["Points", leaders.pts, "pts"],
                    ["Rebounds", leaders.reb, "reb"],
                    ["Assists", leaders.ast, "ast"],
                    ["Steals", leaders.stl, "stl"],
                    ["Blocks", leaders.blk, "blk"],
                  ] as const
                ).map(([label, row, key]) => (
                  <StatTile
                    key={label}
                    label={label}
                    value={row ? `#${row.p.jersey}` : "—"}
                    hint={row ? `${row.p.name.split(" ")[0]} · ${row.l[key]}` : "No games"}
                  />
                ))}
              </div>
            </Panel>

            <Panel className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="grape">Player combinations</Pill>
                <Label>Tap two or more players to see them together</Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {roster.map((p) => (
                  <BubbleButton
                    key={p.id}
                    size="sm"
                    tone={combo.includes(p.id) ? "flame" : "neutral"}
                    onClick={() =>
                      setCombo((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id]))
                    }
                  >
                    #{p.jersey} {p.name.split(" ")[0]}
                  </BubbleButton>
                ))}
                {combo.length ? (
                  <BubbleButton size="sm" tone="neutral" onClick={() => setCombo([])}>
                    Clear
                  </BubbleButton>
                ) : null}
              </div>
              {combo.length < 2 ? (
                <Pill tone="muted">Pick at least two players</Pill>
              ) : together.seconds === 0 ? (
                <Pill tone="muted">No shared floor time in saved games yet</Pill>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <StatTile label="Minutes together" value={fmtMinutes(together.seconds)} tone="grape" />
                  <StatTile label="Team points" value={together.pts} tone="flame" />
                  <StatTile label="Opponent points" value={together.oppPts} />
                  <StatTile
                    label="Plus / minus"
                    value={`${together.pts - together.oppPts > 0 ? "+" : ""}${together.pts - together.oppPts}`}
                  />
                  <StatTile label="FG%" value={fmtPct(together.fg)} hint={fmtSplit(together.fg)} />
                  <StatTile label="Rebounds" value={together.reb} />
                  <StatTile label="Assists" value={together.ast} />
                  <StatTile label="Turnovers" value={together.to} />
                </div>
              )}
            </Panel>

            <Panel className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Pill tone="flame">Results</Pill>
                <Label>Most recent first</Label>
              </div>
              {recent.length === 0 ? (
                <EmptyState>No saved games yet</EmptyState>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recent.map((gm) => {
                    const ev = evByGame.get(gm.id) ?? [];
                    const s = gameScore(gm, ev);
                    const r = gameResult(gm, ev);
                    return (
                      <Link
                        key={gm.id}
                        to="/review/$gameId"
                        params={{ gameId: gm.id }}
                        className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-surface-2/60 px-2.5 py-2 hover:border-grape/60"
                      >
                        <Pill tone="muted">{gm.game_date}</Pill>
                        <Pill>vs {gm.opponent}</Pill>
                        <Pill tone="muted">{gm.home_away === "away" ? "Away" : "Home"}</Pill>
                        <Pill tone={r === "W" ? "success" : r === "L" ? "danger" : "muted"}>
                          {r ?? "—"} {s.team}–{s.opp}
                        </Pill>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <Panel className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Pill tone="flame">Team shot chart</Pill>
              <Label>All saved games</Label>
            </div>
            <ShotChart events={events} />
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
