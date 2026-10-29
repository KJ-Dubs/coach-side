import { Pill } from "@/components/Bubbles";
import { isArchivedTeam, isTrainingTeam, splitSeasons, type SeasonTeamLike } from "@/lib/teamSeason";

type OptionTeam = SeasonTeamLike & { name: string; season?: string | null };

/**
 * <option>s for a team <select>: active seasons first, archived seasons under
 * a "Past Seasons" group so they stay reachable without crowding the list.
 */
export function TeamSelectOptions<T extends OptionTeam>({
  teams,
  showSeason = true,
}: {
  teams: T[];
  showSeason?: boolean;
}) {
  const { active, archived } = splitSeasons(teams);
  const label = (t: T) =>
    `${t.name}${showSeason && t.season ? ` · ${t.season}` : ""}${isTrainingTeam(t) ? " · Training" : ""}`;
  return (
    <>
      {active.map((t) => (
        <option key={t.id} value={t.id}>
          {label(t)}
        </option>
      ))}
      {archived.length ? (
        <optgroup label="Past Seasons">
          {archived.map((t) => (
            <option key={t.id} value={t.id}>
              {label(t)}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  );
}

/** "Archived Season" / "Training team" status pills. Renders nothing for a normal active team. */
export function TeamStatusPills({ team }: { team: SeasonTeamLike | null | undefined }) {
  if (!team) return null;
  return (
    <>
      {isArchivedTeam(team) ? <Pill tone="muted">Archived Season</Pill> : null}
      {isTrainingTeam(team) && !isArchivedTeam(team) ? <Pill tone="grape">Training team</Pill> : null}
    </>
  );
}
