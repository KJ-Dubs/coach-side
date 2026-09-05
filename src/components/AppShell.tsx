import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/games", label: "Games" },
  { to: "/roster", label: "Roster" },
  { to: "/plays", label: "Playbook" },
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
  return (
    <div className="min-h-screen px-3 py-3 sm:px-5 sm:py-5">
      <div className={cn("mx-auto w-full", wide ? "max-w-[1600px]" : "max-w-6xl")}>
        <header className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl border border-border/70 bg-surface/80 p-3 shadow-lg shadow-black/30 backdrop-blur">
          <Link
            to="/"
            className="rounded-2xl border border-grape/60 bg-grape/20 px-3 py-2 text-sm font-black uppercase tracking-[0.18em] text-foreground"
          >
            CourtFlow
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-full border border-border bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{
                  className:
                    "rounded-full border border-flame/70 bg-flame/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
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
