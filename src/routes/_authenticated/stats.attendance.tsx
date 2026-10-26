import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatsTabs } from "@/components/StatsTabs";
import { BubbleButton, EmptyState, InfoPanel, Label, Panel, Pill, SelectInput } from "@/components/Bubbles";
import { useCoachTeamIds } from "@/components/attendance/AttendanceControls";
import { fetchPlayers } from "@/lib/data";
import { fetchTeamAttendance } from "@/lib/attendance";
import {
  REASON_LABEL,
  STATUS_LABEL,
  summarizePlayer,
  type AttendanceReason,
  type AttendanceStatus,
} from "@/lib/attendanceRules";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

type Search = { team?: string | undefined };

export const Route = createFileRoute("/_authenticated/stats/attendance")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["team"] === "string" && s["team"] ? { team: s["team"] as string } : {},
  head: () => ({
    meta: [
      { title: "Team Attendance — CoachSide" },
      {
        name: "description",
        content: "Per-player practice and game attendance: early, on time, late, out and attendance rate.",
      },
      { property: "og:title", content: "Team Attendance — CoachSide" },
      { property: "og:description", content: "Coach-only attendance summary for practices and games." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendanceSummaryPage,
});

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AttendanceSummaryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const me = useMe();
  const coach = useCoachTeamIds();
  const teams = me.teams.filter((t) => coach.ids.includes(t.id));
  const teamId = search.team && coach.ids.includes(search.team) ? search.team : teams[0]?.id;
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);

  useEffect(() => setOpenPlayer(null), [teamId]);

  const players = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => fetchPlayers(teamId!),
    enabled: !!teamId,
  });
  const rows = useQuery({
    queryKey: ["team-attendance", teamId],
    queryFn: () => fetchTeamAttendance(teamId!),
    enabled: !!teamId,
  });

  const byPlayer = useMemo(() => {
    const map = new Map<string, NonNullable<typeof rows.data>>();
    for (const r of rows.data ?? []) map.set(r.player_id, [...(map.get(r.player_id) ?? []), r]);
    return map;
  }, [rows.data]);

  const trackedEvents = new Set((rows.data ?? []).map((r) => r.event_id)).size;
  // Active roster first, then anyone with history who has since left.
  const list = (players.data ?? []).filter((p) => p.active || byPlayer.has(p.id));

  return (
    <AppShell title="Attendance" subtitle="Practices and games you’ve tracked" themeTeamId={teamId}>
      <StatsTabs />
      {!coach.ready ? (
        <Panel><EmptyState>Loading…</EmptyState></Panel>
      ) : !teams.length ? (
        <Panel><EmptyState>Attendance is available to team coaches.</EmptyState></Panel>
      ) : (
        <div className="flex flex-col gap-3">
          <Panel className="flex flex-wrap items-center gap-2">
            <Label>Team</Label>
            <SelectInput
              value={teamId}
              onChange={(e) => navigate({ search: { team: e.target.value }, replace: true })}
              className="max-w-xs"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.season}
                </option>
              ))}
            </SelectInput>
            <Pill tone="grape">{trackedEvents} events tracked</Pill>
          </Panel>

          <InfoPanel>
            Attendance % = present (Early + On time + Late) ÷ tracked events. Events without attendance never count as absences.
          </InfoPanel>

          {rows.isLoading || players.isLoading ? (
            <Panel><EmptyState>Loading attendance…</EmptyState></Panel>
          ) : !trackedEvents ? (
            <Panel><EmptyState>No attendance yet. After a practice or game ends, Home will ask you to take it.</EmptyState></Panel>
          ) : (
            <Panel className="flex flex-col gap-2">
              <div className="hidden grid-cols-[minmax(0,1fr)_repeat(6,3.5rem)] gap-1 px-3 sm:grid">
                {["Player", "Tracked", "Early", "On time", "Late", "Out", "%"].map((h) => (
                  <span key={h} className={cn("text-[11px] font-bold uppercase tracking-wide text-muted-foreground", h !== "Player" && "text-center")}>{h}</span>
                ))}
              </div>
              {list.map((p) => {
                const history = byPlayer.get(p.id) ?? [];
                const s = summarizePlayer(history);
                const open = openPlayer === p.id;
                return (
                  <div key={p.id} className="rounded-2xl border border-border/70 bg-surface-2/60">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenPlayer(open ? null : p.id)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3 text-left sm:grid-cols-[minmax(0,1fr)_repeat(6,3.5rem)] sm:gap-1"
                    >
                      <span className="min-w-0 truncate text-sm font-black text-foreground">
                        #{p.jersey} · {p.name}
                        {!p.active ? <span className="ml-2 text-xs font-semibold text-muted-foreground">(inactive)</span> : null}
                      </span>
                      <span className="rounded-full border border-grape/60 bg-grape/20 px-3 py-1 text-center text-sm font-black text-foreground sm:hidden">
                        {s.pct === null ? "—" : `${s.pct}%`}
                      </span>
                      {[s.tracked, s.early, s.on_time, s.late, s.out].map((v, i) => (
                        <span key={i} className="hidden text-center text-sm font-bold text-foreground sm:block">{v}</span>
                      ))}
                      <span className="hidden text-center text-sm font-black text-foreground sm:block">
                        {s.pct === null ? "—" : `${s.pct}%`}
                      </span>
                      <span className="col-span-2 flex flex-wrap gap-1.5 sm:hidden">
                        <Pill tone="muted">{s.tracked} tracked</Pill>
                        <Pill tone="muted">Early {s.early}</Pill>
                        <Pill tone="muted">On time {s.on_time}</Pill>
                        <Pill tone="muted">Late {s.late}</Pill>
                        <Pill tone="muted">Out {s.out}</Pill>
                      </span>
                    </button>
                    {open ? (
                      <div className="flex flex-col gap-1.5 border-t border-border/60 p-3">
                        {history.length ? (
                          history.map((r) => (
                            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm font-semibold text-foreground">
                              <span className="font-black">{r.event ? fmtDay(r.event.starts_at) : "—"}</span>
                              <span>{r.event?.event_type === "game" ? (r.event.opponent ? `Game vs ${r.event.opponent}` : "Game") : "Practice"}</span>
                              <span className="text-muted-foreground">—</span>
                              <span>
                                {STATUS_LABEL[r.status as AttendanceStatus] ?? r.status}
                                {r.reason ? ` · ${REASON_LABEL[r.reason as AttendanceReason] ?? r.reason}` : ""}
                              </span>
                              {r.note ? <span className="w-full text-xs text-muted-foreground">{r.note}</span> : null}
                            </div>
                          ))
                        ) : (
                          <EmptyState>No tracked events for this player yet.</EmptyState>
                        )}
                        <BubbleButton size="sm" tone="ghost" className="self-start" onClick={() => setOpenPlayer(null)}>
                          Close
                        </BubbleButton>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </Panel>
          )}
        </div>
      )}
    </AppShell>
  );
}
