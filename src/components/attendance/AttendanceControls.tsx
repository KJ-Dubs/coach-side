import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { resolveRole, useAccess } from "@/lib/access";
import { useMe } from "@/lib/useMe";
import {
  ensureGameAttendanceEvent,
  fetchAttendanceOverview,
  fetchTeamAttendanceIndex,
} from "@/lib/attendance";
import {
  attendanceDueAt,
  attendanceState,
  buildAttendanceQueue,
  isAttendanceEvent,
  isSnoozed,
  localDayKey,
  promptHeading,
  type AttendanceState,
} from "@/lib/attendanceRules";
import type { Game, TeamEvent } from "@/lib/types";

const SNOOZE_KEY = "coachside.attendance-snooze";

/** Teams the signed-in person coaches (attendance is coach-only). */
export function useCoachTeamIds(): { ids: string[]; ready: boolean } {
  const me = useMe();
  const { access, loading } = useAccess();
  const role = resolveRole(access);
  const ids = me.teams.filter((t) => role.canCoachTeam(t.id)).map((t) => t.id);
  return { ids, ready: !loading && !me.loading };
}

/**
 * Home prompt: the oldest past practice/game still waiting for attendance.
 * Lives on the Dashboard only, so Live Game and Play Maker are never interrupted.
 */
export function AttendancePrompt() {
  const navigate = useNavigate();
  const me = useMe();
  const coach = useCoachTeamIds();
  const [snoozed, setSnoozed] = useState(true);

  useEffect(() => {
    try {
      setSnoozed(isSnoozed(window.localStorage.getItem(SNOOZE_KEY), Date.now()));
    } catch {
      setSnoozed(false);
    }
  }, []);

  const overview = useQuery({
    queryKey: ["attendance-overview", coach.ids.join(",")],
    queryFn: () => fetchAttendanceOverview(coach.ids),
    enabled: coach.ready && coach.ids.length > 0,
    staleTime: 60_000,
  });

  const queue = useMemo(
    () => (overview.data ? buildAttendanceQueue({ ...overview.data, now: Date.now() }) : []),
    [overview.data],
  );

  const open = useMutation({
    mutationFn: async () => {
      const item = queue[0]!;
      return item.eventId ?? (await ensureGameAttendanceEvent(item.gameId!));
    },
    onSuccess: (eventId) => navigate({ to: "/attendance/$eventId", params: { eventId } }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (snoozed || !queue.length) return null;
  const item = queue[0]!;
  const teamName = coach.ids.length > 1 ? me.teams.find((t) => t.id === item.teamId)?.name : null;

  return (
    <Panel className="flex flex-col items-center gap-3 border-grape/60 bg-grape/10 px-4 py-4 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Label>Attendance</Label>
        {queue.length > 1 ? <Pill tone="flame">{queue.length} attendance check-ins waiting</Pill> : null}
      </div>
      <div className="min-w-0">
        <h2 className="break-words text-xl font-black leading-tight text-foreground">
          {promptHeading(item, Date.now())}
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {item.title}
          {teamName ? ` · ${teamName}` : ""}
        </p>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Quickly mark who was early, on time, late, or out.
        </p>
      </div>
      <div className="flex w-full max-w-[420px] flex-col gap-2 sm:flex-row">
        <BubbleButton
          tone="grape"
          size="lg"
          className="w-full sm:flex-1"
          disabled={open.isPending}
          onClick={() => open.mutate()}
        >
          <ClipboardCheck className="h-5 w-5" aria-hidden />
          Take Attendance
        </BubbleButton>
        <BubbleButton
          tone="neutral"
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => {
            try {
              window.localStorage.setItem(SNOOZE_KEY, localDayKey(Date.now()));
            } catch {
              /* private mode: snooze for this view only */
            }
            setSnoozed(true);
          }}
        >
          Later
        </BubbleButton>
      </div>
    </Panel>
  );
}

/** Attendance state for every event on a team, for coach-facing event cards. */
export function useTeamAttendanceIndex(teamId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["attendance-index", teamId],
    queryFn: () => fetchTeamAttendanceIndex(teamId!),
    enabled: enabled && !!teamId,
  });
}

const STATE_PILL: Record<AttendanceState, { text: string; tone: "muted" | "success" | "flame" }> = {
  not_started: { text: "Attendance not taken", tone: "flame" },
  partial: { text: "Attendance partly taken", tone: "flame" },
  completed: { text: "Attendance complete", tone: "success" },
  skipped: { text: "Attendance skipped", tone: "muted" },
};

/** Coach-only status pill + Take/Edit button for a past practice or game. */
export function EventAttendanceControl({
  event,
  index,
  game,
}: {
  event: TeamEvent;
  index: { sessions: Map<string, "completed" | "skipped">; recorded: Set<string> } | undefined;
  game?: Pick<Game, "status" | "ended_at"> | null;
}) {
  if (!index || !isAttendanceEvent(event)) return null;
  const state = attendanceState(event.id, index.sessions, index.recorded);
  const due = attendanceDueAt(event, game ?? null) <= Date.now();
  if (!due && state === "not_started") return null;
  const pill = STATE_PILL[state];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill tone={pill.tone}>{pill.text}</Pill>
      <Link to="/attendance/$eventId" params={{ eventId: event.id }}>
        <BubbleButton size="sm" tone={state === "completed" ? "neutral" : "grape"}>
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          {state === "completed" ? "Edit Attendance" : "Take Attendance"}
        </BubbleButton>
      </Link>
    </div>
  );
}
