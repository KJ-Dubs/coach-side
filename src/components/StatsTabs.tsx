import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/Bubbles";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/stats", label: "Overview", exact: true },
  { to: "/games", label: "Games", exact: false },
  { to: "/stats/players", label: "Players", exact: false },
  { to: "/stats/team", label: "Team", exact: false },
] as const;

const base =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-black uppercase tracking-wide transition-colors";

/** One consistent tab bar across the stats + game history area. */
export function StatsTabs() {
  return (
    <Panel className="mb-3 flex flex-wrap items-center justify-center gap-2">
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: t.exact }}
          className={cn(base, "border-border bg-surface-2/70 text-foreground")}
          activeProps={{
            className: cn(base, "border-grape/70 bg-grape/25 text-grape-bright"),
          }}
        >
          {t.label}
        </Link>
      ))}
    </Panel>
  );
}
