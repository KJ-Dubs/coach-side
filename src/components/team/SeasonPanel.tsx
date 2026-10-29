import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BubbleButton, EmptyState, Field, Heading, InfoList, Label, Note, Panel, Pill, StatTile, TextInput } from "@/components/Bubbles";
import { TeamStatusPills } from "@/components/team/TeamSeason";
import { fetchPlayers } from "@/lib/data";
import { endSeason, fetchSeasonReview, reactivateSeason, setTrainingTeam } from "@/lib/season";
import {
  DEFAULT_CARRY,
  isArchivedTeam,
  isTrainingTeam,
  suggestNextSeason,
  teamAfterArchive,
  type CarryForward,
} from "@/lib/teamSeason";
import type { Team } from "@/lib/types";
import { useCurrentTeam } from "@/lib/teamContext";
import { cn } from "@/lib/utils";

/** Team-level head coach check (the database decides; the RPCs re-check). */
export function useIsTeamHeadCoach(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["is-team-head-coach", teamId],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_team_head_coach", { _team: teamId! });
      return data === true;
    },
    enabled: !!teamId,
    staleTime: 60_000,
  });
}

/**
 * Coach-only Season controls for one team: End Season (guided), Reactivate,
 * and the Training / Test Team switch. Used in Locker Room and Team Settings.
 */
export function SeasonPanel({
  team,
  onClose,
  onTeamChanged,
}: {
  team: Team;
  onClose?: () => void;
  /** Called after archiving with the team the coach should land on. */
  onTeamChanged?: (teamId: string) => void;
}) {
  const qc = useQueryClient();
  const head = useIsTeamHeadCoach(team.id);
  const [flow, setFlow] = useState(false);
  const archived = isArchivedTeam(team);
  const training = isTrainingTeam(team);

  const refresh = () => qc.invalidateQueries({ queryKey: ["teams"] });

  const toggleTraining = useMutation({
    mutationFn: (on: boolean) => setTrainingTeam(team.id, on),
    onSuccess: async (_d, on) => {
      await refresh();
      void qc.invalidateQueries({ queryKey: ["attendance-overview"] });
      toast.success(on ? "Training team: automatic reminders are quiet" : "Reminders are back on for this team");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivate = useMutation({
    mutationFn: () => reactivateSeason(team.id),
    onSuccess: async () => {
      await refresh();
      toast.success(`${team.season} is active again`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (flow && !archived) {
    return (
      <EndSeasonFlow
        team={team}
        onCancel={() => setFlow(false)}
        onDone={(id) => {
          setFlow(false);
          onTeamChanged?.(id);
          onClose?.();
        }}
      />
    );
  }

  return (
    <Panel className="mb-3 flex flex-col gap-3 border-grape/50">
      <div className="flex flex-wrap items-center gap-2">
        <Label>Season</Label>
        <span className="rounded-2xl border border-border/70 bg-background/50 px-3 py-1.5 text-base font-black text-foreground">
          {team.name} · {team.season}
        </span>
        <TeamStatusPills team={team} />
        {onClose ? (
          <BubbleButton size="sm" tone="ghost" className="ml-auto" onClick={onClose}>
            Close
          </BubbleButton>
        ) : null}
      </div>

      {archived ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/60 p-3">
          <Note>
            Archived{team.archived_at ? ` ${new Date(team.archived_at).toLocaleDateString()}` : ""}. Roster, games, stats,
            attendance, schedule, chat and playbook stay viewable. Reminders and attendance prompts are off.
          </Note>
          {head.data ? (
            <BubbleButton
              tone="grape"
              className="self-start"
              disabled={reactivate.isPending}
              onClick={() => {
                if (window.confirm(`Reactivate ${team.season}? Reminders and attendance prompts turn back on.`)) reactivate.mutate();
              }}
            >
              {reactivate.isPending ? "Reactivating…" : "Reactivate Season"}
            </BubbleButton>
          ) : (
            <Pill tone="muted" className="self-start">Only the head coach can reactivate a season</Pill>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-black text-foreground">Season over?</span>
              {head.data ? (
                <BubbleButton tone="flame" size="sm" className="ml-auto" onClick={() => setFlow(true)}>
                  End Season
                </BubbleButton>
              ) : (
                <Pill tone="muted" className="ml-auto">Head coach only</Pill>
              )}
            </div>
            <Note>Archive this season and keep everything. You can start the next season with the players you pick.</Note>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/60 p-3">
            <button
              type="button"
              role="switch"
              aria-checked={training}
              disabled={toggleTraining.isPending}
              onClick={() => toggleTraining.mutate(!training)}
              className="flex min-h-11 items-center gap-3 text-left"
            >
              <span
                className={cn(
                  "relative inline-flex h-7 w-12 flex-none items-center rounded-full border transition-colors",
                  training ? "border-grape bg-grape/70" : "border-border bg-surface",
                )}
              >
                <span
                  className={cn(
                    "absolute h-5 w-5 rounded-full bg-foreground transition-transform",
                    training ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </span>
              <span className="text-base font-black text-foreground">Training / Test Team</span>
            </button>
            <Note>
              For a practice or test team you still use. Everything stays editable, but automatic practice/game
              reminders and attendance prompts stay quiet. Team chat you send still goes out.
            </Note>
          </div>
        </>
      )}
    </Panel>
  );
}

const STEPS = ["Review", "What happens", "Carry forward", "Next season"] as const;

function EndSeasonFlow({
  team,
  onCancel,
  onDone,
}: {
  team: Team;
  onCancel: () => void;
  onDone: (teamId: string) => void;
}) {
  const qc = useQueryClient();
  const current = useCurrentTeam();
  const [step, setStep] = useState(0);
  const [carry, setCarry] = useState<CarryForward>(DEFAULT_CARRY);
  const [mode, setMode] = useState<"archive" | "next">("next");
  const [nextName, setNextName] = useState(team.name);
  const [nextSeason, setNextSeason] = useState(() => suggestNextSeason(team.season));

  const review = useQuery({ queryKey: ["season-review", team.id], queryFn: () => fetchSeasonReview(team.id) });
  const players = useQuery({ queryKey: ["players", team.id], queryFn: () => fetchPlayers(team.id) });
  const roster = useMemo(() => (players.data ?? []).filter((p) => p.active), [players.data]);

  const run = useMutation({
    mutationFn: () =>
      endSeason({ teamId: team.id, startNext: mode === "next", nextName, nextSeason, carry }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["teams"] });
      void qc.invalidateQueries({ queryKey: ["attendance-overview"] });
      const nextId = teamAfterArchive(current.teams, r.archivedTeamId, r.newTeamId);
      if (nextId) current.setTeam(nextId);
      toast.success(
        r.newTeamId
          ? `${team.season} archived · ${nextSeason} started${r.players ? ` with ${r.players} player${r.players === 1 ? "" : "s"}` : ""}`
          : `${team.season} archived. Find it under Past Seasons.`,
      );
      onDone(nextId ?? team.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (key: keyof Omit<CarryForward, "playerIds">) => setCarry((c) => ({ ...c, [key]: !c[key] }));
  const r = review.data;

  return (
    <Panel className="mb-3 flex flex-col gap-3 border-flame/60">
      <div className="flex flex-wrap items-center gap-2">
        <Heading tone="flame">Wrap up {team.season}</Heading>
        <BubbleButton size="sm" tone="ghost" className="ml-auto" onClick={onCancel}>
          Cancel
        </BubbleButton>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="End season steps">
        {STEPS.map((s, i) => (
          <Pill key={s} tone={i === step ? "flame" : i < step ? "grape" : "muted"}>
            {i + 1}. {s}
          </Pill>
        ))}
      </div>

      {step === 0 ? (
        !r ? (
          <EmptyState>Adding up the season…</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label="Record"
                tone="flame"
                value={`${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`}
                hint={`${r.games} game${r.games === 1 ? "" : "s"} played`}
              />
              <StatTile
                label="Attendance"
                tone="grape"
                value={r.attendancePct === null ? "—" : `${r.attendancePct}%`}
                hint={`${r.attendanceEvents} tracked event${r.attendanceEvents === 1 ? "" : "s"}`}
              />
              <StatTile label="Schedule" value={r.practicesDone} hint={`practices done · ${r.gamesScheduled} games`} />
              <StatTile label="Playbook" value={r.plays} hint={`plays · ${r.folders} folders · ${r.plans} plans`} />
            </div>
            {r.leaders.length ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/60 p-2">
                <Label>Scoring leaders</Label>
                {r.leaders.map((l) => (
                  <Pill key={`${l.jersey}-${l.name}`} tone="neutral">
                    #{l.jersey} {l.name} · {l.points} pts
                  </Pill>
                ))}
              </div>
            ) : null}
            {r.upcoming ? (
              <Note tone="flame">
                {r.upcoming} upcoming event{r.upcoming === 1 ? "" : "s"} will stay on the archived calendar with no
                reminders.
              </Note>
            ) : null}
          </div>
        )
      ) : null}

      {step === 1 ? (
        <InfoList
          tone="grape"
          items={[
            "Games and stats stay available",
            "Attendance stays available",
            "Roster stays available",
            "Schedule stays available",
            "Chat, plans and playbook history stay available",
            "The archived season becomes read-only for roster, schedule, games and attendance",
            "Practice/game reminders and attendance prompts stop",
            "Membership stays with this team and carries to the next season you start. Archiving does not cancel billing.",
            "Nothing is deleted. The head coach can reactivate it anytime.",
          ]}
        />
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          <Note>Used only if you start the next season.</Note>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["branding", "Team name, logo & colors"],
                ["coaches", "Assistant coaches"],
                ["playbook", "Playbook plays"],
                ["folders", "Playbook folders"],
                ["plans", "Practice plans & drills"],
              ] as const
            ).map(([key, label]) => (
              <BubbleButton
                key={key}
                size="sm"
                tone={carry[key] ? "grape" : "neutral"}
                aria-pressed={carry[key]}
                onClick={() => toggle(key)}
              >
                {carry[key] ? "✓ " : "+ "}
                {label}
              </BubbleButton>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label>Players returning</Label>
              <Pill tone="flame">
                {carry.playerIds.length} of {roster.length}
              </Pill>
              <div className="ml-auto flex gap-1.5">
                <BubbleButton size="sm" tone="neutral" onClick={() => setCarry((c) => ({ ...c, playerIds: roster.map((p) => p.id) }))}>
                  All
                </BubbleButton>
                <BubbleButton size="sm" tone="ghost" onClick={() => setCarry((c) => ({ ...c, playerIds: [] }))}>
                  None
                </BubbleButton>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {roster.map((p) => {
                const on = carry.playerIds.includes(p.id);
                return (
                  <BubbleButton
                    key={p.id}
                    size="sm"
                    tone={on ? "grape" : "neutral"}
                    aria-pressed={on}
                    onClick={() =>
                      setCarry((c) => ({
                        ...c,
                        playerIds: on ? c.playerIds.filter((x) => x !== p.id) : [...c.playerIds, p.id],
                      }))
                    }
                  >
                    {on ? "✓ " : ""}#{p.jersey} {p.name}
                  </BubbleButton>
                );
              })}
              {!roster.length ? <Pill tone="muted">No active players</Pill> : null}
            </div>
            <Note>Players you pick keep their app access in the new season. Nobody is added automatically.</Note>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("archive")}
              aria-pressed={mode === "archive"}
              className={cn(
                "flex flex-col gap-1 rounded-2xl border p-3 text-left",
                mode === "archive" ? "border-grape bg-grape/20" : "border-border bg-surface-2/60",
              )}
            >
              <span className="text-base font-black text-foreground">Archive only</span>
              <span className="text-sm font-semibold text-muted-foreground">Move {team.season} to Past Seasons.</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("next")}
              aria-pressed={mode === "next"}
              className={cn(
                "flex flex-col gap-1 rounded-2xl border p-3 text-left",
                mode === "next" ? "border-flame bg-flame/15" : "border-border bg-surface-2/60",
              )}
            >
              <span className="text-base font-black text-foreground">Archive & Start Next Season</span>
              <span className="text-sm font-semibold text-muted-foreground">
                New season linked to this one, with what you carried forward.
              </span>
            </button>
          </div>
          {mode === "next" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Team name">
                <TextInput value={nextName} onChange={(e) => setNextName(e.target.value)} />
              </Field>
              <Field label="Season name / year">
                <TextInput value={nextSeason} placeholder="2027" onChange={(e) => setNextSeason(e.target.value)} />
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <BubbleButton tone="neutral" onClick={() => setStep((s) => s - 1)}>
            ← Back
          </BubbleButton>
        ) : null}
        {step < STEPS.length - 1 ? (
          <BubbleButton tone="grape" className="ml-auto" onClick={() => setStep((s) => s + 1)}>
            Next →
          </BubbleButton>
        ) : (
          <BubbleButton
            tone="flame"
            className="ml-auto"
            disabled={run.isPending || (mode === "next" && (!nextSeason.trim() || !nextName.trim()))}
            onClick={() => run.mutate()}
          >
            {run.isPending ? "Working…" : mode === "next" ? "Archive & Start Next Season" : "Archive Season"}
          </BubbleButton>
        )}
      </div>
    </Panel>
  );
}
