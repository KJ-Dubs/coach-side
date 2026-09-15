import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardPenLine,
  KeyRound,
  MessagesSquare,
  PenLine,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, InfoList, InfoPanel, Label, Panel, Pill, PrimaryCTA } from "@/components/Bubbles";
import { fetchTeamEvents, fetchGames, logoSignedUrl } from "@/lib/data";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { fetchMyMemberships, isCoachRole } from "@/lib/locker";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";
import { PlayerQrPanel } from "@/components/PlayerQrPanel";
import { CoachNotes } from "@/components/CoachNotes";
import { useAccess, resolveRole } from "@/lib/access";
import { consumePendingInvite } from "@/lib/pendingInvite";
import { InstallAppCard } from "@/components/InstallApp";
import { useCurrentTeam } from "@/lib/teamContext";
import { PlayOfTheDayCard } from "@/components/community/PlayOfTheDayCard";
import { FollowedCreators } from "@/components/community/FollowedCreators";
import {
  COMPLETE_BLURB,
  COMPLETE_NAME,
  COMPLETE_PRICE,
  MODULE_LIST,
  useEntitlement,
} from "@/lib/entitlements";

/**
 * Players and parents land in the Locker Room instead of the coach dashboard.
 * Authority comes from the database memberships only, never device state.
 */
function useRedirectPlayersToLockerRoom() {
  const navigate = useNavigate();
  const { access, loading } = useAccess();
  const memberships = useQuery({ queryKey: ["my-memberships"], queryFn: fetchMyMemberships });
  const rows = memberships.data ?? [];
  const role = resolveRole(access);
  const membershipPlayerOnly = rows.length > 0 && rows.every((m) => !isCoachRole(m.role));
  const playerOnly = !loading && (role.isPlayerOnly || (!role.isCoach && membershipPlayerOnly));
  useEffect(() => {
    // A player still mid-invite finishes that flow first.
    if (!playerOnly) return;
    const pending = consumePendingInvite();
    if (pending) {
      navigate({ to: "/join/$token", params: { token: pending }, replace: true });
      return;
    }
    if (playerOnly) navigate({ to: "/lockerroom", replace: true });
  }, [playerOnly, navigate]);
  return { isCoach: role.isCoach && !playerOnly };
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Coach Dashboard — CoachSide" },
      {
        name: "description",
        content: "Your playbook, playmaker, locker room and game-day court in one calm launchpad.",
      },
      { property: "og:title", content: "Coach Dashboard — CoachSide" },
      { property: "og:description", content: "Your basketball coaching home base." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Action = {
  to: NonNullable<LinkProps["to"]>;
  title: string;
  blurb?: string;
  icon: LucideIcon;
};

const PRIMARY: Action[] = [
  { to: "/plays", title: "Playbook", blurb: "Run, present and organize every play.", icon: BookOpen },
  { to: "/plays/new", title: "Playmaker", blurb: "Design an animated play frame by frame.", icon: ClipboardPenLine },
  { to: "/lockerroom", title: "Locker Room", blurb: "Team chat, announcements and assignments.", icon: MessagesSquare },
  { to: "/games/new", title: "Live Game", blurb: "Game-day stat capture on the court.", icon: Swords },
];

const SECONDARY: Action[] = [
  { to: "/stats", title: "Stats", icon: BarChart3 },
  { to: "/calendar", title: "Calendar", icon: CalendarDays },
  { to: "/board", title: "Timeout Board", icon: PenLine },
];

function UpNext({ teamId }: { teamId: string | null }) {
  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchTeamEvents(teamId!),
    enabled: !!teamId,
  });
  const now = Date.now();
  const next = (events.data ?? [])
    .filter((e) => new Date(e.starts_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

  return (
    <Panel className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0 text-left">
        <Label>Up next</Label>
        {next ? (
          <div className="mt-2 min-w-0">
          <span className="block truncate text-lg font-black leading-tight text-foreground">
            {next.title}
          </span>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {new Date(next.starts_at).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          {next.location ? <p className="text-sm font-semibold text-muted-foreground">{next.location}</p> : null}
          </div>
        ) : <p className="mt-2 text-sm font-semibold text-muted-foreground">Nothing scheduled</p>}
      </div>
      <Link to="/calendar" className="justify-self-center sm:justify-self-end">
        <BubbleButton size="sm" tone="neutral">
          Calendar
        </BubbleButton>
      </Link>
    </Panel>
  );
}

/**
 * Game day gets its own card. It only points at the existing Live Game entry,
 * so the start flow (Live Game → Starting 5 → court) is untouched.
 */
function TodayStrip({ teamId }: { teamId: string | null }) {
  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchTeamEvents(teamId!),
    enabled: !!teamId,
  });
  const today = new Date().toDateString();
  const game = (events.data ?? []).find(
    (e) =>
      (e.event_type === "game" || e.kind === "game") &&
      new Date(e.starts_at).toDateString() === today,
  );

  if (!game) return <UpNext teamId={teamId} />;

  return (
    <Panel className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-flame/60 bg-flame/10">
      <div className="min-w-0 text-left">
        <Label>Game today</Label>
        <h2 className="mt-2 truncate text-xl font-black leading-tight text-foreground">{game.opponent ? `vs ${game.opponent}` : game.title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{new Date(game.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{game.location ? ` · ${game.location}` : ""}</p>
      </div>
      <Link to="/games/new">
        <BubbleButton tone="flame" size="lg" className="min-h-14">
          ▶ Start Live Game
        </BubbleButton>
      </Link>
    </Panel>
  );
}

/** Membership prompt. Hidden once a team holds all three modules. */
function MembershipCard({ teamId }: { teamId: string | null }) {
  const entitlement = useEntitlement(teamId);
  if (entitlement.complete) return null;
  return (
    <Panel className="flex flex-col items-center gap-3 text-center">
      <h2 className="text-xl font-black text-foreground">{COMPLETE_NAME}</h2>
      <span className="text-2xl font-black leading-tight text-flame">
        ${COMPLETE_PRICE}/month · all three modules
      </span>
      <InfoList items={[
        ...MODULE_LIST.map((m) => `${m.name} — $${m.price}/month`),
        COMPLETE_BLURB,
        entitlement.enforced ? "One monthly charge for this team." : "Memberships are not switched on yet — everything stays open.",
      ]} tone="flame" />
      <PrimaryCTA><Link to="/membership"><BubbleButton tone="flame">See membership options</BubbleButton></Link></PrimaryCTA>
    </Panel>
  );
}

function Dashboard() {
  const { isCoach } = useRedirectPlayersToLockerRoom();
  const me = useMe();
  const { teams, team, teamId, setTeam } = useCurrentTeam();
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });
  const teamLogo = useQuery({
    queryKey: ["team-logo", team?.id],
    queryFn: () => logoSignedUrl(team?.logo_url),
    enabled: !!team?.logo_url,
  });

  const live = (games.data ?? []).filter((g) => g.status !== "final" && g.team_id === teamId);
  const greeting = me.profile?.full_name?.split(" ")[0] || "Coach";

  return (
    <AppShell
      title={`Welcome back, ${greeting}`}
      subtitle={team ? `${team.name} · ${team.season}` : (me.org?.name ?? "Your basketball program")}
      logoUrl={teamLogo.data ?? null}
    >
      <Panel className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0 text-center sm:text-left">
          <Label>Current team</Label>
          <h2 className="mt-2 truncate text-xl font-black text-foreground">{team ? team.name : "No team yet"}</h2>
          {team ? <p className="text-sm font-semibold text-muted-foreground">{team.season}</p> : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {teams.length > 1 ? (
            teams
              .filter((t) => t.id !== teamId)
              .slice(0, 4)
              .map((t) => (
                <BubbleButton key={t.id} size="sm" tone="neutral" onClick={() => setTeam(t.id)}>
                  Switch to {t.name}
                </BubbleButton>
              ))
          ) : (
            <Link to="/roster">
              <BubbleButton size="sm" tone="neutral">
                Manage teams
              </BubbleButton>
            </Link>
          )}
        </div>
      </Panel>

      {live.length ? (
        <Panel className="mb-3 flex flex-wrap items-center gap-2">
          <Pill tone="flame">In progress</Pill>
          {live.map((g) => (
            <Link key={g.id} to="/game/$gameId" params={{ gameId: g.id }}>
              <BubbleButton size="sm" tone="flame">
                vs {g.opponent} · resume live court
              </BubbleButton>
            </Link>
          ))}
        </Panel>
      ) : null}

      <TodayStrip teamId={teamId} />

      <div className="mb-3">
        <PlayOfTheDayCard canAdd={isCoach} />
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        {PRIMARY.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              to={c.to}
              className={cn(
                "group flex min-h-[128px] flex-col justify-between rounded-3xl border border-border/70 bg-surface/80 p-4 shadow-lg shadow-black/30 transition-all hover:-translate-y-0.5 hover:border-grape/70 active:scale-[0.99]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-2xl border border-border bg-surface-2/80 px-3 py-2 text-xl font-black leading-tight text-foreground sm:text-2xl">
                  {c.title}
                </span>
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-grape/60 bg-grape/20 text-grape-bright"
                >
                  <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                </span>
              </div>
              {c.blurb ? <InfoPanel className="mt-3">{c.blurb}</InfoPanel> : null}
            </Link>
          );
        })}
      </div>

      <Panel className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <Label>More tools</Label>
        {SECONDARY.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.title} to={c.to}>
              <BubbleButton tone="neutral">
                <Icon className="h-4 w-4" aria-hidden />
                {c.title}
              </BubbleButton>
            </Link>
          );
        })}
      </Panel>

      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <CoachNotes />
        <MembershipCard teamId={teamId} />
      </div>

      <FollowedCreators />

      {isCoach ? <PlayerQrPanel teams={teams} /> : null}

      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Parents & families</Label>
        <InfoPanel className="sm:flex-1">Read-only stats and schedule link. No playbook, no account needed.</InfoPanel>
        <Link to="/locker">
          <BubbleButton size="sm" tone="neutral">
            <KeyRound className="h-4 w-4" aria-hidden />
            Share link
          </BubbleButton>
        </Link>
      </Panel>

      <InstallAppCard />

      {!teams.length ? (
        <Panel className="mt-3 flex flex-col gap-2">
          <Label>Start here</Label>
          <EmptyState>Try the product first — set up your team whenever you are ready</EmptyState>
          <div className="flex flex-wrap gap-2">
            <Link to="/plays" search={{ tab: "library" }}>
              <BubbleButton tone="grape">Watch a play</BubbleButton>
            </Link>
            <Link to="/plays/new">
              <BubbleButton tone="flame">Build a play</BubbleButton>
            </Link>
            <Link to="/roster">
              <BubbleButton tone="neutral">Set up my team</BubbleButton>
            </Link>
          </div>
        </Panel>
      ) : null}
    </AppShell>
  );
}
