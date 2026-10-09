import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Gauge,
  LogOut,
  MessagesSquare,
  Settings,
  Swords,
  Wrench,
  UserRound,
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
import { useIsAppAdmin } from "@/lib/useIsAppAdmin";
import { BackNav } from "@/components/BackNav";

const QUICK = [
  { to: "/plays", label: "Playbook", icon: BookOpen },
  { to: "/lockerroom", label: "Locker Room", icon: MessagesSquare },
  { to: "/games/new", label: "Live Game", icon: Swords },
  { to: "/stats", label: "Team Stats", icon: BarChart3 },
  { to: "/tools", label: "Tools", icon: Wrench },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  actions,
  wide,
  logoUrl,
  balancedTitle,
  backTo,
  backLabel = "Back",
  compact = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  wide?: boolean | undefined;
  logoUrl?: string | null | undefined;
  balancedTitle?: boolean | undefined;
  backTo?: string | undefined;
  backLabel?: string | undefined;
  compact?: boolean | undefined;
}) {
  const me = useMe();
  const { access } = useAccess();
  const role = resolveRole(access);
  const qc = useQueryClient();
  const navigate = useNavigate();
  // Owner-only "My KPI" entry. The database decides; the page re-checks too.
  const { isAdmin } = useIsAppAdmin();
  const isOwner = isAdmin && !role.isPlayerOnly;

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

          <div className="mb-4 flex flex-col items-center gap-2 rounded-3xl border border-border/70 bg-surface/80 px-4 py-4 text-center">
            {backTo ? <div className="self-start"><BackNav to={backTo} label={backLabel} /></div> : null}
            <h1 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="max-w-2xl text-sm font-semibold leading-relaxed text-muted-foreground">
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
    <div className={cn("min-h-screen max-w-full overflow-x-clip", compact ? "px-1.5 py-1.5 sm:px-2 sm:py-2" : "px-3 py-3 sm:px-5 sm:py-5")}>
      <div className={cn("mx-auto w-full min-w-0 max-w-full", wide ? "max-w-[1600px]" : "max-w-6xl")}>
        <header className={cn("rounded-3xl border border-border/70 bg-surface/85 shadow-lg shadow-black/30 backdrop-blur", compact ? "mb-1.5 p-1.5" : "mb-4 p-2.5")}>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[1fr_minmax(520px,auto)_1fr]">
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

            <nav className="order-3 col-span-2 grid grid-cols-5 gap-1 rounded-2xl border border-border/80 bg-background/70 p-1.5 lg:order-none lg:col-span-1" aria-label="Primary navigation">
              {QUICK.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.to === "/plays" || item.to === "/stats" }}
                    className={cn(
                      "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-1.5 py-1.5 text-center text-[9px] font-extrabold uppercase text-muted-foreground transition-all hover:border-border hover:bg-surface-2 hover:text-foreground sm:min-h-14 sm:px-2 sm:text-[10px]",
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

            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5">
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
                  {isOwner ? (
                    <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-flame focus:bg-flame/15">
                      <Link to="/kpi"><Gauge /> My KPI</Link>
                    </DropdownMenuItem>
                  ) : null}
                  {isOwner ? (
                    <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-flame focus:bg-flame/15">
                      <Link to="/launch-qa"><Gauge /> Launch QA</Link>
                    </DropdownMenuItem>
                  ) : null}
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

        <div className={cn(
          "items-center rounded-3xl border border-border/70 bg-surface/80 text-center",
          compact ? "mb-1.5 gap-2 px-2 py-1.5" : "mb-4 gap-3 px-4 py-4",
          balancedTitle
            ? "flex flex-col justify-center sm:grid sm:grid-cols-[3rem_minmax(0,1fr)_3rem]"
            : "grid grid-cols-[minmax(0,1fr)_auto] sm:flex sm:flex-wrap sm:justify-center",
        )}>
          {backTo ? <div className={cn("justify-self-start sm:col-span-1", !compact && "col-span-2")}><BackNav to={backTo} label={backLabel} /></div> : null}
          {logoUrl ? (
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-flame/50 bg-surface-2/80 p-1 shadow-lg shadow-black/30 sm:justify-self-start">
              <img src={logoUrl} alt="Team logo" className="h-full w-full object-contain" />
            </span>
          ) : balancedTitle ? <span className="hidden h-12 w-12 sm:block" aria-hidden /> : null}
          <div className={cn("min-w-0 text-center", !balancedTitle && "sm:min-w-[280px]")}>
            <h1 className={cn("font-black leading-tight text-foreground", compact ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl")}>{title}</h1>
            {subtitle ? <p className="mt-1 text-sm font-semibold leading-relaxed text-muted-foreground">{subtitle}</p> : null}
          </div>
          {balancedTitle ? <span className="hidden h-12 w-12 sm:block" aria-hidden /> : null}
        </div>

        {children}
      </div>
    </div>
  );
}
