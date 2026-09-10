import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  CircleUserRound,
  ClipboardPenLine,
  Clock3,
  Settings,
  KeyRound,
  Swords,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { CalendarDays, MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Panel, Pill, StatTile } from "@/components/Bubbles";
import { fetchTeamEvents, fetchGames, fetchAllPlayers, fetchPlays, logoSignedUrl } from "@/lib/data";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { fetchMyMemberships, isCoachRole } from "@/lib/locker";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

/** Players and parents land in the Locker Room instead of the coach dashboard. */
function useRedirectPlayersToLockerRoom() {
  const navigate = useNavigate();
  const memberships = useQuery({ queryKey: ["my-memberships"], queryFn: fetchMyMemberships });
  useEffect(() => {
    const rows = memberships.data ?? [];
    if (!rows.length) return;
    if (rows.every((m) => !isCoachRole(m.role))) navigate({ to: "/lockerroom", replace: true });
  }, [memberships.data, navigate]);
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Coach Dashboard — CoachSide" },
      {
        name: "description",
        content: "Start a game, design plays, open the playbook and review team and player stats.",
      },
      { property: "og:title", content: "Coach Dashboard — CoachSide" },
      { property: "og:description", content: "Your basketball coaching home base." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type CardDef = {
  to: NonNullable<LinkProps["to"]>;
  title: string;
  blurb: string;
  action: string;
  tone: "flame" | "grape" | "blue" | "gold" | "teal" | "rose" | "green" | "sky" | "coral";
  icon: LucideIcon;
};

const CARDS: CardDef[] = [
  {
    to: "/games/new",
    title: "Start a Game",
    blurb: "Pick the team, opponent and starting five, then run live stats from the court.",
    action: "Set up game",
    tone: "flame",
    icon: Swords,
  },
  {
    to: "/lockerroom",
    title: "Locker Room",
    blurb: "Team announcements, chat, assignments, plays and schedule for coaches, players and families.",
    action: "Open Locker Room",
    tone: "grape",
    icon: MessagesSquare,
  },
  {
    to: "/plays/new",
    title: "Create Plays",
    blurb: "Open a fresh frame-by-frame diagram: passes, cuts, curls, dribbles and screens.",
    action: "New play",
    tone: "grape",
    icon: ClipboardPenLine,
  },
  {
    to: "/plays",
    title: "Playbook",
    blurb: "Browse Offense, BLOB, SLOB, Defense, Press Break and Presses. Present or share.",
    action: "Open playbook",
    tone: "blue",
    icon: BookOpen,
  },
  {
    to: "/stats/team",
    title: "Team Stats",
    blurb: "Record, points per game, shooting splits and a team shot chart from saved games.",
    action: "Team stats",
    tone: "gold",
    icon: BarChart3,
  },
  {
    to: "/stats/players",
    title: "Player Stats",
    blurb: "Per-player minutes, scoring, rebounds, splits and shot chart for the season.",
    action: "Player stats",
    tone: "teal",
    icon: Target,
  },
  {
    to: "/roster",
    title: "Rosters",
    blurb: "Every player across your teams with games, points and minutes. Add teams and players.",
    action: "Player directory",
    tone: "rose",
    icon: UsersRound,
  },
  {
    to: "/games",
    title: "Game History",
    blurb: "Every saved game with final score, W/L and a link straight into the review and PDF.",
    action: "History",
    tone: "green",
    icon: Clock3,
  },
  {
    to: "/calendar",
    title: "Calendar / Schedule",
    blurb: "Practices, games and team events with arrival times, uniforms and reminders.",
    action: "View calendar",
    tone: "gold",
    icon: CalendarDays,
  },
  {
    to: "/locker",
    title: "Public Share Link",
    blurb: "For parents and families: read-only team and player stats plus the calendar. No playbook, no account.",
    action: "Share the link",
    tone: "teal",
    icon: KeyRound,
  },
  {
    to: "/settings",
    title: "Settings",
    blurb: "Team name, logo, season, coaches, game defaults and assistant-coach invites.",
    action: "Settings",
    tone: "sky",
    icon: Settings,
  },
  {
    to: "/profile",
    title: "Profile",
    blurb: "Your coach name, email, role and the teams you have access to.",
    action: "Profile",
    tone: "coral",
    icon: CircleUserRound,
  },
];

function SchedulePanel() {
  const me = useMe();
  const teamId = me.teams[0]?.id ?? "";
  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchTeamEvents(teamId),
    enabled: !!teamId,
  });
  const now = Date.now();
  const upcoming = (events.data ?? [])
    .filter((e) => new Date(e.starts_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const pick = (kinds: string[]) => upcoming.find((e) => kinds.includes(e.event_type)) ?? null;
  const rows = [
    ["Next practice", pick(["practice", "workout"])],
    ["Next game", pick(["game", "tournament"])],
    ["Next team event", upcoming.find((e) => !["practice", "workout", "game", "tournament"].includes(e.event_type)) ?? null],
  ] as const;

  return (
    <Panel className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="flame">Calendar / Schedule</Pill>
        <div className="ml-auto flex gap-2">
          <Link to="/calendar">
            <BubbleButton size="sm" tone="grape">View Calendar</BubbleButton>
          </Link>
          <Link to="/calendar">
            <BubbleButton size="sm" tone="flame">+ Event</BubbleButton>
          </Link>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {rows.map(([label, e]) => (
          <div key={label} className="flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-surface-2/70 p-3">
            <Pill tone="neutral">{label}</Pill>
            {e ? (
              <>
                <Pill tone="muted">{e.title}</Pill>
                <Pill tone="muted">
                  {new Date(e.starts_at).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Pill>
                {e.location ? <Pill tone="muted">{e.location}</Pill> : null}
              </>
            ) : (
              <Pill tone="muted">Nothing scheduled</Pill>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Dashboard() {
  useRedirectPlayersToLockerRoom();
  const me = useMe();
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });
  const players = useQuery({ queryKey: ["players", "all"], queryFn: fetchAllPlayers });
  const plays = useQuery({ queryKey: ["plays"], queryFn: fetchPlays });
  const logoTeam = me.teams.find((t) => t.logo_url);
  const teamLogo = useQuery({
    queryKey: ["team-logo", logoTeam?.id],
    queryFn: () => logoSignedUrl(logoTeam?.logo_url),
    enabled: !!logoTeam?.logo_url,
  });

  const live = (games.data ?? []).filter((g) => g.status !== "final");
  const finals = (games.data ?? []).filter((g) => g.status === "final");
  const greeting = me.profile?.full_name?.split(" ")[0] || "Coach";
  const cardTone = {
    flame: "border-flame/70 bg-flame/10 hover:bg-flame/15",
    grape: "border-grape/70 bg-grape/10 hover:bg-grape/15",
    blue: "border-blue/70 bg-blue/10 hover:bg-blue/15",
    gold: "border-gold/70 bg-gold/10 hover:bg-gold/15",
    teal: "border-teal/70 bg-teal/10 hover:bg-teal/15",
    rose: "border-rose/70 bg-rose/10 hover:bg-rose/15",
    green: "border-green/70 bg-green/10 hover:bg-green/15",
    sky: "border-sky/70 bg-sky/10 hover:bg-sky/15",
    coral: "border-coral/70 bg-coral/10 hover:bg-coral/15",
  } as const;
  const accentTone = {
    flame: "border-flame/60 bg-flame/20 text-flame",
    grape: "border-grape/60 bg-grape/20 text-grape-bright",
    blue: "border-blue/60 bg-blue/20 text-blue",
    gold: "border-gold/60 bg-gold/20 text-gold",
    teal: "border-teal/60 bg-teal/20 text-teal",
    rose: "border-rose/60 bg-rose/20 text-rose",
    green: "border-green/60 bg-green/20 text-green",
    sky: "border-sky/60 bg-sky/20 text-sky",
    coral: "border-coral/60 bg-coral/20 text-coral",
  } as const;

  return (
    <AppShell
      title={`Welcome back, ${greeting}`}
      subtitle={me.org?.name ?? "Your basketball program"}
      logoUrl={teamLogo.data ?? null}
    >
      <Panel className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Teams" value={me.teams.length} tone="grape" />
        <StatTile label="Players" value={players.data?.length ?? "—"} />
        <StatTile label="Saved games" value={finals.length} />
        <StatTile label="Plays" value={plays.data?.length ?? "—"} tone="flame" />
      </Panel>

      <SchedulePanel />

      {live.length ? (
        <Panel className="mb-3 flex flex-wrap items-center gap-2">
          <Pill tone="flame">In progress</Pill>
          {live.map((g) => (
            <Link key={g.id} to="/game/$gameId" params={{ gameId: g.id }}>
              <BubbleButton size="sm" tone="grape">
                vs {g.opponent} · resume live court
              </BubbleButton>
            </Link>
          ))}
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              to={c.to}
              className={cn(
                "group flex min-h-[176px] flex-col justify-between rounded-3xl border border-l-4 p-4 shadow-lg shadow-black/30 transition-all hover:-translate-y-0.5 active:scale-[0.99]",
                cardTone[c.tone],
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-2xl border border-border bg-surface-2/80 px-3 py-2 text-xl font-black leading-tight text-foreground sm:text-2xl">
                  {c.title}
                </span>
                <span aria-hidden className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl border", accentTone[c.tone])}>
                  <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                </span>
              </div>
              <p className="my-3 rounded-2xl border border-border/50 bg-surface-2/70 px-3 py-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                {c.blurb}
              </p>
              <span className={cn("inline-flex w-fit rounded-full border px-4 py-2 text-sm font-bold", accentTone[c.tone])}>
                {c.action} →
              </span>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
