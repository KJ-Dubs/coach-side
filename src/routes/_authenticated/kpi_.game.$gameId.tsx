/**
 * Owner-only, read-only Game Usage Inspector. Shows exactly how a coach used
 * Live Game for one game. Never edits the game and never touches the
 * coach's live session — it only reads through an owner-checked server call.
 */
import { useMemo, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, InfoPanel, Label, Panel, Pill, SectionHeader, StatTile } from "@/components/Bubbles";
import { OwnerGate } from "@/components/admin/OwnerGate";
import { ShotChart } from "@/components/court/ShotChart";
import { TrackingCoverageCard } from "@/components/game/TrackingCoverage";
import { getOwnerGameUsage, type OwnerGamePayload } from "@/lib/ownerUsage.functions";
import {
  MODE_LABEL,
  buildTimeline,
  elapsedSeconds,
  fmtDuration,
  summarizeGameUsage,
  type Tracked,
} from "@/lib/gameUsage";
import {
  TRACKING_LABELS,
  normalizeHistory,
  normalizeRules,
  normalizeTracking,
  periodLabel,
  type TrackingKey,
} from "@/lib/gameConfig";
import { aggregatePlayers, fmtMinutes, fmtSplit, gameScore, minutesForGame } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kpi_/game/$gameId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Game Usage Inspector — CoachSide owner" },
      { name: "description", content: "Owner-only, read-only view of how a coach used Live Game for one game." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Game Usage Inspector — CoachSide" },
      { property: "og:description", content: "Owner-only Live Game usage inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <OwnerGate title="Game Usage Inspector">
      <Inspector />
    </OwnerGate>
  ),
});

const fmtWhen = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const yesNo = (v: boolean) => <Pill tone={v ? "success" : "muted"}>{v ? "Yes" : "No"}</Pill>;
const show = (v: Tracked) => (v == null ? "Not tracked" : v);

function Inspector() {
  const { gameId } = Route.useParams();
  const fetchGame = useServerFn(getOwnerGameUsage);
  const q = useQuery({
    queryKey: ["owner-game-usage", gameId],
    queryFn: async () => JSON.parse(await fetchGame({ data: { gameId } })) as OwnerGamePayload,
    refetchInterval: (query) => (query.state.data && query.state.data.game.status !== "final" ? 20_000 : false),
    staleTime: 10_000,
  });

  if (q.error) {
    return (
      <AppShell title="Game Usage Inspector" backTo="/kpi" backLabel="My KPI">
        <Panel>
          <InfoPanel tone="danger">{(q.error as Error).message || "Could not load this game."}</InfoPanel>
        </Panel>
      </AppShell>
    );
  }
  if (!q.data) {
    return (
      <AppShell title="Game Usage Inspector" backTo="/kpi" backLabel="My KPI">
        <Panel>
          <EmptyState>Loading game…</EmptyState>
        </Panel>
      </AppShell>
    );
  }
  return <InspectorBody data={q.data} refreshing={q.isFetching} onRefresh={() => void q.refetch()} />;
}

function InspectorBody({ data, refreshing, onRefresh }: { data: OwnerGamePayload; refreshing: boolean; onRefresh: () => void }) {
  const { game, events, subs, players } = data;
  const live = game.status !== "final";
  const cfg = normalizeTracking(game.stat_tracking_config);
  const rules = normalizeRules(game.rules_config);
  const history = normalizeHistory(game.tracking_history);
  const summary = useMemo(() => summarizeGameUsage(game, events, subs, data.postGameLog), [game, events, subs, data.postGameLog]);
  const timeline = useMemo(() => buildTimeline(game, events, subs, players), [game, events, subs, players]);
  const score = gameScore(game, events);
  const cov = summary.coverage;
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const lines = useMemo(() => aggregatePlayers([game], events, subs), [game, events, subs]);
  const minutes = useMemo(() => (cfg.clock ? minutesForGame(game, events, subs) : new Map<string, number>()), [cfg.clock, game, events, subs]);
  const disabled = TRACKING_LABELS.filter((t) => !cfg[t.key]);
  const periodWord = game.periods === 2 ? "halves" : game.periods === 4 ? "quarters" : "periods";

  const realSecs = live
    ? elapsedSeconds(game.created_at, events.at(-1)?.created_at ?? subs.at(-1)?.created_at)
    : elapsedSeconds(game.created_at, game.ended_at);

  const playerRows = [...lines.entries()]
    .map(([id, l]) => ({ id, l, p: playerById.get(id) }))
    .sort((a, b) => Number(a.p?.jersey ?? 999) - Number(b.p?.jersey ?? 999));

  const cell = (k: TrackingKey, v: number) => (cov[k].status === "none" && v === 0 ? <span title="Not tracked">—</span> : v);
  const subsTimeline = timeline.filter((t) => t.kind === "sub");
  const scoring = timeline.filter((t) => t.points > 0);

  return (
    <AppShell title="Game Usage Inspector" subtitle="Owner-only · read-only. Nothing here changes the coach's game." backTo="/kpi" backLabel="My KPI" wide>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {live ? <Pill tone="flame">Live / in progress</Pill> : <Pill tone="success">Final</Pill>}
            <Pill tone="grape">{MODE_LABEL[summary.mode]}</Pill>
            <Pill tone="muted">{refreshing ? "Refreshing…" : `Updated ${fmtWhen(data.fetchedAt)}`}</Pill>
            <BubbleButton size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden /> Refresh
            </BubbleButton>
          </div>
          {live ? (
            <InfoPanel tone="flame" className="text-center">Auto-refreshes every 20 seconds while the game is live. Read-only — the coach's session is not affected.</InfoPanel>
          ) : null}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <InfoPanel className="text-center md:text-left">
              <div className="text-lg font-black">{data.teamName}{data.season ? ` · ${data.season}` : ""}</div>
              <div className="text-muted-foreground">
                Coach:{" "}
                {data.coach ? (
                  <Link to="/kpi/coach/$userId" params={{ userId: data.coach.userId }} className="font-bold text-foreground underline decoration-grape underline-offset-4">
                    {data.coach.name}
                  </Link>
                ) : (
                  "Unknown"
                )}
              </div>
            </InfoPanel>
            <div className="rounded-3xl border border-grape/50 bg-grape/15 px-6 py-3 text-center">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{live ? "Current score" : "Final score"}</div>
              <div className="text-4xl font-black tabular-nums">{score.team} – {score.opp}</div>
              <div className="text-xs font-semibold text-muted-foreground">
                {live ? `${periodLabel(game.quarter || 1, game.periods || 4)} in progress` : "Completed"}
              </div>
            </div>
            <InfoPanel className="text-center md:text-right">
              <div className="text-lg font-black">vs {game.opponent}</div>
              <div className="text-muted-foreground">
                {game.game_date} · {game.home_away === "away" ? "Away" : "Home"}
              </div>
            </InfoPanel>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Created" value={<span className="text-sm">{fmtWhen(game.created_at)}</span>} />
            <StatTile label="Ended" value={<span className="text-sm">{live ? "Still live" : fmtWhen(game.ended_at)}</span>} />
            <StatTile label={live ? "Real time so far" : "Real time"} value={fmtDuration(realSecs)} hint={live ? "Created → latest entry" : "Created → completed"} />
            <StatTile label="Stored score" value={`${game.team_score} – ${game.opp_score}`} hint="Snapshot on the game record" />
          </div>
        </Panel>

        {/* How they used CoachSide */}
        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="How they used CoachSide" subtitle="Actual usage, from saved settings and entered stats." tone="flame" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <DiagRow label="Mode" value={<Pill tone="grape">{MODE_LABEL[summary.mode]}</Pill>} />
            <DiagRow label="Court locations used" value={<span className="flex items-center gap-1.5">{yesNo(summary.diagnostics.courtLocationsUsed)}<Pill tone="muted">{summary.locatedEvents} located</Pill></span>} />
            <DiagRow label="Substitutions tracked" value={<span className="flex items-center gap-1.5">{yesNo(summary.diagnostics.substitutionsTracked)}<Pill tone="muted">{subs.length} subs</Pill></span>} />
            <DiagRow label="Clock used" value={yesNo(summary.diagnostics.clockUsed)} />
            <DiagRow label="Opponent stats tracked" value={yesNo(summary.diagnostics.opponentStatsTracked)} />
            <DiagRow label="Game completed" value={yesNo(summary.diagnostics.completed)} />
            <DiagRow label="Post-game edits" value={<Pill tone={summary.postGame.total ? "flame" : "muted"}>{summary.postGame.total}</Pill>} />
            <DiagRow label="Players with stats" value={<Pill tone="muted">{summary.playersWithEvents}</Pill>} />
          </div>
          {summary.mode === "scoreboard" ? (
            <InfoPanel tone="flame">Scoreboard only: individual player stats and court locations were not used in this game.</InfoPanel>
          ) : null}
          {disabled.length ? (
            <InfoPanel>
              <Label>Turned off for this game</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {disabled.map((t) => (
                  <Pill key={t.key} tone="muted">{t.label}</Pill>
                ))}
              </div>
            </InfoPanel>
          ) : null}
        </Panel>

        {/* Configuration */}
        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="What they chose" subtitle="Game settings exactly as stored." />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Periods" value={`${game.periods} ${periodWord}`} />
            <StatTile label="Period length" value={cfg.clock ? `${game.period_minutes} min` : "Clock off"} />
            <StatTile label="Overtime length" value={cfg.clock ? `${game.overtime_minutes ?? 4} min` : "Clock off"} />
            <StatTile label="Game clock" value={cfg.clock ? "On" : "Off"} tone={cfg.clock ? "grape" : "neutral"} />
          </div>
          <InfoPanel>
            <div className="flex flex-wrap items-center gap-2">
              <Label>Stat tracking</Label>
              {game.stat_tracking_config == null ? <Pill tone="muted">No saved settings — original full tracker</Pill> : null}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {TRACKING_LABELS.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface/60 px-3 py-1.5">
                  <span>{t.label}</span>
                  <Pill tone={cfg[t.key] ? "success" : "muted"}>{cfg[t.key] ? "Enabled" : "Disabled"}</Pill>
                </div>
              ))}
            </div>
          </InfoPanel>
          <InfoPanel tone="grape">
            <Label>Rules</Label>
            <ul className="mt-2 flex flex-col gap-1">
              <li>Foul limit: <strong>{rules.foulLimit ?? "No limit"}</strong></li>
              <li>
                Bonus:{" "}
                <strong>
                  {rules.bonus.mode === "none"
                    ? "Not tracked"
                    : `Per ${rules.bonus.mode} · bonus ${rules.bonus.bonus ?? "—"} · double ${rules.bonus.double ?? "—"}`}
                </strong>
              </li>
              <li>Timeouts: <strong>{rules.timeoutsFull} full · {rules.timeouts30} short</strong></li>
            </ul>
          </InfoPanel>
          {history.length ? (
            <InfoPanel>
              <Label>Tracking changes during the game</Label>
              <ul className="mt-2 flex flex-col gap-1">
                {history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <Pill tone={h.enabled ? "success" : "muted"}>{h.enabled ? "On" : "Off"}</Pill>
                    <span className="font-bold">{TRACKING_LABELS.find((t) => t.key === h.category)?.label ?? h.category}</span>
                    <span className="text-muted-foreground">
                      {h.event_count > 0 ? `${periodLabel(h.period || 1, game.periods || 4)} · after ${h.event_count} events` : "before tip-off"} · {fmtWhen(h.changed_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </InfoPanel>
          ) : null}
          <TrackingCoverageCard coverage={cov} periods={game.periods || 4} className="flex min-w-0 max-w-full flex-col gap-2" />
        </Panel>

        {/* Usage summary */}
        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="Usage summary" subtitle="“Not tracked” means the category was switched off — never a zero." />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <StatTile label="Stat events" value={summary.totalEvents} tone="grape" />
            <StatTile label="Scoring events" value={summary.scoringEvents} tone="flame" />
            <StatTile label="FG made / missed" value={`${summary.fgMade} / ${summary.fgMissed}`} />
            <StatTile label="3PT made" value={summary.threesMade} />
            <StatTile label="Free throws" value={`${summary.ftMade}/${summary.ftMade + summary.ftMissed}`} />
            <StatTile label="Rebounds" value={show(summary.rebounds)} />
            <StatTile label="Assists" value={show(summary.assists)} />
            <StatTile label="Steals" value={show(summary.steals)} />
            <StatTile label="Turnovers" value={show(summary.turnovers)} />
            <StatTile label="Blocks" value={show(summary.blocks)} />
            <StatTile label="Fouls" value={show(summary.fouls)} />
            <StatTile label="Substitutions" value={show(summary.substitutions)} />
            <StatTile label="Opponent events" value={summary.opponentEvents} hint="Incl. opponent scoring" />
            <StatTile label="Opp. detail stats" value={show(summary.opponentStatEvents)} />
            <StatTile label="Opponent fouls" value={show(summary.opponentFouls)} />
            <StatTile label="Players with events" value={summary.playersWithEvents} />
            <StatTile label="Located events" value={summary.locatedEvents} />
            <StatTile
              label="Post-game edits"
              value={summary.postGame.total}
              hint={`${summary.postGame.edited} edited · ${summary.postGame.added} added · ${summary.postGame.deleted} deleted`}
            />
          </div>
        </Panel>

        {/* Shot chart */}
        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="Team shot chart" subtitle="Every located event the coach tapped on the court." />
          {summary.locatedEvents === 0 ? (
            <InfoPanel tone="flame">No court locations were recorded{cfg.shotLocations ? "" : " — shot locations were switched off"}.</InfoPanel>
          ) : (
            <ShotChart events={events} />
          )}
        </Panel>

        {/* Player stats */}
        <Panel className="flex flex-col gap-3">
          <SectionHeader as="h2" title="Player stats" subtitle="This game only. Roster name and jersey only." />
          {playerRows.length === 0 ? (
            <InfoPanel tone="flame">
              {cov.players.status === "none" ? "Individual player stats were not tracked in this game." : "No player stats entered yet."}
            </InfoPanel>
          ) : (
            <div className="w-full overflow-x-auto rounded-2xl border border-border/70 bg-surface-2/60">
              <table className="w-full min-w-[760px] text-left text-sm tabular-nums">
                <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    {["#", "Player", ...(cfg.clock ? ["MIN"] : []), "PTS", "FG", "3PT", "FT", "REB", "AST", "STL", "BLK", "TO", "PF"].map((h) => (
                      <th key={h} className="px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-semibold">
                  {playerRows.map(({ id, l, p }) => (
                    <tr key={id} className="border-t border-border/40">
                      <td className="px-3 py-2">{p ? `#${p.jersey}` : "?"}</td>
                      <td className="px-3 py-2">{p?.name ?? "Removed player"}</td>
                      {cfg.clock ? <td className="px-3 py-2">{minutes.has(id) ? fmtMinutes(minutes.get(id)!) : "—"}</td> : null}
                      <td className="px-3 py-2 font-black">{l.pts}</td>
                      <td className="px-3 py-2">{fmtSplit(l.fg)}</td>
                      <td className="px-3 py-2">{fmtSplit(l.three)}</td>
                      <td className="px-3 py-2">{fmtSplit(l.ft)}</td>
                      <td className="px-3 py-2">{cell("rebounds", l.reb)}</td>
                      <td className="px-3 py-2">{cell("assists", l.ast)}</td>
                      <td className="px-3 py-2">{cell("steals", l.stl)}</td>
                      <td className="px-3 py-2">{cell("blocks", l.blk)}</td>
                      <td className="px-3 py-2">{cell("turnovers", l.to)}</td>
                      <td className="px-3 py-2">{cell("fouls", l.pf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Score progression + subs */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel className="flex flex-col gap-3">
            <SectionHeader as="h2" title="Score progression" subtitle={`${scoring.length} scoring plays`} />
            {scoring.length === 0 ? <EmptyState>No scoring yet.</EmptyState> : <ScoreChart points={scoring} />}
          </Panel>
          <Panel className="flex flex-col gap-3">
            <SectionHeader as="h2" title="Substitutions" subtitle={summary.substitutions == null ? "Not tracked" : `${subs.length} lineup changes`} />
            {subsTimeline.length === 0 ? (
              <EmptyState>{summary.substitutions == null ? "Substitutions were not tracked." : "No substitutions entered."}</EmptyState>
            ) : (
              <InfoPanel className="max-h-[320px] overflow-y-auto">
                <ul className="flex flex-col gap-1.5">
                  {subsTimeline.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <Pill tone="muted">{t.label}</Pill>
                      <span>{t.text}</span>
                    </li>
                  ))}
                </ul>
              </InfoPanel>
            )}
          </Panel>
        </div>

        {/* Timeline */}
        <Panel className="flex flex-col gap-3">
          <SectionHeader
            as="h2"
            title="Event timeline"
            subtitle={cfg.clock ? "Period and game clock, in order." : "Clock was off — period and entry order, no invented times."}
          />
          {timeline.length === 0 ? (
            <EmptyState>No events entered yet.</EmptyState>
          ) : (
            <InfoPanel className="max-h-[520px] overflow-y-auto">
              <ol className="flex flex-col gap-1.5">
                {timeline.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 border-b border-border/30 pb-1.5 last:border-0">
                    <Pill tone="muted" className="tabular-nums">{t.label}</Pill>
                    <span className={cn(t.side === "opp" && "text-muted-foreground", t.kind === "sub" && "italic")}>{t.text}</span>
                    {t.points ? (
                      <Pill tone={t.side === "us" ? "grape" : "flame"} className="ml-auto tabular-nums">
                        {t.team} – {t.opp}
                      </Pill>
                    ) : null}
                  </li>
                ))}
              </ol>
            </InfoPanel>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function DiagRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-surface-2/60 px-3 py-2 text-sm font-semibold">
      <span>{label}</span>
      {value}
    </div>
  );
}

function ScoreChart({ points }: { points: { team: number; opp: number; label: string }[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.team, p.opp)));
  const n = points.length;
  const path = (key: "team" | "opp") =>
    [{ team: 0, opp: 0 }, ...points]
      .map((p, i) => `${(i / n) * 100},${40 - (p[key] / max) * 38}`)
      .join(" ");
  const last = points[n - 1]!;
  return (
    <InfoPanel className="flex flex-col gap-2">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Score progression">
        <polyline points={path("opp")} fill="none" className="stroke-flame" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <polyline points={path("team")} fill="none" className="stroke-grape" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Pill tone="grape">Team {last.team}</Pill>
        <Pill tone="flame">Opponent {last.opp}</Pill>
        <Pill tone="muted">Through {last.label}</Pill>
      </div>
    </InfoPanel>
  );
}

