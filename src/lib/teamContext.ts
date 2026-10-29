import { useCallback, useEffect, useState } from "react";
import { useMe } from "./useMe";
import type { Team } from "./types";
import { pickCurrentTeam } from "./teamSeason";

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
    const read = () => { try { setStored(window.localStorage.getItem(KEY)); } catch { setStored(null); } };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("coachside:team-changed", read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener("coachside:team-changed", read); };
  }, []);

  const teams = me.teams;
  // Explicit choice wins (even a past season); otherwise the first active season.
  const team = pickCurrentTeam(teams, stored);

  const setTeam = useCallback((id: string) => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(KEY, id); } catch { /* private browsing */ }
      window.dispatchEvent(new CustomEvent("coachside:team-changed"));
    }
    setStored(id);
  }, []);

  return { teams, team, teamId: team?.id ?? null, setTeam, loading: me.loading };
}
