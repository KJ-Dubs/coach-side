import { useCallback, useEffect, useState } from "react";
import { useMe } from "./useMe";
import type { Team } from "./types";

const KEY = "coachside.current-team";

/**
 * The team a coach is currently working with.
 *
 * The identifier is only remembered on the device for convenience; the list of
 * teams always comes from the database, so a remembered id that the coach no
 * longer has access to is simply ignored.
 */
export function useCurrentTeam(): {
  teams: Team[];
  team: Team | null;
  teamId: string | null;
  setTeam: (id: string) => void;
  loading: boolean;
} {
  const me = useMe();
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStored(window.localStorage.getItem(KEY));
  }, []);

  const teams = me.teams;
  const team = teams.find((t) => t.id === stored) ?? teams[0] ?? null;

  const setTeam = useCallback((id: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, id);
    setStored(id);
  }, []);

  return { teams, team, teamId: team?.id ?? null, setTeam, loading: me.loading };
}
