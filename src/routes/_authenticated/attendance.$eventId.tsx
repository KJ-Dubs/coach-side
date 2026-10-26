import { createFileRoute, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, Label, Panel, Pill, TextInput } from "@/components/Bubbles";
import { resolveRole, useAccess } from "@/lib/access";
import { fetchAttendanceSheet, saveAttendance, skipAttendance } from "@/lib/attendance";
import {
  ATTENDANCE_REASONS,
  ATTENDANCE_STATUSES,
  NOTE_MAX,
  REASON_LABEL,
  STATUS_LABEL,
  attendanceEventType,
  defaultEntries,
  entryProblem,
  needsReason,
  toSaveRows,
  withReason,
  withStatus,
  type AttendanceEntry,
  type AttendanceStatus,
} from "@/lib/attendanceRules";
import { trackActivity } from "@/lib/activity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance/$eventId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Take Attendance — CoachSide" },
      { name: "description", content: "Mark who was early, on time, late or out for a practice or game." },
      { property: "og:title", content: "Take Attendance — CoachSide" },
      { property: "og:description", content: "Fast practice and game attendance for coaches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendancePage,
});

const STATUS_TONE: Record<AttendanceStatus, string> = {
  early: "border-chart-4/70 bg-chart-4/25 text-foreground",
  on_time: "border-grape/70 bg-grape/30 text-foreground",
  late: "border-flame/70 bg-flame/25 text-foreground",
  out: "border-destructive/70 bg-destructive/25 text-foreground",
};

const chip =
  "inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-2 text-xs font-black tracking-wide transition-colors active:scale-95 sm:text-sm";

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AttendancePage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const qc = useQueryClient();
  const { access, loading } = useAccess();
  const role = resolveRole(access);

  const sheet = useQuery({
    queryKey: ["attendance-sheet", eventId],
    queryFn: () => fetchAttendanceSheet(eventId),
  });
  const data = sheet.data ?? null;
  const active = useMemo(() => (data?.players ?? []).filter((p) => p.active), [data]);
  const ids = useMemo(() => active.map((p) => p.id), [active]);
  const [entries, setEntries] = useState<Record<string, AttendanceEntry> | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (data && entries === null) setEntries(defaultEntries(ids, data.saved));
  }, [data, entries, ids]);

  const isCoach = !!data && role.canCoachTeam(data.event.team_id);
  const type = data ? attendanceEventType(data.event) : null;
  const problems = ids.filter((id) => entries?.[id] && entryProblem(entries[id]!));

  const done = async () => {
    if (!data) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["attendance-overview"] }),
      qc.invalidateQueries({ queryKey: ["attendance-index", data.event.team_id] }),
      qc.invalidateQueries({ queryKey: ["attendance-sheet", eventId] }),
      qc.invalidateQueries({ queryKey: ["team-attendance", data.event.team_id] }),
    ]);
    if (canGoBack) router.history.back();
    else navigate({ to: "/dashboard" });
  };

  const save = useMutation({
    mutationFn: () => saveAttendance(eventId, toSaveRows(ids, entries ?? {})),
    onSuccess: async () => {
      void trackActivity("attendance_completed", { teamId: data?.event.team_id ?? null, entityId: eventId });
      toast.success("Attendance saved");
      await done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skip = useMutation({
    mutationFn: () => skipAttendance(eventId),
    onSuccess: async () => {
      toast.success("No attendance for this event");
      await done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (id: string, fn: (e: AttendanceEntry) => AttendanceEntry) =>
    setEntries((prev) => (prev ? { ...prev, [id]: fn(prev[id] ?? { status: "on_time", reason: null, note: "" }) } : prev));

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { early: 0, on_time: 0, late: 0, out: 0 };
    for (const id of ids) if (entries?.[id]) c[entries[id]!.status] += 1;
    return c;
  }, [entries, ids]);

  const title = data
    ? type === "game" && data.event.opponent
      ? `${data.event.home_away === "away" ? "@" : "vs"} ${data.event.opponent}`
      : data.event.title
    : "Attendance";

  return (
    <AppShell
      title="Take Attendance"
      subtitle={data?.teamName || undefined}
      themeTeamId={data?.event.team_id}
      backTo="/dashboard"
      backLabel="Home"
    >
      {sheet.isLoading || loading ? (
        <Panel><EmptyState>Loading attendance…</EmptyState></Panel>
      ) : !data ? (
        <Panel><EmptyState>This event isn’t available.</EmptyState></Panel>
      ) : !isCoach ? (
        <Panel><EmptyState>Only this team’s coaches can take attendance.</EmptyState></Panel>
      ) : !type ? (
        <Panel><EmptyState>Attendance is for practices and games.</EmptyState></Panel>
      ) : (
        <div className="flex flex-col gap-3 pb-28">
          <Panel className="flex flex-col items-center gap-2 px-4 py-4 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Pill tone={type === "game" ? "flame" : "grape"}>{type === "game" ? "Game" : "Practice"}</Pill>
              {data.session === "completed" ? <Pill tone="success">Attendance complete</Pill> : null}
              {data.session === "skipped" ? <Pill tone="muted">Skipped</Pill> : null}
            </div>
            <h2 className="break-words text-xl font-black leading-tight text-foreground">{title}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              <Pill tone="muted">{fmtWhen(data.event.starts_at)}</Pill>
              {data.event.location ? <Pill tone="muted">{data.event.location}</Pill> : null}
            </div>
          </Panel>

          <Panel className="flex flex-wrap items-center justify-center gap-2">
            {ATTENDANCE_STATUSES.map((s) => (
              <Pill key={s} tone="muted">{STATUS_LABEL[s]} {counts[s]}</Pill>
            ))}
            <div className="flex w-full justify-center gap-2">
              <BubbleButton size="sm" tone="neutral" onClick={() => setEntries(defaultEntries(ids))}>
                Mark all On time
              </BubbleButton>
              <BubbleButton size="sm" tone="ghost" onClick={() => { setEntries(defaultEntries(ids, data.saved)); setTried(false); }}>
                Reset
              </BubbleButton>
            </div>
          </Panel>

          {active.length === 0 ? (
            <Panel><EmptyState>No active players on this roster yet.</EmptyState></Panel>
          ) : (
            <Panel className="flex flex-col gap-2">
              {active.map((p) => {
                const entry = entries?.[p.id];
                if (!entry) return null;
                const problem = tried ? entryProblem(entry) : null;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-2xl border bg-surface-2/60 p-3",
                      problem ? "border-destructive/70" : "border-border/70",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-sm font-black text-foreground">
                        #{p.jersey} · {p.name}
                      </span>
                      {data.usedInGame.has(p.id) ? <Pill tone="muted">Used in game</Pill> : null}
                    </div>
                    <div className="flex gap-1.5" role="radiogroup" aria-label={`Attendance for ${p.name}`}>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={entry.status === s}
                          className={cn(chip, entry.status === s ? STATUS_TONE[s] : "border-border bg-surface/70 text-muted-foreground")}
                          onClick={() => update(p.id, (e) => withStatus(e, s))}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                    {needsReason(entry.status) ? (
                      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/40 p-2">
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Reason for ${p.name}`}>
                          {ATTENDANCE_REASONS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              role="radio"
                              aria-checked={entry.reason === r}
                              className={cn(
                                chip,
                                "flex-none px-3",
                                entry.reason === r ? STATUS_TONE[entry.status] : "border-border bg-surface/70 text-muted-foreground",
                              )}
                              onClick={() => update(p.id, (e) => withReason(e, r))}
                            >
                              {REASON_LABEL[r]}
                            </button>
                          ))}
                        </div>
                        {entry.reason === "other" ? (
                          <TextInput
                            value={entry.note}
                            maxLength={NOTE_MAX}
                            placeholder="Short note (optional)"
                            aria-label={`Note for ${p.name}`}
                            onChange={(ev) => {
                              const note = ev.target.value;
                              update(p.id, (e) => ({ ...e, note }));
                            }}
                          />
                        ) : null}
                        {problem ? <Pill tone="danger" className="self-start">{problem}</Pill> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </Panel>
          )}

          {data.session !== "completed" ? (
            <Panel className="flex justify-center">
              <BubbleButton size="sm" tone="ghost" disabled={skip.isPending} onClick={() => skip.mutate()}>
                No attendance for this event
              </BubbleButton>
            </Panel>
          ) : null}

          <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Panel className="mx-auto flex max-w-xl flex-col items-center gap-2 border-grape/60">
              {tried && problems.length ? (
                <Pill tone="danger">{problems.length === 1 ? "1 player needs a reason" : `${problems.length} players need a reason`}</Pill>
              ) : null}
              <BubbleButton
                tone="grape"
                size="lg"
                className="w-full"
                disabled={save.isPending || active.length === 0}
                onClick={() => {
                  setTried(true);
                  if (problems.length) return;
                  save.mutate();
                }}
              >
                {save.isPending ? "Saving…" : "Save Attendance"}
              </BubbleButton>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
