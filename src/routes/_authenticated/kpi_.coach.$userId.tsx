/**
 * Owner-only, read-only Coach Usage view. Counts and recent actions only —
 * never message contents, contact details or account secrets.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, InfoPanel, Panel, Pill, SectionHeader, StatTile } from "@/components/Bubbles";
import { OwnerGate } from "@/components/admin/OwnerGate";
import { getOwnerCoachUsage, type CoachUsage } from "@/lib/ownerUsage.functions";
import { MODE_LABEL } from "@/lib/gameUsage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kpi_/coach/$userId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Coach Usage — CoachSide owner" },
      { name: "description", content: "Owner-only, read-only summary of how one coach uses CoachSide." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Coach Usage — CoachSide" },
      { property: "og:description", content: "Owner-only coach usage summary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <OwnerGate title="Coach Usage">
      <CoachUsagePage />
    </OwnerGate>
  ),
});

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtWhen = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

function CoachUsagePage() {
  const { userId } = Route.useParams();
  const fetchUsage = useServerFn(getOwnerCoachUsage);
  const q = useQuery({
    queryKey: ["owner-coach-usage", userId],
    queryFn: () => fetchUsage({ data: { userId } }) as Promise<CoachUsage>,
    staleTime: 30_000,
  });

  if (q.error || !q.data) {
    return (
      <AppShell title="Coach Usage" backTo="/kpi" backLabel="My KPI">
        <Panel>
          {q.error ? (
            <InfoPanel tone="danger">{(q.error as Error).message || "Could not load this coach."}</InfoPanel>
          ) : (
            <EmptyState>Loading coach…</EmptyState>
          )}
        </Panel>
      </AppShell>
    );
  }
  const u = q.data;
  const ageDays = u.signedUp ? Math.max(0, Math.floor((Date.now() - new Date(u.signedUp).getTime()) / 86_400_000)) : null;
  const c = u.counts;

  return (
    <AppShell title={u.name} subtitle="Owner-only coach usage · read-only, counts only." backTo="/kpi" backLabel="My KPI" wide>
      <div className="flex flex-col gap-4">
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill tone="grape">{u.email}</Pill>
            <Pill tone="muted">{q.isFetching ? "Refreshing…" : `Updated ${fmtWhen(u.fetchedAt)}`}</Pill>
            <BubbleButton size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} aria-hidden /> Refresh
            </BubbleButton>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Account age" value={ageDays == null ? "—" : `${ageDays}d`} hint={`Signed up ${fmtDate(u.signedUp)}`} />
            <StatTile label="Last activity" value={<span className="text-sm">{fmtWhen(u.lastActivity)}</span>} />
            <StatTile label="Teams coached" value={u.teams.length} tone="grape" />
            <StatTile label="Google Calendar" value={u.calendar.connected ? "Connected" : "No"} hint={u.calendar.connected ? (u.calendar.syncing ? "Syncing on" : "Sync paused") : undefined} />
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="Teams and membership" />
          {u.teams.length === 0 ? (
            <EmptyState>Not a coach on any team.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {u.teams.map((t) => (
                <InfoPanel key={t.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-black">{t.name}</span>
                  {t.season ? <Pill tone="muted">{t.season}</Pill> : null}
                  <Pill tone="muted" className="capitalize">{t.role}</Pill>
                  <Pill tone="grape">{t.tier}</Pill>
                  <Pill tone="muted" className="capitalize">{t.status.replace(/_/g, " ")}</Pill>
                  <Pill tone="muted">{t.players} players</Pill>
                </InfoPanel>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="Usage" subtitle="Counts only. Message contents are never shown." />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            <StatTile label="Plays created" value={c.playsCreated} tone="grape" />
            <StatTile label="Plays published" value={c.playsPublished} />
            <StatTile label="Library adds" value={c.libraryAdds} />
            <StatTile label="Play exports" value={c.playExports} />
            <StatTile label="Drills created" value={c.drillsCreated} />
            <StatTile label="Games started" value={c.gamesStarted} tone="flame" />
            <StatTile label="Games completed" value={c.gamesCompleted} />
            <StatTile label="Stat events" value={c.statEvents} />
            <StatTile label="Post-game edits" value={c.postGameEdits} />
            <StatTile label="Sign-ins logged" value={c.signIns} />
            <StatTile label="Announcements" value={c.announcements} />
            <StatTile label="Assignments" value={c.assignments} />
            <StatTile label="Practice plans" value={c.practicePlans} />
            <StatTile label="Schedule events" value={c.teamEvents} />
            <StatTile label="Messages sent" value={c.messagesSent} hint="Count only" />
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="Recent games" subtitle="Tap Inspect to see exactly how Live Game was used." />
          {u.games.length === 0 ? (
            <EmptyState>No games yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {u.games.map((g) => (
                <li key={g.id}>
                  <InfoPanel className="flex flex-wrap items-center gap-2">
                    <span className="font-black">vs {g.opponent}</span>
                    <Pill tone="muted">{g.teamName}</Pill>
                    <Pill tone="muted">{g.gameDate}</Pill>
                    {g.status === "final" ? <Pill tone="success">Final</Pill> : <Pill tone="flame">Live / in progress</Pill>}
                    <Pill tone="grape">{MODE_LABEL[g.mode]}</Pill>
                    <Pill tone="muted">{g.events} events</Pill>
                    <Link to="/kpi/game/$gameId" params={{ gameId: g.id }} className="ml-auto">
                      <BubbleButton size="sm" tone="grape" tabIndex={-1}>
                        Inspect <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </BubbleButton>
                    </Link>
                  </InfoPanel>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="Recent activity" />
          {u.recent.length === 0 ? (
            <EmptyState>No recorded activity.</EmptyState>
          ) : (
            <InfoPanel className="max-h-[420px] overflow-y-auto">
              <ul className="flex flex-col gap-2">
                {u.recent.map((a, i) => {
                  const body = (
                    <>
                      <span className="flex flex-wrap items-center gap-2">
                        <Pill tone="grape">{a.type}</Pill>
                        {a.detail ? <span className="text-muted-foreground">{a.detail}</span> : null}
                      </span>
                      <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        {fmtWhen(a.at)}
                        {a.gameId ? <Pill tone="flame">Inspect <ChevronRight className="h-3 w-3" aria-hidden /></Pill> : null}
                      </span>
                    </>
                  );
                  const cls = "flex flex-col gap-1 border-b border-border/40 pb-2 last:border-0 sm:flex-row sm:items-center sm:justify-between";
                  return (
                    <li key={`${a.at}-${i}`}>
                      {a.gameId ? (
                        <Link to="/kpi/game/$gameId" params={{ gameId: a.gameId }} className={cn(cls, "rounded-xl hover:bg-surface/60")}>
                          {body}
                        </Link>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </InfoPanel>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
