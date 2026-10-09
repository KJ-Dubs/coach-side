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
import { createGame, fetchGames, fetchPlayers, fetchTeams, updateTeam, updateTeamEvent } from "@/lib/data";
import {
  BONUS_PRESETS,
  DEFAULT_RULES,
  FULL_TRACKING,
  SCORE_ONLY_TRACKING,
  TRACKING_LABELS,
  normalizeRules,
  normalizeTracking,
  type BonusRule,
  type RulesConfig,
  type TrackingConfig,
} from "@/lib/gameConfig";
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
      <div className="flex flex-col items-center gap-2 text-center">
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
        <span className="text-xl font-black leading-tight text-foreground sm:text-2xl">
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

  // An unfinished game must be resumed, never silently duplicated.
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });
  const liveGames = useMemo(
    () => (games.data ?? []).filter((g) => g.status !== "final"),
    [games.data],
  );
  const liveForTeam = useMemo(
    () => liveGames.filter((g) => !teamId || g.team_id === teamId),
    [liveGames, teamId],
  );
  const resumeGame = liveForTeam[0] ?? null;
  // A scheduled calendar game that already has a live game resumes that one.
  const scheduledLive = useMemo(() => {
    if (!prefill.opponent) return null;
    const want = prefill.opponent.trim().toLowerCase();
    return (
      liveForTeam.find(
        (g) => g.opponent.trim().toLowerCase() === want && (!prefill.date || g.game_date === prefill.date),
      ) ?? null
    );
  }, [liveForTeam, prefill.opponent, prefill.date]);

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
  const [tracking, setTracking] = useState<TrackingConfig>({ ...FULL_TRACKING });
  const [rules, setRules] = useState<RulesConfig>({ ...DEFAULT_RULES });
  const [advanced, setAdvanced] = useState(false);
  const [saveDefaults, setSaveDefaults] = useState(false);

  // Team defaults drive the rules step once a team is chosen.
  useEffect(() => {
    if (!team) return;
    setPeriods(team.default_periods ?? 4);
    setMinutes(team.default_period_minutes ?? 8);
    setOt(team.default_overtime_minutes ?? 4);
    const d = (team.default_game_config ?? null) as { tracking?: unknown; rules?: unknown } | null;
    setTracking(normalizeTracking(d?.tracking));
    setRules(normalizeRules(d?.rules));
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
  const stepD = !tracking.clock || (minutes > 0 && ot > 0 && periods > 0);
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
        stat_tracking_config: tracking,
        rules_config: rules,
      }),
    onSuccess: (g) => {
      if (saveDefaults) {
        void updateTeam(g.team_id, {
          default_periods: periods,
          default_period_minutes: minutes,
          default_overtime_minutes: ot,
          default_game_config: { tracking, rules },
        })
          .then(() => qc.invalidateQueries({ queryKey: ["teams"] }))
          .catch(() => toast.error("Game started, but team defaults could not be saved"));
      }
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
    <AppShell title="Start a Game" subtitle="Five quick steps, then the live court" backTo="/tools" backLabel="Tools">
      {resumeGame ? (
        <Panel className="mb-3 flex flex-col items-center gap-3 border-flame/60">
          <span className="text-xl font-black leading-tight text-foreground">
            Game already in progress
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            <Pill tone="grape">{teams.data?.find((t) => t.id === resumeGame.team_id)?.name ?? "Team"}</Pill>
            <Pill tone="flame">vs {resumeGame.opponent}</Pill>
            <Pill tone="muted">
              {resumeGame.team_score} – {resumeGame.opp_score}
            </Pill>
            <Pill tone="muted">
              {resumeGame.periods === 2 ? "Half" : "Quarter"} {resumeGame.quarter}
            </Pill>
            <Pill tone="muted">{resumeGame.game_date}</Pill>
          </div>
          <BubbleButton
            tone="flame"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() =>
              navigate({
                to: "/game/$gameId",
                params: { gameId: (scheduledLive ?? resumeGame).id },
              })
            }
          >
            ▶ Continue Current Game
          </BubbleButton>
          <Note>Or set up a brand-new game below.</Note>
        </Panel>
      ) : null}

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
            <div className="flex flex-wrap items-center gap-2">
              {[4, 2].map((p) => (
                <BubbleButton
                  key={p}
                  tone={periods === p ? "flame" : "neutral"}
                  onClick={() => setPeriods(p)}
                >
                  {p === 2 ? "2 Halves" : "4 Quarters"}
                </BubbleButton>
              ))}
              <div className={cn("flex items-center gap-1 rounded-full border bg-surface-2 px-2 py-1", periods !== 2 && periods !== 4 ? "border-flame" : "border-border")}>
                <Label>Custom</Label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={periods !== 2 && periods !== 4 ? periods : ""}
                  placeholder="#"
                  aria-label="Custom number of periods"
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (n >= 1 && n <= 8) setPeriods(n);
                  }}
                  className="w-12 rounded-full border border-input bg-surface px-2 py-1 text-center text-xs font-bold text-foreground outline-none focus:border-grape"
                />
              </div>
            </div>
          </Field>
          <Toggle on={tracking.clock} label="Track game clock" onClick={() => setTracking({ ...tracking, clock: !tracking.clock })} />
          {tracking.clock ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-grape/40 bg-surface-2/40 p-2 bubble-pop">
          <Label>Clock rules</Label>
          <Field label={`${periods === 2 ? "Half" : periods === 4 ? "Quarter" : "Period"} length`}>
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
          </div>
          ) : null}
          <AdvancedRules
            open={advanced}
            onToggle={() => setAdvanced((v) => !v)}
            tracking={tracking}
            setTracking={setTracking}
            rules={rules}
            setRules={setRules}
            saveDefaults={saveDefaults}
            setSaveDefaults={setSaveDefaults}
            canSaveDefaults={!!teamId}
          />
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
              {tracking.clock ? `${periods} × ${minutes} min · OT ${ot}` : `${periods} periods · no clock`}
            </Pill>
          </div>
          <div className="flex justify-center"><BubbleButton
            tone="flame"
            size="lg"
            className="w-full sm:w-auto"
            disabled={!ready || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Starting…" : "START GAME ▶"}
          </BubbleButton></div>
          {!ready ? <Note>Finish steps A–D to enable the start button.</Note> : null}
        </StepCard>
      </div>
    </AppShell>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-between gap-2 rounded-2xl border px-3 text-left text-xs font-bold",
        on ? "border-grape/60 bg-grape/20 text-foreground" : "border-border bg-surface-2/60 text-muted-foreground",
      )}
    >
      <span className="min-w-0">{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-grape" : "bg-muted")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function NumberChip({ value, onChange, placeholder }: { value: number | null; onChange: (v: number | null) => void; placeholder: string }) {
  return (
    <input
      type="number"
      min={1}
      max={20}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const v = Number(e.target.value);
        onChange(e.target.value === "" ? null : v > 0 ? v : null);
      }}
      className="h-11 w-16 rounded-full border border-input bg-surface px-2 text-center text-sm font-bold text-foreground outline-none focus:border-grape"
    />
  );
}

function AdvancedRules(props: {
  open: boolean;
  onToggle: () => void;
  tracking: TrackingConfig;
  setTracking: (t: TrackingConfig) => void;
  rules: RulesConfig;
  setRules: (r: RulesConfig) => void;
  saveDefaults: boolean;
  setSaveDefaults: (v: boolean) => void;
  canSaveDefaults: boolean;
}) {
  const { tracking, setTracking, rules, setRules } = props;
  const flip = (k: keyof TrackingConfig) => {
    const next = { ...tracking, [k]: !tracking[k] };
    if (k === "opponent" && !next.opponent) {
      next.oppRebounds = false;
      next.oppTurnovers = false;
    }
    if (k === "fouls" && !next.fouls) next.foulDetail = false;
    setTracking(next);
  };
  const statLabels = TRACKING_LABELS.filter((t) => t.key !== "clock");
  const isFull = statLabels.every((t) => tracking[t.key]);
  const isScoreOnly = statLabels.every((t) => tracking[t.key] === SCORE_ONLY_TRACKING[t.key]);
  const presetKey = BONUS_PRESETS.find((p) => JSON.stringify(p.rule) === JSON.stringify(rules.bonus))?.key ?? "custom";
  const setBonus = (b: BonusRule) => setRules({ ...rules, bonus: b });
  const customLimit = rules.foulLimit != null && rules.foulLimit !== 5 && rules.foulLimit !== 6;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-2/40 p-2">
      <BubbleButton size="sm" tone={props.open ? "grape" : "neutral"} className="min-h-11 w-full" onClick={props.onToggle} aria-expanded={props.open}>
        {props.open ? "▾" : "▸"} Advanced rules &amp; stat tracking
        <Pill tone="muted">{isFull ? "Full stats" : isScoreOnly ? "Score only" : "Custom"}</Pill>
      </BubbleButton>
      {props.open ? (
        <div className="flex flex-col gap-3 bubble-pop">
          <Field label="Stat tracking">
            <div className="flex flex-wrap gap-2">
              <BubbleButton size="sm" tone={isFull ? "grape" : "neutral"} onClick={() => setTracking({ ...FULL_TRACKING, clock: tracking.clock })}>Full stats</BubbleButton>
              <BubbleButton size="sm" tone={isScoreOnly ? "grape" : "neutral"} onClick={() => setTracking({ ...SCORE_ONLY_TRACKING, clock: tracking.clock })}>Score only (youth)</BubbleButton>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {statLabels.filter((t) => {
                if (t.key === "foulDetail") return tracking.fouls;
                if (t.key === "oppRebounds" || t.key === "oppTurnovers") return tracking.opponent;
                return true;
              }).map((t) => (
                <Toggle key={t.key} on={tracking[t.key]} label={`Track ${t.label.toLowerCase()}`} onClick={() => flip(t.key)} />
              ))}
            </div>
          </Field>
          <Field label="Player foul limit">
            <div className="flex flex-wrap items-center gap-2">
              {[5, 6].map((v) => (
                <BubbleButton key={v} size="sm" tone={rules.foulLimit === v ? "grape" : "neutral"} onClick={() => setRules({ ...rules, foulLimit: v })}>{v} fouls</BubbleButton>
              ))}
              <BubbleButton size="sm" tone={rules.foulLimit == null ? "grape" : "neutral"} onClick={() => setRules({ ...rules, foulLimit: null })}>No limit</BubbleButton>
              <div className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5", customLimit ? "border-grape" : "border-border")}>
                <Label>Custom</Label>
                <NumberChip value={customLimit ? rules.foulLimit : null} placeholder="#" onChange={(v) => v && setRules({ ...rules, foulLimit: v })} />
              </div>
            </div>
          </Field>
          <Field label="Team fouls / bonus">
            <div className="flex flex-wrap gap-2">
              {BONUS_PRESETS.map((p) => (
                <BubbleButton key={p.key} size="sm" tone={presetKey === p.key ? "grape" : "neutral"} onClick={() => setBonus(p.rule)}>{p.label}</BubbleButton>
              ))}
              <BubbleButton size="sm" tone={presetKey === "custom" ? "grape" : "neutral"} onClick={() => setBonus({ mode: "quarter", bonus: 5, double: 8 })}>Custom</BubbleButton>
            </div>
            {rules.bonus.mode !== "none" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(["quarter", "half"] as const).map((m) => (
                  <BubbleButton key={m} size="sm" tone={rules.bonus.mode === m ? "flame" : "neutral"} onClick={() => setBonus({ ...(rules.bonus as { bonus: number | null; double: number | null }), mode: m })}>
                    Per {m}
                  </BubbleButton>
                ))}
                <div className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                  <Label>{rules.bonus.mode === "half" ? "1 & 1 at" : "Bonus at"}</Label>
                  <NumberChip value={rules.bonus.bonus} placeholder="—" onChange={(v) => setBonus({ ...(rules.bonus as Extract<BonusRule, { bonus: number | null }>), bonus: v })} />
                </div>
                <div className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                  <Label>Double at</Label>
                  <NumberChip value={rules.bonus.double} placeholder="—" onChange={(v) => setBonus({ ...(rules.bonus as Extract<BonusRule, { double: number | null }>), double: v })} />
                </div>
              </div>
            ) : null}
          </Field>
          <Field label="Timeouts">
            <div className="flex flex-col gap-2">
              {([["timeoutsFull", "Full / 1-min"], ["timeouts30", "30-second"]] as const).map(([k, label]) => (
                <div key={k} className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="muted">{label}</Pill>
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <BubbleButton key={v} size="sm" className="h-11 min-w-11 px-0" tone={rules[k] === v ? "grape" : "neutral"} onClick={() => setRules({ ...rules, [k]: v })}>{v}</BubbleButton>
                  ))}
                </div>
              ))}
            </div>
          </Field>
          {props.canSaveDefaults ? (
            <Toggle on={props.saveDefaults} label="Save these rules as team defaults" onClick={() => props.setSaveDefaults(!props.saveDefaults)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
