import { useLayoutEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { useCurrentTeam } from "@/lib/teamContext";
import { teamThemeEnabled, teamThemeVariables } from "@/lib/teamTheme";

/** Root overrides also reach portaled menus; cleanup restores public branding. */
export function TeamThemeProvider({ teamId, enabled = true }: { teamId?: string | undefined; enabled?: boolean | undefined }) {
  const current = useCurrentTeam();
  const path = useLocation({ select: (location) => location.pathname });
  // An explicit game/page team never borrows a different team's colors while loading.
  const team = teamId ? current.teams.find((t) => t.id === teamId) : current.team;
  useLayoutEffect(() => {
    if (!enabled || !teamThemeEnabled(path)) return;
    const style = document.documentElement.style;
    const vars = teamThemeVariables(team);
    for (const [key, value] of Object.entries(vars)) style.setProperty(key, value);
    return () => { for (const key of Object.keys(vars)) style.removeProperty(key); };
  }, [path, enabled, team?.id, team?.primary_color, team?.secondary_color]);
  return null;
}