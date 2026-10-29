/**
 * Server-only: turns overdue practice/game attendance into real CoachSide
 * notifications (in-app + push) for that team's coaches.
 *
 * Runs from the hourly scheduled job and, as a fallback, when a coach opens
 * CoachSide. Uses the same pure queue rules as the Home prompt, so both always
 * agree on what is due. Dedupe key = one alert per event per coach; the
 * database clears it once attendance is completed or skipped.
 *
 * Never notifies players/parents, archived seasons or Training/Test teams.
 */
import { adminDb, dispatchNotification } from "./notify.server";
import {
  ATTENDANCE_NOTIFY_WINDOW_DAYS,
  attendanceDueKey,
  attendanceDueNotice,
  buildAttendanceQueue,
} from "./attendanceRules";
import { attendanceEligibleTeam } from "./teamSeason";

type TeamRow = {
  id: string;
  name: string;
  org_id: string | null;
  timezone: string | null;
  season_status: string | null;
  is_training_team: boolean | null;
};

const COACH_ROLES = ["head_coach", "assistant_coach"];

export type AttendanceDueResult = { teams: number; due: number; notified: number };

export async function runAttendanceDue(opts: { userId?: string; now?: number } = {}): Promise<AttendanceDueResult> {
  const db = await adminDb();
  const now = opts.now ?? Date.now();
  const result: AttendanceDueResult = { teams: 0, due: 0, notified: 0 };

  // ---- eligible teams (optionally only ones this coach coaches) ----
  let teamQuery = db
    .from("teams")
    .select("id, name, org_id, timezone, season_status, is_training_team")
    .eq("season_status", "active")
    .eq("is_training_team", false);
  if (opts.userId) {
    const [mem, orgs] = await Promise.all([
      db.from("team_members").select("team_id, role").eq("user_id", opts.userId).eq("active", true),
      db.from("org_members").select("org_id, role").eq("user_id", opts.userId),
    ]);
    const teamIds = ((mem.data ?? []) as { team_id: string; role: string }[])
      .filter((m) => COACH_ROLES.includes(m.role))
      .map((m) => m.team_id);
    const orgIds = ((orgs.data ?? []) as { org_id: string; role: string }[])
      .filter((m) => COACH_ROLES.includes(m.role))
      .map((m) => m.org_id);
    if (!teamIds.length && !orgIds.length) return result;
    const ors = [
      teamIds.length ? `id.in.(${teamIds.join(",")})` : null,
      orgIds.length ? `org_id.in.(${orgIds.join(",")})` : null,
    ].filter(Boolean);
    teamQuery = teamQuery.or(ors.join(","));
  }
  const { data: teamData } = await teamQuery;
  const teams = ((teamData ?? []) as TeamRow[]).filter(attendanceEligibleTeam);
  result.teams = teams.length;
  if (!teams.length) return result;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamIds = teams.map((t) => t.id);

  // ---- recent events + final games + attendance state ----
  const since = new Date(now - (ATTENDANCE_NOTIFY_WINDOW_DAYS + 1) * 86_400_000).toISOString();
  const [ev, gm] = await Promise.all([
    db
      .from("team_events")
      .select("id, team_id, title, event_type, kind, status, starts_at, ends_at, game_id, opponent, home_away")
      .in("team_id", teamIds)
      .in("event_type", ["practice", "game"])
      .gte("starts_at", since)
      .lte("starts_at", new Date(now).toISOString()),
    db
      .from("games")
      .select("id, team_id, opponent, status, created_at, ended_at")
      .in("team_id", teamIds)
      .eq("status", "final")
      .gte("created_at", since),
  ]);
  const events = (ev.data ?? []) as Parameters<typeof buildAttendanceQueue>[0]["events"];
  const games = (gm.data ?? []) as Parameters<typeof buildAttendanceQueue>[0]["games"];
  if (!events.length) return result;
  const eventIds = events.map((e) => e.id);
  const [s, r] = await Promise.all([
    db.from("event_attendance_sessions").select("event_id, status").in("event_id", eventIds),
    db.from("event_attendance").select("event_id").in("event_id", eventIds),
  ]);
  const sessions = new Map(
    ((s.data ?? []) as { event_id: string; status: "completed" | "skipped" }[]).map((x) => [x.event_id, x.status]),
  );
  const recorded = new Set(((r.data ?? []) as { event_id: string }[]).map((x) => x.event_id));

  const queue = buildAttendanceQueue({
    events,
    games,
    sessions,
    recorded,
    now,
    windowDays: ATTENDANCE_NOTIFY_WINDOW_DAYS,
  }).filter((i) => i.eventId);
  result.due = queue.length;
  if (!queue.length) return result;

  // ---- coaches per team (team staff + program coaches) ----
  const orgIds = [...new Set(teams.map((t) => t.org_id).filter(Boolean) as string[])];
  const [staff, orgStaff] = await Promise.all([
    db.from("team_members").select("team_id, user_id, role").in("team_id", teamIds).eq("active", true),
    orgIds.length
      ? db.from("org_members").select("org_id, user_id, role").in("org_id", orgIds)
      : Promise.resolve({ data: [] }),
  ]);
  const coachesFor = (teamId: string): string[] => {
    const team = teamById.get(teamId);
    const ids = ((staff.data ?? []) as { team_id: string; user_id: string; role: string }[])
      .filter((m) => m.team_id === teamId && COACH_ROLES.includes(m.role))
      .map((m) => m.user_id);
    for (const m of (orgStaff.data ?? []) as { org_id: string; user_id: string; role: string }[]) {
      if (team?.org_id && m.org_id === team.org_id && COACH_ROLES.includes(m.role)) ids.push(m.user_id);
    }
    const unique = [...new Set(ids)];
    return opts.userId ? unique.filter((id) => id === opts.userId) : unique;
  };

  for (const item of queue) {
    const team = teamById.get(item.teamId);
    const notice = attendanceDueNotice(item, now, team?.timezone || "America/Los_Angeles");
    const userIds = coachesFor(item.teamId);
    if (!notice || !userIds.length) continue;
    const res = await dispatchNotification({
      audience: { kind: "users", userIds },
      type: "attendance_due",
      title: notice.title,
      body: team && teams.length > 1 ? `${notice.body} (${team.name})` : notice.body,
      link: notice.link,
      teamId: item.teamId,
      relatedType: "team_event",
      relatedId: item.eventId,
      prefColumn: "attendance_reminders",
      dedupeKey: attendanceDueKey(item.eventId!),
      channels: ["inapp", "push"],
    });
    result.notified += res.inapp;
  }
  return result;
}
