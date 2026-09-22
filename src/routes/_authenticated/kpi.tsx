/**
 * My KPI — CoachSide owner analytics.
 *
 * The page hides itself from anyone who is not on the owner list, and every
 * number comes from a server function that re-checks ownership before it
 * touches the database. Nothing here is customer facing.
 */
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  InfoPanel,
  Label,
  Panel,
  Pill,
  PrimaryCTA,
  SectionHeader,
  StatTile,
} from "@/components/Bubbles";
import {
  RANGES,
  RANGE_LABEL,
  amIAppAdmin,
  getKpiReport,
  type KpiReport,
  type RangeKey,
} from "@/lib/kpi.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/kpi")({
  head: () => ({
    meta: [
      { title: "My KPI — CoachSide owner dashboard" },
      {
        name: "description",
        content: "Owner-only CoachSide dashboard for signups, activity, memberships and game usage.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "My KPI — CoachSide" },
      { property: "og:description", content: "Owner-only CoachSide operations dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KpiPage,
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Tiny dependency-free bar chart. Mobile friendly, no chart library. */
function Sparkbars({ data, tone }: { data: { day: string; value: number }[]; tone: "grape" | "flame" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const color = tone === "grape" ? "bg-grape" : "bg-flame";
  return (
    <div className="flex h-24 w-full items-end gap-[2px]">
      {data.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.value}`}
          className={`flex-1 rounded-t-sm ${color}`}
          style={{ height: `${Math.max(3, (d.value / max) * 100)}%`, opacity: d.value ? 1 : 0.25 }}
        />
      ))}
    </div>
  );
}

function TrendPanel({
  title,
  data,
  tone,
}: {
  title: string;
  data: { day: string; value: number }[];
  tone: "grape" | "flame";
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <InfoPanel className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{title}</Label>
        <Pill tone={tone}>{total} in 30 days</Pill>
      </div>
      <Sparkbars data={data} tone={tone} />
    </InfoPanel>
  );
}

type SortKey = "newest" | "active" | "inactive";

function KpiPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(amIAppAdmin);
  const fetchReport = useServerFn(getKpiReport);
  const [range, setRange] = useState<RangeKey>("30d");

  const [sort, setSort] = useState<SortKey>("newest");

  // Owner check is per signed-in person and answered by the server, so one
  // account can never inherit another account's access on the same device.
  const { user } = useAuth();
  const adminQ = useQuery({
    queryKey: ["am-i-app-admin", user?.id ?? "signed-out"],
    queryFn: () => checkAdmin(),
    enabled: !!user,
    staleTime: 300_000,
  });
  const isAdmin = adminQ.data === true;

  // Anyone who is not an owner is sent away before any numbers are requested.
  useEffect(() => {
    if (!adminQ.isLoading && adminQ.isFetched && !isAdmin) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [adminQ.isLoading, adminQ.isFetched, isAdmin, navigate]);

  const reportQ = useQuery({
    queryKey: ["kpi-report", user?.id ?? "signed-out", range],
    queryFn: () => fetchReport({ data: { range } }) as Promise<KpiReport>,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  if (!user || adminQ.isLoading) {
    return (
      <AppShell title="My KPI" subtitle="Checking access…">
        <Panel>
          <EmptyState>Loading…</EmptyState>
        </Panel>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="My KPI" subtitle="This dashboard is for CoachSide owners only.">
        <Panel className="flex flex-col items-center gap-3">
          <InfoPanel tone="danger">
            You do not have access to this page. No information is shown here.
          </InfoPanel>
          <PrimaryCTA>
            <BubbleButton tone="grape" onClick={() => navigate({ to: "/dashboard", replace: true })}>
              Back to dashboard
            </BubbleButton>
          </PrimaryCTA>
        </Panel>
      </AppShell>
    );
  }

  const r = reportQ.data;
  const money = (n: number) => `$${n.toLocaleString()}`;

  const coaches = (() => {
    const list = [...(r?.coaches ?? [])];
    if (sort === "newest") return list.sort((a, b) => (a.signedUp < b.signedUp ? 1 : -1));
    if (sort === "active")
      return list.sort((a, b) => ((a.lastActivity ?? "") < (b.lastActivity ?? "") ? 1 : -1));
    return list.sort((a, b) => ((a.lastActivity ?? "") > (b.lastActivity ?? "") ? 1 : -1));
  })();

  return (
    <AppShell title="My KPI" subtitle="Owner-only view of signups, usage, content and memberships." wide>
      <div className="flex flex-col gap-4">
        <Panel className="flex flex-col items-center gap-3">
          <Label>Date range</Label>
          <PrimaryCTA>
            {RANGES.map((key) => (
              <BubbleButton
                key={key}
                tone={range === key ? "flame" : "neutral"}
                active={range === key}
                onClick={() => setRange(key)}
              >
                {RANGE_LABEL[key]}
              </BubbleButton>
            ))}
          </PrimaryCTA>
          <p className="text-xs font-semibold text-muted-foreground">
            {reportQ.isFetching
              ? "Refreshing live data…"
              : r
                ? `Live data · updated ${fmtWhen(r.generatedAt)}`
                : "—"}
          </p>
        </Panel>

        {reportQ.error ? (
          <Panel>
            <InfoPanel tone="danger">Could not load KPI data. Try again in a moment.</InfoPanel>
          </Panel>
        ) : null}

        {!r ? (
          <Panel>
            <EmptyState>Loading your numbers…</EmptyState>
          </Panel>
        ) : (
          <>
            {/* 1 — headline numbers */}
            <Panel className="flex flex-col gap-3">
              <SectionHeader
                as="h2"
                title="Headline numbers"
                subtitle={`Coach accounts exclude player-only and parent accounts. Period: ${RANGE_LABEL[r.range]}.`}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <StatTile label="Coach accounts" value={r.totals.coachAccounts} tone="grape" />
                <StatTile label="New coaches" value={r.totals.newCoaches} tone="flame" />
                <StatTile label="Active coaches" value={r.totals.activeCoaches} tone="grape" />
                <StatTile label="Teams" value={r.totals.teams} hint={`+${r.totals.teamsInPeriod} in period`} />
                <StatTile label="Plays created" value={r.totals.plays} hint={`+${r.totals.playsInPeriod} in period`} />
                <StatTile label="Published plays" value={r.totals.publishedPlays} />
                <StatTile label="Games started" value={r.totals.gamesStarted} tone="flame" />
                <StatTile label="Games completed" value={r.totals.gamesCompleted} />
                <StatTile label="Paid teams" value={r.totals.paidTeams} />
                <StatTile label="Complimentary" value={r.totals.complimentaryTeams} />
                <StatTile
                  label="Monthly revenue"
                  value={r.totals.billingLive ? money(r.totals.mrr) : "$0"}
                  hint={r.totals.billingLive ? "Active paid plans" : "Billing not live yet"}
                  tone="flame"
                />
              </div>
            </Panel>

            {/* 2 — membership */}
            <Panel className="flex flex-col gap-3">
              <SectionHeader as="h2" title="Membership snapshot" subtitle="One recurring charge per team." />
              <InfoPanel>
                <ul className="flex flex-col gap-1.5">
                  {r.membership.tiers.map((t) => (
                    <li key={t.label} className="flex items-center justify-between gap-3">
                      <span>{t.label}</span>
                      <span className="font-black text-foreground">
                        {t.teams} {t.teams === 1 ? "team" : "teams"}
                        {t.monthly ? ` · ${money(t.monthly)}/mo` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </InfoPanel>
              <InfoPanel tone="grape">
                <ul className="flex flex-col gap-1.5">
                  {r.membership.statuses.map((s) => (
                    <li key={s.label} className="flex items-center justify-between gap-3">
                      <span className="capitalize">{s.label.replace(/_/g, " ")}</span>
                      <span className="font-black">{s.teams}</span>
                    </li>
                  ))}
                </ul>
              </InfoPanel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatTile label="Active paid teams" value={r.membership.activePaidTeams} />
                <StatTile label="Complimentary teams" value={r.membership.complimentary} />
                <StatTile
                  label="MRR"
                  value={r.membership.billingLive ? money(r.membership.mrr) : "$0"}
                  hint={r.membership.billingLive ? "Paid plans only" : "Billing not live yet"}
                  tone="flame"
                />
              </div>
            </Panel>

            {/* 3 — activity */}
            <Panel className="flex flex-col gap-3">
              <SectionHeader
                as="h2"
                title="Coach activity"
                subtitle="Real actions rebuilt from live data, newest first."
              />
              {r.activity.length === 0 ? (
                <EmptyState>No coach activity in this period.</EmptyState>
              ) : (
                <InfoPanel className="max-h-[420px] overflow-y-auto">
                  <ul className="flex flex-col gap-2">
                    {r.activity.map((a, i) => (
                      <li
                        key={`${a.at}-${i}`}
                        className="flex flex-col gap-1 border-b border-border/40 pb-2 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <Pill tone="grape">{a.type}</Pill>
                          <span className="font-bold">{a.who}</span>
                          <span className="text-muted-foreground">{a.detail}</span>
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">{fmtWhen(a.at)}</span>
                      </li>
                    ))}
                  </ul>
                </InfoPanel>
              )}
            </Panel>

            {/* 4 — coaches table */}
            <Panel className="flex flex-col gap-3">
              <SectionHeader
                as="h2"
                title="Coaches"
                subtitle="New = signed up in 7 days. Active recently = a real action in 30 days."
              />
              <PrimaryCTA>
                {(["newest", "active", "inactive"] as SortKey[]).map((k) => (
                  <BubbleButton
                    key={k}
                    size="sm"
                    tone={sort === k ? "grape" : "neutral"}
                    active={sort === k}
                    onClick={() => setSort(k)}
                  >
                    {k === "newest" ? "Newest" : k === "active" ? "Most active" : "Least active"}
                  </BubbleButton>
                ))}
              </PrimaryCTA>
              <div className="w-full overflow-x-auto rounded-2xl border border-border/70 bg-surface-2/60">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Coach</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Signed up</th>
                      <th className="px-3 py-2">Last activity</th>
                      <th className="px-3 py-2">Teams</th>
                      <th className="px-3 py-2">Plays</th>
                      <th className="px-3 py-2">Games</th>
                      <th className="px-3 py-2">Tier</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-semibold text-foreground">
                    {coaches.map((c) => (
                      <tr key={c.userId} className="border-t border-border/40">
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                        <td className="px-3 py-2">{fmtDate(c.signedUp)}</td>
                        <td className="px-3 py-2">{fmtDate(c.lastActivity)}</td>
                        <td className="px-3 py-2">{c.teams}</td>
                        <td className="px-3 py-2">{c.plays}</td>
                        <td className="px-3 py-2">
                          {c.gamesStarted}/{c.gamesCompleted}
                        </td>
                        <td className="px-3 py-2">{c.tier}</td>
                        <td className="px-3 py-2">
                          <Pill
                            tone={
                              c.status === "Inactive" ? "muted" : c.status === "New" ? "flame" : "success"
                            }
                          >
                            {c.status}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* 5 — content */}
            <Panel className="flex flex-col gap-3">
              <SectionHeader as="h2" title="Library and community" subtitle="Published play activity." />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Published plays" value={r.content.publishedTotal} tone="grape" />
                <StatTile label="Plays in period" value={r.content.createdInPeriod} />
                <StatTile label="Hearts in period" value={r.content.heartsInPeriod} tone="flame" />
                <StatTile label="Coach follows" value={r.content.follows} />
              </div>
              <InfoPanel>
                Play of the Day: <strong>{r.content.playOfTheDay ?? "None selected"}</strong>
              </InfoPanel>
              <InfoPanel>
                <Label>Most hearted plays</Label>
                {r.content.topPlays.length === 0 ? (
                  <p className="mt-2 text-muted-foreground">Not tracked yet — no published plays.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {r.content.topPlays.map((p) => (
                      <li key={p.name} className="flex items-center justify-between gap-3">
                        <span>
                          {p.name} <span className="text-muted-foreground">· {p.author}</span>
                        </span>
                        <span className="font-black">{p.hearts} ♥</span>
                      </li>
                    ))}
                  </ul>
                )}
              </InfoPanel>
              <InfoPanel>
                <Label>Top public creators</Label>
                {r.content.topCreators.length === 0 ? (
                  <p className="mt-2 text-muted-foreground">Not tracked yet — no named creators.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {r.content.topCreators.map((c) => (
                      <li key={c.name} className="flex items-center justify-between gap-3">
                        <span>{c.name}</span>
                        <span className="font-black">
                          {c.hearts} ♥ · {c.followers} followers
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </InfoPanel>
            </Panel>

            {/* 6 — game usage */}
            <Panel className="flex flex-col gap-3">
              <SectionHeader as="h2" title="Live Game usage" subtitle="Is the court actually being used?" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <StatTile label="Games started" value={r.games.started} tone="flame" />
                <StatTile label="Games completed" value={r.games.completed} />
                <StatTile label="Teams using Live Game" value={r.games.uniqueTeams} tone="grape" />
                <StatTile label="Avg games / team" value={r.games.avgPerActiveTeam} />
                <StatTile label="Stat events" value={r.games.statEvents} />
              </div>
            </Panel>

            {/* 7 — trends */}
            <Panel className="flex flex-col gap-3">
              <SectionHeader as="h2" title="Last 30 days" subtitle="Daily trend for the things that matter." />
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                <TrendPanel title="Coach signups" data={r.trends.signups} tone="grape" />
                <TrendPanel title="Plays created" data={r.trends.plays} tone="flame" />
                <TrendPanel title="Games started" data={r.trends.games} tone="flame" />
                <TrendPanel title="Active coaches" data={r.trends.activeCoaches} tone="grape" />
              </div>
            </Panel>
          </>
        )}

        <SendNotificationPanel />
      </div>
    </AppShell>
  );
}
