import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  Field,
  Label,
  Note,
  Panel,
  Pill,
  TextInput,
} from "@/components/Bubbles";
import { createGame, fetchPlayers, fetchTeams, updateTeamEvent } from "@/lib/data";
import { cn } from "@/lib/utils";

type NewGameSearch = {
  team?: string | undefined;
  opponent?: string | undefined;
  homeAway?: string | undefined;
  date?: string | undefined;
  eventId?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/games/new")({
  validateSearch: (search: Record<string, unknown>): NewGameSearch => ({
    team: typeof search['team'] === "string" ? search['team'] : undefined,
    opponent: typeof search['opponent'] === "string" ? search['opponent'] : undefined,
    homeAway: search['homeAway'] === "away" ? "away" : undefined,
    date: typeof search['date'] === "string" ? search['date'] : undefined,
    eventId: typeof search['eventId'] === "string" ? search['eventId'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Start a Game — CoachSide" },
      {
        name: "description",
        content: "Choose the team, opponent, starting five and period rules, then tip off live stats.",
      },
      { property: "og:title", content: "Start a Game — CoachSide" },
      { property: "og:description", content: "Set up a basketball game and run live stats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewGamePage,
});

const PERIOD_PRESETS = [6, 7, 8, 10, 12, 16, 18, 20];
const OT_PRESETS = [3, 4, 5];

function StepCard({
  step,
  title,
  done,
  children,
  className,
}: {
  step: string;
  title: string;
  done?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("flex flex-col gap-3", done && "border-grape/50", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black",
            done
              ? "border-grape bg-grape text-primary-foreground"
              : "border-flame/70 bg-flame/20 text-foreground",
          )}
        >
          {step}
        </span>
        <span className="rounded-2xl border border-border bg-surface-2/80 px-3 py-1.5 text-sm font-black text-foreground">
          {title}
        </span>
        {done ? <Pill tone="grape">✓ Set</Pill> : null}
      </div>
      {children}
    </Panel>
  );
}

function NewGamePage() {
  const navigate = useNavigate();
  const prefill = Route.useSearch();
  const qc = useQueryClient();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [teamId, setTeamId] = useState<string>("");
  const team = teams.data?.find((t) => t.id === teamId) ?? null;

  useEffect(() => {
    if (teamId) return;
    if (prefill.team && teams.data?.some((t) => t.id === prefill.team)) {
      setTeamId(prefill.team);
      return;
    }
    if (teams.data?.length === 1) setTeamId(teams.data[0]!.id);
  }, [teams.data, teamId, prefill.team]);

  const players = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => fetchPlayers(teamId),
    enabled: !!teamId,
  });

  const [opponent, setOpponent] = useState(prefill.opponent ?? "");
  const [date, setDate] = useState(
    () => prefill.date ?? new Date().toISOString().slice(0, 10),
  );
  const [homeAway, setHomeAway] = useState<"home" | "away">(
    prefill.homeAway === "away" ? "away" : "home",
  );
  const [five, setFive] = useState<string[]>([]);
  const [periods, setPeriods] = useState(4);
  const [minutes, setMinutes] = useState(8);
  const [customMin, setCustomMin] = useState("");
  const [ot, setOt] = useState(4);

  // Team defaults drive the rules step once a team is chosen.
  useEffect(() => {
    if (!team) return;
    setPeriods(team.default_periods ?? 4);
    setMinutes(team.default_period_minutes ?? 8);
    setOt(team.default_overtime_minutes ?? 4);
    setFive([]);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activePlayers = useMemo(
    () => (players.data ?? []).filter((p) => p.active),
    [players.data],
  );

  const toggle = (id: string) =>
    setFive((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < 5 ? [...prev, id] : prev,
    );

  const stepA = !!teamId;
  const stepB = opponent.trim().length > 0 && !!date;
  const stepC = five.length === 5;
  const stepD = minutes > 0 && ot > 0;
  const ready = stepA && stepB && stepC && stepD;

  const create = useMutation({
    mutationFn: () =>
      createGame({
        team_id: teamId,
        opponent: opponent.trim(),
        game_date: date,
        periods,
        period_minutes: minutes,
        starting_five: five,
        home_away: homeAway,
        overtime_minutes: ot,
      }),
    onSuccess: (g) => {
      void qc.invalidateQueries({ queryKey: ["games"] });
      if (prefill.eventId) {
        void updateTeamEvent(prefill.eventId, { game_id: g.id }).then(() =>
          qc.invalidateQueries({ queryKey: ["team-events", g.team_id] }),
        );
      }
      navigate({ to: "/game/$gameId", params: { gameId: g.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Start a Game" subtitle="Five quick steps, then the live court">
      <div className="grid gap-3 lg:grid-cols-2">
        <StepCard step="A" title="Which team?" done={stepA}>
          {teams.isLoading ? (
            <EmptyState>Loading teams…</EmptyState>
          ) : teams.data?.length ? (
            <div className="flex flex-wrap gap-2">
              {teams.data.map((t) => (
                <BubbleButton
                  key={t.id}
                  size="md"
                  tone={t.id === teamId ? "grape" : "neutral"}
                  onClick={() => setTeamId(t.id)}
                >
                  {t.name}
                  <Pill tone="muted">{t.season}</Pill>
                </BubbleButton>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <EmptyState>No teams yet</EmptyState>
              <BubbleButton tone="flame" onClick={() => navigate({ to: "/roster" })}>
                + Add a team in Rosters
              </BubbleButton>
            </div>
          )}
        </StepCard>

        <StepCard step="B" title="Opponent, date & venue" done={stepB}>
          <Field label="Opponent">
            <TextInput
              placeholder="Opponent name"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Venue">
            <div className="flex gap-2">
              {(["home", "away"] as const).map((v) => (
                <BubbleButton
                  key={v}
                  tone={homeAway === v ? "flame" : "neutral"}
                  onClick={() => setHomeAway(v)}
                >
                  {v === "home" ? "Home" : "Away"}
                </BubbleButton>
              ))}
            </div>
          </Field>
        </StepCard>

        <StepCard step="C" title="Starting five" done={stepC}>
          <div className="flex items-center gap-2">
            <Label>Tap exactly five</Label>
            <Pill tone={five.length === 5 ? "grape" : "flame"}>{five.length} / 5</Pill>
          </div>
          {!teamId ? (
            <EmptyState>Pick a team first</EmptyState>
          ) : players.isLoading ? (
            <EmptyState>Loading roster…</EmptyState>
          ) : activePlayers.length === 0 ? (
            <div className="flex flex-col gap-2">
              <EmptyState>This team has no active players</EmptyState>
              <BubbleButton tone="flame" onClick={() => navigate({ to: "/roster" })}>
                + Add players
              </BubbleButton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activePlayers.map((p) => {
                const on = five.includes(p.id);
                return (
                  <BubbleButton
                    key={p.id}
                    size="md"
                    tone={on ? "grape" : "neutral"}
                    disabled={!on && five.length >= 5}
                    onClick={() => toggle(p.id)}
                    className="min-w-[96px]"
                  >
                    <span className="text-base font-black">#{p.jersey}</span>
                    <span className="text-xs font-semibold">{p.name.split(" ")[0]}</span>
                  </BubbleButton>
                );
              })}
            </div>
          )}
          {activePlayers.length > 0 && activePlayers.length < 5 ? (
            <Note tone="flame">You need at least five active players to start.</Note>
          ) : null}
        </StepCard>

        <StepCard step="D" title="Rules" done={stepD}>
          <Field label="Structure">
            <div className="flex gap-2">
              {[4, 2].map((p) => (
                <BubbleButton
                  key={p}
                  tone={periods === p ? "flame" : "neutral"}
                  onClick={() => setPeriods(p)}
                >
                  {p === 2 ? "2 Halves" : "4 Quarters"}
                </BubbleButton>
              ))}
            </div>
          </Field>
          <Field label={`${periods === 2 ? "Half" : "Quarter"} length`}>
            <div className="flex flex-wrap items-center gap-2">
              {PERIOD_PRESETS.map((m) => (
                <BubbleButton
                  key={m}
                  size="sm"
                  tone={minutes === m && !customMin ? "grape" : "neutral"}
                  onClick={() => {
                    setMinutes(m);
                    setCustomMin("");
                  }}
                >
                  {m} min
                </BubbleButton>
              ))}
              <div className="flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-1">
                <Label>Custom</Label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={customMin}
                  placeholder="min"
                  onChange={(e) => {
                    setCustomMin(e.target.value);
                    const n = Number(e.target.value);
                    if (n > 0 && n <= 30) setMinutes(n);
                  }}
                  className="w-14 rounded-full border border-input bg-surface px-2 py-1 text-center text-xs font-bold text-foreground outline-none focus:border-grape"
                />
              </div>
            </div>
          </Field>
          <Field label="Overtime length">
            <div className="flex flex-wrap gap-2">
              {OT_PRESETS.map((m) => (
                <BubbleButton
                  key={m}
                  size="sm"
                  tone={ot === m ? "grape" : "neutral"}
                  onClick={() => setOt(m)}
                >
                  {m} min
                </BubbleButton>
              ))}
            </div>
          </Field>
        </StepCard>

        <StepCard step="E" title="Tip off" done={false} className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={stepA ? "grape" : "muted"}>{team?.name ?? "Team"}</Pill>
            <Pill tone={stepB ? "grape" : "muted"}>
              {opponent.trim() ? `vs ${opponent.trim()}` : "Opponent"} · {homeAway === "home" ? "Home" : "Away"}
            </Pill>
            <Pill tone="muted">{date}</Pill>
            <Pill tone={stepC ? "grape" : "muted"}>{five.length}/5 starters</Pill>
            <Pill tone="muted">
              {periods} × {minutes} min · OT {ot}
            </Pill>
          </div>
          <BubbleButton
            tone="flame"
            size="lg"
            className="w-full sm:w-auto"
            disabled={!ready || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Starting…" : "START GAME ▶"}
          </BubbleButton>
          {!ready ? <Note>Finish steps A–D to enable the start button.</Note> : null}
        </StepCard>
      </div>
    </AppShell>
  );
}
