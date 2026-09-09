import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  BookOpen,
  ChevronDown,
  ClipboardPenLine,
  LogOut,
  MessagesSquare,
  Settings,
  Swords,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsOf, signOut } from "@/lib/auth";
import { resolveRole, useAccess } from "@/lib/access";
import { useMe } from "@/lib/useMe";

const QUICK = [
  { to: "/roster", label: "Rosters", icon: UsersRound, tone: "grape" },
  { to: "/games/new", label: "Live Game", icon: Swords, tone: "flame" },
  { to: "/plays", label: "Playbook", icon: BookOpen, tone: "blue" },
  { to: "/plays/new", label: "Play Maker", icon: ClipboardPenLine, tone: "rose" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, tone: "teal" },
  { to: "/lockerroom", label: "Locker Room", icon: MessagesSquare, tone: "grape" },
  { to: "/stats/team", label: "Stats", icon: BarChart3, tone: "gold" },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  actions,
  wide,
  logoUrl,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  wide?: boolean | undefined;
  logoUrl?: string | null | undefined;
}) {
  const me = useMe();
  const { access } = useAccess();
  const role = resolveRole(access);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const doSignOut = async () => {
    await signOut(qc);
    navigate({ to: "/auth", replace: true });
  };

  // Players get a Locker-Room-only shell. This is decided by database
  // membership, never by anything stored on the device.
  if (role.isPlayerOnly) {
    const playerTeam =
      me.teams.find((t) => access.playerTeamIds.includes(t.id)) ?? me.teams[0] ?? null;
    return (
      <div className="min-h-screen px-3 py-3 sm:px-5 sm:py-5">
        <div className="mx-auto w-full max-w-3xl">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-border/70 bg-surface/85 p-2.5 shadow-lg shadow-black/30 backdrop-blur">
            <span className="inline-flex items-center rounded-2xl border border-border/70 bg-surface-2/70 px-3 py-1.5">
              <img src={wordmark.url} alt="CoachSide" className="h-8 w-auto max-w-[150px] object-contain" />
            </span>
            {playerTeam ? (
              <span className="rounded-full border border-grape/60 bg-grape/20 px-3 py-2 text-xs font-black text-foreground">
                {playerTeam.name}
              </span>
            ) : null}
            <nav className="flex items-center gap-1.5" aria-label="Player navigation">
              <Link
                to="/lockerroom"
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface-2/70 px-4 text-xs font-black uppercase text-foreground"
                activeProps={{
                  className:
                    "inline-flex min-h-11 items-center rounded-full border border-grape/60 bg-grape/25 px-4 text-xs font-black uppercase text-grape-bright",
                }}
              >
                Locker Room
              </Link>
              <Link
                to="/profile"
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface-2/70 px-4 text-xs font-black uppercase text-foreground"
                activeProps={{
                  className:
                    "inline-flex min-h-11 items-center rounded-full border border-grape/60 bg-grape/25 px-4 text-xs font-black uppercase text-grape-bright",
                }}
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={() => void doSignOut()}
                className="inline-flex min-h-11 items-center rounded-full border border-flame/60 bg-flame/20 px-4 text-xs font-black uppercase text-foreground"
              >
                Sign out
              </button>
            </nav>
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


  return (
    <div className="min-h-screen px-3 py-3 sm:px-5 sm:py-5">
      <div className={cn("mx-auto w-full", wide ? "max-w-[1600px]" : "max-w-6xl")}>
        <header className="mb-4 rounded-3xl border border-border/70 bg-surface/85 p-2.5 shadow-lg shadow-black/30 backdrop-blur">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[1fr_minmax(520px,auto)_1fr]">
            <Link
              to="/dashboard"
              aria-label="CoachSide home dashboard"
              className="inline-flex w-fit items-center rounded-2xl border border-border/70 bg-surface-2/70 px-3 py-1.5 transition-colors hover:border-flame/60"
            >
              <img
                src={wordmark.url}
                alt="CoachSide"
                className="h-8 w-auto max-w-[150px] object-contain sm:h-9 sm:max-w-[180px]"
              />
            </Link>

            <nav className="order-3 col-span-2 grid grid-cols-4 gap-1 sm:grid-cols-7 rounded-2xl border border-border/80 bg-background/70 p-1.5 lg:order-none lg:col-span-1" aria-label="Primary navigation">
              {QUICK.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.to === "/plays" }}
                    className={cn(
                      "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-1.5 py-1.5 text-center text-[9px] font-extrabold uppercase text-muted-foreground transition-all hover:border-border hover:bg-surface-2 hover:text-foreground sm:min-h-14 sm:px-2 sm:text-[10px]",
                      item.tone === "flame" && "hover:text-flame",
                      item.tone === "grape" && "hover:text-grape-bright",
                      item.tone === "blue" && "hover:text-blue",
                      item.tone === "rose" && "hover:text-rose",
                      item.tone === "gold" && "hover:text-gold",
                    )}
                    activeProps={{
                      className:
                        "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-grape/50 bg-grape/15 px-1.5 py-1.5 text-center text-[9px] font-extrabold uppercase text-grape-bright sm:min-h-14 sm:px-2 sm:text-[10px]",
                    }}
                  >
                    <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
                    <span className="leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center justify-end gap-1.5">
              {actions}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open profile and settings menu"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-grape/60 bg-grape/20 px-2.5 text-xs font-black text-foreground transition-colors hover:bg-grape/30"
                  >
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-flame/70 bg-flame/25 px-1.5">
                      {initialsOf(me.profile?.full_name, me.user?.email)}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl border-border bg-popover p-2 shadow-xl shadow-black/40">
                  <DropdownMenuLabel className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                    Coach account
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 font-bold focus:bg-grape/20">
                    <Link to="/profile"><UserRound /> Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 font-bold focus:bg-grape/20">
                    <Link to="/settings"><Settings /> Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-flame focus:bg-flame/15 focus:text-flame"
                    onSelect={() => void doSignOut()}
                  >
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {logoUrl ? (
            <span className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-flame/50 bg-surface-2/80 p-1 shadow-lg shadow-black/30">
              <img src={logoUrl} alt="Team logo" className="h-full w-full object-contain" />
            </span>
          ) : null}
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
