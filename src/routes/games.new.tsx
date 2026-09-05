import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { DEMO_TEAM_ID, createGame, fetchPlayers, fetchTeams } from "@/lib/data";

export const Route = createFileRoute("/games/new")({
  head: () => ({
    meta: [
      { title: "New Game — CourtFlow Coach" },
      {
        name: "description",
        content: "Set the opponent, date, period structure and starting five for a new game.",
      },
      { property: "og:title", content: "New Game — CourtFlow Coach" },
      {
        property: "og:description",
        content: "Set opponent, date, periods and starting five before tip-off.",
      },
    ],
  }),
  component: NewGamePage,
});

function NewGamePage() {
  const navigate = useNavigate();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [teamId, setTeamId] = useState(DEMO_TEAM_ID);
  const players = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => fetchPlayers(teamId),
  });

  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [periods, setPeriods] = useState(4);
  const [minutes, setMinutes] = useState(8);
  const [five, setFive] = useState<string[]>([]);

  const toggle = (id: string) =>
    setFive((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < 5 ? [...prev, id] : prev,
    );

  const create = useMutation({
    mutationFn: () =>
      createGame({
        team_id: teamId,
        opponent,
        game_date: date,
        periods,
        period_minutes: minutes,
        starting_five: five,
      }),
    onSuccess: (g) => navigate({ to: "/game/$gameId", params: { gameId: g.id } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const inputCls =
    "w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-grape";

  return (
    <AppShell title="New Game" subtitle="Opponent, rules and starting five">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="flex flex-col gap-3">
          <Label>Team</Label>
          <div className="flex flex-wrap gap-2">
            {teams.data?.map((t) => (
              <BubbleButton
                key={t.id}
                size="sm"
                tone={t.id === teamId ? "grape" : "neutral"}
                onClick={() => {
                  setTeamId(t.id);
                  setFive([]);
                }}
              >
                {t.name}
              </BubbleButton>
            ))}
          </div>
          <Label>Opponent</Label>
          <input
            className={inputCls}
            placeholder="Opponent name"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
          />
          <Label>Date</Label>
          <input
            type="date"
            className={inputCls}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Label>Period structure</Label>
          <div className="flex flex-wrap gap-2">
            {[2, 4].map((p) => (
              <BubbleButton
                key={p}
                size="sm"
                tone={periods === p ? "flame" : "neutral"}
                onClick={() => setPeriods(p)}
              >
                {p === 2 ? "2 Halves" : "4 Quarters"}
              </BubbleButton>
            ))}
            {[6, 8, 10, 12, 16, 20].map((m) => (
              <BubbleButton
                key={m}
                size="sm"
                tone={minutes === m ? "grape" : "neutral"}
                onClick={() => setMinutes(m)}
              >
                {m} min
              </BubbleButton>
            ))}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Label>Starting five</Label>
            <Pill tone={five.length === 5 ? "flame" : "muted"}>{five.length} / 5</Pill>
          </div>
          <div className="flex flex-wrap gap-2">
            {players.data
              ?.filter((p) => p.active)
              .map((p) => (
                <BubbleButton
                  key={p.id}
                  size="sm"
                  tone={five.includes(p.id) ? "grape" : "neutral"}
                  onClick={() => toggle(p.id)}
                >
                  #{p.jersey} {p.name.split(" ")[0]}
                </BubbleButton>
              ))}
          </div>
          <BubbleButton
            tone="flame"
            size="lg"
            disabled={!opponent || five.length !== 5 || create.isPending}
            onClick={() => create.mutate()}
          >
            Tip Off
          </BubbleButton>
        </Panel>
      </div>
    </AppShell>
  );
}
