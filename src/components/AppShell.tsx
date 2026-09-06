import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { initialsOf, signOut } from "@/lib/auth";
import { useMe } from "@/lib/useMe";

const QUICK = [
  { to: "/games/new", label: "Start Game", tone: "flame" },
  { to: "/plays", label: "Playbook", tone: "neutral" },
  { to: "/stats/team", label: "Stats", tone: "neutral", match: "/stats" },
  { to: "/roster", label: "Rosters", tone: "neutral" },
  { to: "/games", label: "History", tone: "neutral" },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  actions,
  wide,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  wide?: boolean | undefined;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const doSignOut = async () => {
    await signOut(qc);
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen px-3 py-3 sm:px-5 sm:py-5">
      <div className={cn("mx-auto w-full", wide ? "max-w-[1600px]" : "max-w-6xl")}>
        <header className="mb-4 flex flex-wrap items-center gap-2 rounded-3xl border border-border/70 bg-surface/80 p-2.5 shadow-lg shadow-black/30 backdrop-blur">
          <Link
            to="/dashboard"
            aria-label="Home dashboard"
            className="inline-flex items-center gap-2 rounded-2xl border border-grape/60 bg-grape/20 px-3 py-2 text-sm font-black uppercase tracking-[0.16em] text-foreground"
          >
            <span aria-hidden className="text-base leading-none">⌂</span>
            <span className="hidden sm:inline">CourtSide</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1.5">
            {QUICK.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/games" }}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
                  item.tone === "flame"
                    ? "border-flame/70 bg-flame/20 text-foreground hover:bg-flame/30"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                )}
                activeProps={{
                  className:
                    "rounded-full border border-grape bg-grape/30 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-foreground",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {actions}
            <Link
              to="/settings"
              className="rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{
                className:
                  "rounded-full border border-grape bg-grape/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground",
              }}
            >
              Settings
            </Link>
            <Link
              to="/profile"
              aria-label="Profile"
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-flame/70 bg-flame/25 px-2 text-xs font-black text-foreground"
              activeProps={{
                className:
                  "inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-flame bg-flame px-2 text-xs font-black text-accent-foreground",
              }}
            >
              {initialsOf(me.profile?.full_name, me.user?.email)}
            </Link>
            <button
              type="button"
              onClick={() => void doSignOut()}
              className="rounded-full border border-border/70 bg-surface/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="rounded-2xl border border-border bg-surface/80 px-4 py-2 text-lg font-black tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  );
}
