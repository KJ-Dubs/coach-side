import { TipInterstitial } from "@/components/TipInterstitial";
import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, InfoList, InfoPanel, Label, Panel, PrimaryCTA } from "@/components/Bubbles";
import { fetchTeamEvents, fetchGames, logoSignedUrl } from "@/lib/data";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { fetchMyMemberships, isCoachRole } from "@/lib/locker";
import { useMe } from "@/lib/useMe";
import { PlayerQrPanel } from "@/components/PlayerQrPanel";
import { useAccess, resolveRole } from "@/lib/access";
import { consumePendingInvite } from "@/lib/pendingInvite";
import { TrialStatus } from "@/components/billing/TrialStatus";
import { HelpCard, ProgressCard } from "@/components/ProgressCard";
import { EnablePushCard } from "@/components/EnablePushCard";
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
    <Panel className="grid gap-4 px-4 py-4 text-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:text-left">
      <div className="min-w-0">
        <Label>Up next</Label>
        {next ? (
          <div className="mt-2 min-w-0">
            <h2 className="break-words text-lg font-black leading-tight text-foreground sm:text-xl">
              {next.title}
            </h2>
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
      <Link to="/calendar" className="w-full max-w-[360px] justify-self-center sm:w-auto sm:justify-self-end">
        <BubbleButton size="sm" tone="neutral" className="w-full justify-center sm:w-auto">
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
    <Panel className="grid gap-4 border-flame/60 bg-flame/10 px-4 py-4 text-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:text-left">
      <div className="min-w-0">
        <Label>Game today</Label>
        <h2 className="mt-2 break-words text-xl font-black leading-tight text-foreground">{game.opponent ? `vs ${game.opponent}` : game.title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{new Date(game.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{game.location ? ` · ${game.location}` : ""}</p>
      </div>
      <Link to="/games/new" className="w-full max-w-[360px] justify-self-center sm:w-auto sm:justify-self-end">
        <BubbleButton tone="flame" size="lg" className="min-h-14 w-full justify-center sm:w-auto">
          ▶ Start Live Game
        </BubbleButton>
      </Link>
    </Panel>
  );
}

/** Membership prompt. Hidden once a team holds all three modules. */
function MembershipCard({ teamId }: { teamId: string | null }) {
  const entitlement = useEntitlement(teamId);
  if (entitlement.complete || entitlement.trialActive) return null;
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
      balancedTitle
    >
      {isCoach ? <TipInterstitial dest="dashboard" /> : null}
      <div className="space-y-4">
      <Panel className="flex flex-col items-center gap-3 px-4 py-4 text-center">
        <div className="min-w-0">
          <Label>Current team</Label>
          <h2 className="mt-2 break-words text-xl font-black text-foreground">{team ? team.name : "No team yet"}</h2>
          {team ? <p className="text-sm font-semibold text-muted-foreground">{team.season}</p> : null}
        </div>
        <div className="flex w-full max-w-[360px] flex-col items-stretch gap-2">
          {teams.length > 1 ? (
            teams
              .filter((t) => t.id !== teamId)
              .slice(0, 4)
              .map((t) => (
                <BubbleButton key={t.id} size="sm" tone="neutral" className="w-full justify-center text-center" onClick={() => setTeam(t.id)}>
                  Switch to {t.name}
                </BubbleButton>
              ))
          ) : (
            <Link to="/roster" className="w-full">
              <BubbleButton size="sm" tone="neutral" className="w-full justify-center text-center">
                Manage teams
              </BubbleButton>
            </Link>
          )}
        </div>
      </Panel>

      {live.length ? (
        <Panel className="flex flex-col items-center gap-3 px-4 py-4 text-center">
          <Label>In progress</Label>
          <div className="flex w-full flex-col items-center gap-2.5">
            {live.map((g) => (
              <Link key={g.id} to="/game/$gameId" params={{ gameId: g.id }} className="w-full max-w-[520px]">
                <BubbleButton tone="flame" size="lg" className="min-h-14 w-full justify-center text-center">
                  vs {g.opponent} · Resume Live Court
                </BubbleButton>
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      <TodayStrip teamId={teamId} />

      <TrialStatus teamId={teamId} />

      {isCoach ? (
        <div>
          <ProgressCard />
        </div>
      ) : null}

      <div>
        <PlayOfTheDayCard canAdd={isCoach} />
      </div>

      <HelpCard />

      <EnablePushCard />
      </div>

      <div className="mt-4">
        <MembershipCard teamId={teamId} />
      </div>

      <FollowedCreators />

      {isCoach ? <PlayerQrPanel teams={teams} /> : null}

      <Panel className="mt-4 flex flex-wrap items-center gap-2">
        <Label>Parents & families</Label>
        <InfoPanel className="sm:flex-1">Read-only stats and schedule link. No playbook, no account needed.</InfoPanel>
        <Link to="/locker">
          <BubbleButton size="sm" tone="neutral">
            <KeyRound className="h-4 w-4" aria-hidden />
            Share link
          </BubbleButton>
        </Link>
      </Panel>

      {!teams.length ? (
        <Panel className="mt-4 flex flex-col gap-2">
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
