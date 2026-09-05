import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { fetchGames, fetchTeams } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Games — CourtFlow Coach" },
      {
        name: "description",
        content:
          "Start a live game, track stats from the court, and review shot charts with CourtFlow Coach.",
      },
      { property: "og:title", content: "Games — CourtFlow Coach" },
      {
        property: "og:description",
        content: "Start a live game and track basketball stats straight from the court.",
      },
    ],
  }),
  component: GamesPage,
});

function GamesPage() {
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const teamName = (id: string) => teams.data?.find((t) => t.id === id)?.name ?? "Team";

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {games.isLoading ? (
          <Panel>
            <Label>Loading games</Label>
          </Panel>
        ) : null}
        {games.data?.length === 0 ? (
          <Panel>
            <Label>No games yet — create one to get started</Label>
          </Panel>
        ) : null}
        {games.data?.map((g) => (
          <Panel key={g.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="grape">{teamName(g.team_id)}</Pill>
              <Pill tone="muted">vs {g.opponent}</Pill>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill>{g.game_date}</Pill>
              <Pill tone={g.status === "live" ? "flame" : "muted"}>
                {g.status === "live" ? "Live" : g.status}
              </Pill>
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
                  Review
                </BubbleButton>
              </Link>
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
