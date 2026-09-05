import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { fetchGames, fetchTeams } from "@/lib/data";

export const Route = createFileRoute("/games/")({
  head: () => ({
    meta: [
      { title: "Games — CourtFlow Coach" },
      {
        name: "description",
        content:
          "Every game for every roster: run live stats, review shot charts and export PDF reports.",
      },
      { property: "og:title", content: "Games — CourtFlow Coach" },
      {
        property: "og:description",
        content: "Run live stats, review shot charts and export PDF reports.",
      },
    ],
  }),
  component: GamesPage,
});

function GamesPage() {
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [teamFilter, setTeamFilter] = useState<string | "ALL">("ALL");
  const teamName = (id: string) => teams.data?.find((t) => t.id === id)?.name ?? "Team";

  const list = (games.data ?? []).filter((g) => teamFilter === "ALL" || g.team_id === teamFilter);

  return (
    <AppShell
      title="Game Center"
      subtitle="Tap a game to run live stats or review it"
      actions={
        <Link to="/games/new">
          <BubbleButton tone="flame">+ New Game</BubbleButton>
        </Link>
      }
    >
      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Roster</Label>
        <BubbleButton
          size="sm"
          tone={teamFilter === "ALL" ? "grape" : "neutral"}
          onClick={() => setTeamFilter("ALL")}
        >
          All teams
        </BubbleButton>
        {teams.data?.map((t) => (
          <BubbleButton
            key={t.id}
            size="sm"
            tone={teamFilter === t.id ? "grape" : "neutral"}
            onClick={() => setTeamFilter(t.id)}
          >
            {t.name}
          </BubbleButton>
        ))}
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {games.isLoading ? (
          <Panel>
            <Label>Loading games</Label>
          </Panel>
        ) : null}
        {!games.isLoading && list.length === 0 ? (
          <Panel>
            <Label>No games yet — create one to get started</Label>
          </Panel>
        ) : null}
        {list.map((g) => (
          <Panel key={g.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="grape">{teamName(g.team_id)}</Pill>
              <Pill tone="muted">vs {g.opponent}</Pill>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill>{g.game_date}</Pill>
              <Pill tone={g.status === "final" ? "muted" : "flame"}>
                {g.status === "final" ? "Final" : "Live"}
              </Pill>
              {g.status === "final" ? (
                <Pill tone="grape">
                  {g.team_score} – {g.opp_score}
                </Pill>
              ) : null}
              <Pill tone="muted">
                {g.periods} × {g.period_minutes} min
              </Pill>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/game/$gameId" params={{ gameId: g.id }}>
                <BubbleButton tone="grape" size="sm">
                  Live Court
                </BubbleButton>
              </Link>
              <Link to="/review/$gameId" params={{ gameId: g.id }}>
                <BubbleButton tone="neutral" size="sm">
                  Review & PDF
                </BubbleButton>
              </Link>
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
