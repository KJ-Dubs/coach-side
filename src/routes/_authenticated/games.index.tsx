import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatsTabs } from "@/components/StatsTabs";
import { BubbleButton, EmptyState, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { fetchSeasonBundle, fetchTeams } from "@/lib/data";
import {
  aggregateTeam,
  fmtPct,
  fmtSplit,
  gameResult,
  gameScore,
  groupByGame,
  seasonsOf,
} from "@/lib/stats";
import type { Game } from "@/lib/types";
import { ShareGameButton } from "@/components/game/ShareGameButton";

export const Route = createFileRoute("/_authenticated/games/")({
  head: () => ({
    meta: [
      { title: "Game History — CoachSide" },
      {
        name: "description",
        content: "Season record, shooting splits and every saved game with final score and review.",
      },
      { property: "og:title", content: "Game History — CoachSide" },
      { property: "og:description", content: "Season record and every saved game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const bundle = useQuery({
    queryKey: ["season-bundle", "all"],
    queryFn: () => fetchSeasonBundle({ finalOnly: false }),
  });
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [season, setSeason] = useState<string>("ALL");

  const teamName = (id: string) => teams.data?.find((t) => t.id === id)?.name ?? "Team";
  const seasons = seasonsOf(teams.data ?? []);
  const teamIdsInSeason = useMemo(
    () =>
      new Set(
        (teams.data ?? [])
          .filter((t) => season === "ALL" || t.season === season)
          .map((t) => t.id),
      ),
    [teams.data, season],
  );

  const games = useMemo(
    () =>
      (bundle.data?.games ?? []).filter(
        (g) =>
          (teamFilter === "ALL" || g.team_id === teamFilter) && teamIdsInSeason.has(g.team_id),
      ),
    [bundle.data, teamFilter, teamIdsInSeason],
  );
  const finals = games.filter((g) => g.status === "final");
  const live = games.filter((g) => g.status !== "final");
  const finalIds = new Set(finals.map((g) => g.id));
  const finalEvents = (bundle.data?.events ?? []).filter((e) => finalIds.has(e.game_id));
  const evByGame = groupByGame(bundle.data?.events ?? []);
  const team = aggregateTeam(finals, finalEvents);

  const sortedFinals = [...finals].sort(
    (a, b) => b.game_date.localeCompare(a.game_date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );

  const label = teamFilter === "ALL" ? "All teams" : teamName(teamFilter);

  return (
    <AppShell
      title="Game History"
      subtitle="Saved games feed team and player stats automatically"
      actions={
        <Link to="/games/new">
          <BubbleButton tone="flame">+ Start Game</BubbleButton>
        </Link>
      }
    >
      <StatsTabs />
      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Team</Label>
        <BubbleButton
          size="sm"
          tone={teamFilter === "ALL" ? "grape" : "neutral"}
          onClick={() => setTeamFilter("ALL")}
        >
          All teams
        </BubbleButton>
        {teams.data
          ?.filter((t) => teamIdsInSeason.has(t.id))
          .map((t) => (
            <BubbleButton
              key={t.id}
              size="sm"
              tone={teamFilter === t.id ? "grape" : "neutral"}
              onClick={() => setTeamFilter(t.id)}
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
              onClick={() => setSeason("ALL")}
            >
              All
            </BubbleButton>
            {seasons.map((s) => (
              <BubbleButton
                key={s}
                size="sm"
                tone={season === s ? "flame" : "neutral"}
                onClick={() => setSeason(s)}
              >
                {s}
              </BubbleButton>
            ))}
          </>
        ) : null}
      </Panel>

      <Panel className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="grape">{label}</Pill>
          <Pill tone="muted">{finals.length} saved games</Pill>
          {bundle.isLoading ? <Pill tone="muted">Loading…</Pill> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <StatTile label="Wins" value={team.wins} tone="grape" />
          <StatTile label="Losses" value={team.losses} tone="flame" />
          <StatTile label="Total points" value={team.pts} />
          <StatTile label="FG%" value={fmtPct(team.fg)} hint={fmtSplit(team.fg)} />
          <StatTile label="3PT%" value={fmtPct(team.three)} hint={fmtSplit(team.three)} />
          <StatTile label="FT%" value={fmtPct(team.ft)} hint={fmtSplit(team.ft)} />
          <StatTile label="Layup / Rim%" value={fmtPct(team.rim)} hint={fmtSplit(team.rim)} />
        </div>
      </Panel>

      {live.length ? (
        <Panel className="mb-3 flex flex-col gap-2 border-flame/50">
          <div className="flex items-center gap-2">
            <Pill tone="flame">In progress</Pill>
            <Label>Not counted in stats until saved</Label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((g) => (
              <GameCard key={g.id} game={g} teamName={teamName(g.team_id)} events={evByGame.get(g.id) ?? []} />
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!bundle.isLoading && sortedFinals.length === 0 ? (
          <EmptyState className="sm:col-span-2 lg:col-span-3">
            No saved games yet — finish a live game to see it here
          </EmptyState>
        ) : null}
        {sortedFinals.map((g) => (
          <GameCard key={g.id} game={g} teamName={teamName(g.team_id)} events={evByGame.get(g.id) ?? []} />
        ))}
      </div>
    </AppShell>
  );
}

function GameCard({
  game: g,
  teamName,
  events,
}: {
  game: Game;
  teamName: string;
  events: Parameters<typeof gameScore>[1];
}) {
  const score = gameScore(g, events);
  const result = gameResult(g, events);
  const isFinal = g.status === "final";
  const navigate = useNavigate();
  const coachQ = useQuery({
    queryKey: ["is-team-coach", g.team_id],
    queryFn: async () => (await supabase.rpc("is_team_coach", { _team: g.team_id })).data === true,
    enabled: isFinal,
    staleTime: 60_000,
  });
  const canEditStats = coachQ.data === true;
  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="grape">{teamName}</Pill>
        <Pill>vs {g.opponent}</Pill>
        <Pill tone="muted">{g.home_away === "away" ? "Away" : "Home"}</Pill>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="muted">{g.game_date}</Pill>
        {isFinal ? (
          <>
            <Pill tone={result === "W" ? "success" : result === "L" ? "danger" : "muted"}>
              {result === "W" ? "WIN" : result === "L" ? "LOSS" : "TIE"}
            </Pill>
            <Pill tone="flame">
              {score.team} – {score.opp}
            </Pill>
          </>
        ) : (
          <>
            <Pill tone="flame">Live</Pill>
            <Pill tone="muted">
              {score.team} – {score.opp}
            </Pill>
          </>
        )}
        <Pill tone="muted">
          {g.periods} × {g.period_minutes}
        </Pill>
      </div>
      <div className="flex flex-wrap gap-2">
        {isFinal ? (
          <BubbleButton
            tone="grape"
            size="sm"
            onClick={() => navigate({ to: "/review/$gameId", params: { gameId: g.id } })}
          >
            View Game Review
          </BubbleButton>
        ) : null}
        {isFinal && canEditStats ? (
          <BubbleButton
            tone="flame"
            size="sm"
            onClick={() => navigate({ to: "/review/$gameId", params: { gameId: g.id }, search: { edit: true } })}
          >
            Edit Game Stats
          </BubbleButton>
        ) : null}
        {isFinal && canEditStats ? <ShareGameButton gameId={g.id} /> : null}
        {isFinal ? null : (
          <>
            <BubbleButton
              tone="flame"
              size="sm"
              onClick={() => navigate({ to: "/game/$gameId", params: { gameId: g.id } })}
            >
              Resume live court
            </BubbleButton>
            <BubbleButton
              tone="neutral"
              size="sm"
              onClick={() => navigate({ to: "/review/$gameId", params: { gameId: g.id } })}
            >
              Review so far
            </BubbleButton>
          </>
        )}
      </div>
    </Panel>
  );
}
