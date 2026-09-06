import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { ShotChart } from "@/components/court/ShotChart";
import { fetchAllPlayers, fetchSeasonBundle, fetchTeams } from "@/lib/data";
import {
  aggregatePlayers,
  emptyPlayerLine,
  fmtMinutes,
  fmtPct,
  fmtPer,
  fmtSplit,
  gameResult,
  gameScore,
  groupByGame,
  playerGameLine,
  seasonsOf,
} from "@/lib/stats";

type Search = { team?: string; player?: string; season?: string };

export const Route = createFileRoute("/_authenticated/stats/players")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.team === "string" && s.team ? { team: s.team } : {}),
    ...(typeof s.player === "string" && s.player ? { player: s.player } : {}),
    ...(typeof s.season === "string" && s.season ? { season: s.season } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Player Stats — CourtSide Coach" },
      {
        name: "description",
        content: "Season totals, per-game averages, shooting splits and shot chart for every player.",
      },
      { property: "og:title", content: "Player Stats — CourtSide Coach" },
      { property: "og:description", content: "Per-player season stats and shot chart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayerStatsPage,
});

function PlayerStatsPage() {
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
  const teamId = search.team && teamsInSeason.some((t) => t.id === search.team) ? search.team : teamsInSeason[0]?.id;

  useEffect(() => {
    if (!search.team && teamId) setSearch({ team: teamId });
  }, [search.team, teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const teamPlayers = useMemo(
    () => (players.data ?? []).filter((p) => p.team_id === teamId),
    [players.data, teamId],
  );
  const playerId =
    search.player && teamPlayers.some((p) => p.id === search.player)
      ? search.player
      : teamPlayers[0]?.id;
  const player = teamPlayers.find((p) => p.id === playerId) ?? null;

  const teamGames = useMemo(
    () => (bundle.data?.games ?? []).filter((g) => g.team_id === teamId),
    [bundle.data, teamId],
  );
  const gameIds = useMemo(() => new Set(teamGames.map((g) => g.id)), [teamGames]);
  const teamEvents = useMemo(
    () => (bundle.data?.events ?? []).filter((e) => gameIds.has(e.game_id)),
    [bundle.data, gameIds],
  );
  const teamSubs = useMemo(
    () => (bundle.data?.subs ?? []).filter((s) => gameIds.has(s.game_id)),
    [bundle.data, gameIds],
  );

  const lines = useMemo(
    () => aggregatePlayers(teamGames, teamEvents, teamSubs),
    [teamGames, teamEvents, teamSubs],
  );
  const line = (playerId && lines.get(playerId)) || emptyPlayerLine(playerId ?? "");
  const playerEvents = useMemo(
    () => teamEvents.filter((e) => e.player_id === playerId),
    [teamEvents, playerId],
  );
  const evByGame = useMemo(() => groupByGame(teamEvents), [teamEvents]);
  const recent = useMemo(
    () =>
      [...teamGames]
        .sort((a, b) => b.game_date.localeCompare(a.game_date))
        .map((g) => {
          const ev = evByGame.get(g.id) ?? [];
          const pl = playerId ? playerGameLine(playerId, g, ev, teamSubs) : null;
          return { g, ev, pl };
        })
        .filter((r) => r.pl && (r.pl.games > 0))
        .slice(0, 10),
    [teamGames, evByGame, playerId, teamSubs],
  );

  const teamName = (id: string) => teams.data?.find((t) => t.id === id)?.name ?? "Team";

  return (
    <AppShell
      title="Player Stats"
      subtitle="Everything below is computed from saved games"
      actions={
        <Link to="/stats/team" search={{ team: teamId }}>
          <BubbleButton tone="neutral">Team Stats</BubbleButton>
        </Link>
      }
    >
      <Panel className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Team</Label>
          {teamsInSeason.map((t) => (
            <BubbleButton
              key={t.id}
              size="sm"
              tone={t.id === teamId ? "grape" : "neutral"}
              onClick={() => setSearch({ team: t.id, player: undefined })}
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label>Player</Label>
          {players.isLoading ? <Pill tone="muted">Loading…</Pill> : null}
          {teamPlayers.map((p) => (
            <BubbleButton
              key={p.id}
              size="sm"
              tone={p.id === playerId ? "flame" : "neutral"}
              className={!p.active ? "opacity-60" : undefined}
              onClick={() => setSearch({ player: p.id })}
            >
              #{p.jersey} {p.name.split(" ")[0]}
            </BubbleButton>
          ))}
          {!players.isLoading && teamPlayers.length === 0 ? (
            <Pill tone="muted">No players on this team</Pill>
          ) : null}
        </div>
      </Panel>

      {!player ? (
        <EmptyState>Pick a player to see their season</EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Panel className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-grape/60 bg-grape/25 text-xl font-black text-foreground">
                  {player.jersey}
                </span>
                <span className="rounded-2xl border border-border bg-surface-2/80 px-3 py-2 text-base font-black text-foreground">
                  {player.name}
                </span>
                <Pill tone="grape">{teamName(player.team_id)}</Pill>
                {player.position ? <Pill tone="muted">{player.position}</Pill> : null}
                {!player.active ? <Pill tone="danger">Inactive</Pill> : null}
                {bundle.isLoading ? <Pill tone="muted">Loading games…</Pill> : null}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <StatTile label="Games" value={line.games} tone="grape" />
                <StatTile label="Starts" value={line.starts} />
                <StatTile label="Minutes" value={fmtMinutes(line.seconds)} hint={line.games ? `${fmtMinutes(Math.round(line.seconds / line.games))} / game` : undefined} />
                <StatTile label="Total points" value={line.pts} tone="flame" />
                <StatTile label="PPG" value={fmtPer(line.pts, line.games)} tone="flame" />
                <StatTile label="Rebounds" value={line.reb} hint={`${fmtPer(line.reb, line.games)} / game`} />
                <StatTile label="Assists" value={line.ast} hint={`${fmtPer(line.ast, line.games)} / game`} />
                <StatTile label="Steals" value={line.stl} hint={`${fmtPer(line.stl, line.games)} / game`} />
                <StatTile label="Blocks" value={line.blk} hint={`${fmtPer(line.blk, line.games)} / game`} />
                <StatTile label="Turnovers" value={line.to} hint={`${fmtPer(line.to, line.games)} / game`} />
                <StatTile label="Fouls" value={line.pf} hint={`${fmtPer(line.pf, line.games)} / game`} />
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
                <Pill tone="grape">Recent games</Pill>
                <Label>Most recent first</Label>
              </div>
              {recent.length === 0 ? (
                <EmptyState>No saved games with this player yet</EmptyState>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recent.map(({ g, ev, pl }) => {
                    const s = gameScore(g, ev);
                    const r = gameResult(g, ev);
                    return (
                      <Link
                        key={g.id}
                        to="/review/$gameId"
                        params={{ gameId: g.id }}
                        className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-surface-2/60 px-2.5 py-2 hover:border-grape/60"
                      >
                        <Pill tone="muted">{g.game_date}</Pill>
                        <Pill>vs {g.opponent}</Pill>
                        <Pill tone={r === "W" ? "success" : r === "L" ? "danger" : "muted"}>
                          {r ?? "—"} {s.team}–{s.opp}
                        </Pill>
                        <Pill tone="flame">{pl!.pts} pts</Pill>
                        <Pill tone="muted">{pl!.reb} reb</Pill>
                        <Pill tone="muted">{pl!.ast} ast</Pill>
                        <Pill tone="muted">{fmtSplit(pl!.fg)} FG</Pill>
                        <Pill tone="muted">{fmtMinutes(pl!.seconds)}</Pill>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <Panel className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Pill tone="flame">Shot chart</Pill>
              <Label>Season · #{player.jersey}</Label>
            </div>
            <ShotChart events={playerEvents} />
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
