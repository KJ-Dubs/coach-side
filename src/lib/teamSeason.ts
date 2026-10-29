/**
 * Pure team-season rules shared by team pickers, the Locker Room Season
 * controls, the attendance queue and the server notification jobs — so
 * "archived" and "training team" mean the same thing everywhere.
 *
 * - Archived season: view-only history; no automatic reminders or attendance prompts.
 * - Training / Test team: fully editable, but automatic schedule reminders and
 *   attendance-due prompts stay quiet. Manual chat/announcements still send.
 */

export type SeasonTeamLike = {
  id: string;
  season_status?: string | null;
  is_training_team?: boolean | null;
};

export function isArchivedTeam(t: Pick<SeasonTeamLike, "season_status"> | null | undefined): boolean {
  return t?.season_status === "archived";
}

export function isTrainingTeam(t: Pick<SeasonTeamLike, "is_training_team"> | null | undefined): boolean {
  return !!t?.is_training_team;
}

/** Automatic schedule reminders and attendance prompts are off for this team. */
export function isQuietTeam(t: SeasonTeamLike | null | undefined): boolean {
  return isArchivedTeam(t) || isTrainingTeam(t);
}

/** Only active, non-training teams get attendance-due prompts and notifications. */
export function attendanceEligibleTeam(t: SeasonTeamLike | null | undefined): boolean {
  return !!t && !isQuietTeam(t);
}

export type TeamAlertKind = "announcement" | "assignment" | "play" | "schedule" | "game";

/**
 * Automatic schedule/game alerts are suppressed for quiet teams. Announcements,
 * plans and plays are things a coach sends on purpose, so they still go out.
 */
export function suppressTeamAlert(t: SeasonTeamLike | null | undefined, kind: TeamAlertKind): boolean {
  if (kind !== "schedule" && kind !== "game") return false;
  return isQuietTeam(t);
}

/** Active seasons first (original order), archived seasons grouped after. */
export function splitSeasons<T extends SeasonTeamLike>(teams: T[]): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const t of teams) (isArchivedTeam(t) ? archived : active).push(t);
  return { active, archived };
}

/**
 * The team a coach works with by default: an explicit choice wins (even a past
 * season they opened on purpose), otherwise the first active season.
 */
export function pickCurrentTeam<T extends SeasonTeamLike>(teams: T[], storedId: string | null): T | null {
  const stored = storedId ? teams.find((t) => t.id === storedId) : undefined;
  if (stored) return stored;
  return teams.find((t) => !isArchivedTeam(t)) ?? teams[0] ?? null;
}

/** After archiving: the new season if one was created, else another active team. */
export function teamAfterArchive<T extends SeasonTeamLike>(
  teams: T[],
  archivedId: string,
  newTeamId: string | null,
): string | null {
  if (newTeamId) return newTeamId;
  const other = teams.find((t) => t.id !== archivedId && !isArchivedTeam(t));
  return other?.id ?? archivedId;
}

export type CarryForward = {
  branding: boolean;
  coaches: boolean;
  playbook: boolean;
  folders: boolean;
  plans: boolean;
  playerIds: string[];
};

/** Defaults for the End Season flow: keep the program, pick players by hand. */
export const DEFAULT_CARRY: CarryForward = {
  branding: true,
  coaches: true,
  playbook: true,
  folders: true,
  plans: false,
  playerIds: [],
};

/** "2026" → "2027", "2026-27" → "2027-28", "Fall 2026" → "Fall 2027"; else "". */
export function suggestNextSeason(season: string | null | undefined): string {
  const s = (season ?? "").trim();
  const range = s.match(/^(.*?)(\d{4})\s*[-–/]\s*(\d{2}|\d{4})(.*)$/);
  if (range) {
    const start = Number(range[2]) + 1;
    const endRaw = range[3]!;
    const end = endRaw.length === 2 ? String((Number(endRaw) + 1) % 100).padStart(2, "0") : String(Number(endRaw) + 1);
    return `${range[1]}${start}-${end}${range[4]}`;
  }
  const year = s.match(/^(.*?)(\d{4})(.*)$/);
  if (year) return `${year[1]}${Number(year[2]) + 1}${year[3]}`;
  return "";
}
