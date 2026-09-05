import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { Court } from "@/components/court/Court";
import { fetchEvents, fetchGame, fetchPlayers, fetchSubs } from "@/lib/data";
import { formatClock, ZONE_LABEL, type Zone } from "@/lib/court";
import { supabase } from "@/integrations/supabase/client";
import type { GameEvent } from "@/lib/types";

export const Route = createFileRoute("/review/$gameId")({
  head: () => ({
    meta: [
      { title: "Game Review — CourtFlow Coach" },
      {
        name: "description",
        content:
          "Box score, shot charts by zone, rebound and turnover maps, and the substitution timeline.",
      },
      { property: "og:title", content: "Game Review — CourtFlow Coach" },
      {
        property: "og:description",
        content: "Box score, shot charts, location maps and substitution timeline.",
      },
    ],
  }),
  component: ReviewPage,
});

const CHART_TYPES = ["SHOTS", "REBOUND", "STEAL", "TURNOVER", "FOUL"] as const;

function ReviewPage() {
  const { gameId } = Route.useParams();
  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => fetchGame(gameId) });
  const players = useQuery({
    queryKey: ["players", game.data?.team_id],
    queryFn: () => fetchPlayers(game.data!.team_id),
    enabled: !!game.data,
  });
  const eventsQ = useQuery({ queryKey: ["events", gameId], queryFn: () => fetchEvents(gameId) });
  const subsQ = useQuery({ queryKey: ["subs", gameId], queryFn: () => fetchSubs(gameId) });

  const [playerFilter, setPlayerFilter] = useState<string | "ALL">("ALL");
  const [quarterFilter, setQuarterFilter] = useState<number | "ALL">("ALL");
  const [chart, setChart] = useState<(typeof CHART_TYPES)[number]>("SHOTS");

  const events = eventsQ.data ?? [];
  const roster = players.data ?? [];
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const jersey = (id: string | null) => (id ? `#${byId.get(id)?.jersey ?? "?"}` : "OPP");

  const filtered = events.filter(
    (e) =>
      (playerFilter === "ALL" || e.player_id === playerFilter) &&
      (quarterFilter === "ALL" || e.quarter === quarterFilter),
  );

  const chartEvents = filtered.filter((e) => {
    if (e.x == null || e.y == null) return false;
    if (chart === "SHOTS") return e.event_type === "MADE" || e.event_type === "MISS";
    return e.event_type === chart;
  });

  const box = roster.map((p) => {
    const own = events.filter((e) => e.player_id === p.id);
    const fga = own.filter((e) => e.event_type === "MADE" || e.event_type === "MISS").length;
    const fgm = own.filter((e) => e.event_type === "MADE").length;
    const threes = own.filter((e) => e.event_type === "MADE" && e.points === 3).length;
    return {
      p,
      pts: own.reduce((s, e) => s + (e.points || 0), 0),
      fgm,
      fga,
      threes,
      reb: own.filter((e) => e.event_type === "REBOUND").length,
      ast: own.filter((e) => e.event_type === "ASSIST").length,
      stl: own.filter((e) => e.event_type === "STEAL").length,
      to: own.filter((e) => e.event_type === "TURNOVER").length,
      blk: own.filter((e) => e.event_type === "BLOCK").length,
      pf: own.filter((e) => e.event_type === "FOUL").length,
    };
  });

  const zones: Zone[] = ["rim", "paint", "midrange", "corner3", "wing3", "top3", "deep3"];
  const zoneRows = zones.map((z) => {
    const shots = filtered.filter(
      (e) => e.zone === z && (e.event_type === "MADE" || e.event_type === "MISS"),
    );
    const made = shots.filter((e) => e.event_type === "MADE").length;
    return { z, made, att: shots.length };
  });

  const teamScore = events.filter((e) => e.event_type === "MADE").reduce((s, e) => s + e.points, 0);
  const oppScore = events
    .filter((e) => e.event_type === "OPP_SCORE")
    .reduce((s, e) => s + e.points, 0);

  const deleteEvent = async (e: GameEvent) => {
    await supabase.from("game_events").delete().eq("id", e.id);
    void eventsQ.refetch();
  };

  return (
    <AppShell
      wide
      title={game.data ? `${game.data.opponent} — Review` : "Game Review"}
      subtitle={game.data?.game_date}
      actions={
        <Link to="/game/$gameId" params={{ gameId }}>
          <BubbleButton tone="flame" size="sm">
            Back To Live Court
          </BubbleButton>
        </Link>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Us" value={teamScore} tone="grape" />
        <StatTile label="Opponent" value={oppScore} tone="flame" />
        <StatTile label="Events" value={events.length} />
        <StatTile label="Subs" value={subsQ.data?.length ?? 0} />
      </div>

      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Filters</Label>
        <BubbleButton
          size="sm"
          tone={playerFilter === "ALL" ? "grape" : "neutral"}
          onClick={() => setPlayerFilter("ALL")}
        >
          All players
        </BubbleButton>
        {roster.map((p) => (
          <BubbleButton
            key={p.id}
            size="sm"
            tone={playerFilter === p.id ? "grape" : "neutral"}
            onClick={() => setPlayerFilter(p.id)}
          >
            #{p.jersey}
          </BubbleButton>
        ))}
        <span className="mx-1 h-6 w-px bg-border" />
        <BubbleButton
          size="sm"
          tone={quarterFilter === "ALL" ? "flame" : "neutral"}
          onClick={() => setQuarterFilter("ALL")}
        >
          All periods
        </BubbleButton>
        {[1, 2, 3, 4].map((q) => (
          <BubbleButton
            key={q}
            size="sm"
            tone={quarterFilter === q ? "flame" : "neutral"}
            onClick={() => setQuarterFilter(q)}
          >
            Q{q}
          </BubbleButton>
        ))}
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[1fr_420px]">
        <Panel className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Location map</Label>
            {CHART_TYPES.map((c) => (
              <BubbleButton
                key={c}
                size="sm"
                tone={chart === c ? "grape" : "neutral"}
                onClick={() => setChart(c)}
              >
                {c}
              </BubbleButton>
            ))}
            <Pill tone="muted">{chartEvents.length} plotted</Pill>
          </div>
          <Court
            cursor="default"
            overlay={
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {chartEvents.map((e) => {
                  const made = e.event_type === "MADE";
                  return (
                    <circle
                      key={e.id}
                      cx={`${(e.x as number) * 100}%`}
                      cy={`${(e.y as number) * 100}%`}
                      r={7}
                      fill={
                        chart !== "SHOTS"
                          ? "var(--grape)"
                          : made
                            ? "var(--flame)"
                            : "transparent"
                      }
                      stroke={made || chart !== "SHOTS" ? "var(--flame)" : "var(--grape)"}
                      strokeWidth={2.5}
                      opacity={0.85}
                    />
                  );
                })}
              </svg>
            }
          />
          <div className="flex flex-wrap gap-2">
            {zoneRows.map((r) => (
              <Pill key={r.z} tone={r.att ? "grape" : "muted"}>
                {ZONE_LABEL[r.z]}: {r.made}/{r.att}
                {r.att ? ` · ${Math.round((r.made / r.att) * 100)}%` : ""}
              </Pill>
            ))}
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel className="flex flex-col gap-2">
            <Label>Box score</Label>
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface-2/60 p-2">
              <table className="w-full text-xs font-bold">
                <thead>
                  <tr className="text-muted-foreground">
                    {["#", "PTS", "FG", "3", "REB", "AST", "STL", "TO", "BLK", "PF"].map((h) => (
                      <th key={h} className="px-1.5 py-1 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {box.map((r) => (
                    <tr key={r.p.id} className="border-t border-border/60">
                      <td className="px-1.5 py-1.5">
                        <span className="rounded-full bg-grape/25 px-2 py-0.5">#{r.p.jersey}</span>
                      </td>
                      <td className="px-1.5">{r.pts}</td>
                      <td className="px-1.5">
                        {r.fgm}/{r.fga}
                      </td>
                      <td className="px-1.5">{r.threes}</td>
                      <td className="px-1.5">{r.reb}</td>
                      <td className="px-1.5">{r.ast}</td>
                      <td className="px-1.5">{r.stl}</td>
                      <td className="px-1.5">{r.to}</td>
                      <td className="px-1.5">{r.blk}</td>
                      <td className="px-1.5">{r.pf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Substitution timeline</Label>
            <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
              {subsQ.data?.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2/70 px-2 py-1.5 text-xs font-bold"
                >
                  <Pill tone="muted">Q{s.quarter}</Pill>
                  <Pill tone="muted">{formatClock(s.clock_seconds)}</Pill>
                  <span className="rounded-full bg-flame/20 px-2 py-0.5">
                    OUT {jersey(s.player_out)}
                  </span>
                  <span className="rounded-full bg-grape/25 px-2 py-0.5">
                    IN {jersey(s.player_in)}
                  </span>
                </div>
              ))}
              {!subsQ.data?.length ? <Pill tone="muted">No substitutions yet</Pill> : null}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Event timeline ({filtered.length})</Label>
            <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {[...filtered].reverse().map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2/70 px-2 py-1.5 text-xs font-bold"
                >
                  <Pill tone="muted">Q{e.quarter}</Pill>
                  <Pill tone="muted">{formatClock(e.clock_seconds)}</Pill>
                  <span className="rounded-full bg-grape/25 px-2 py-0.5">{jersey(e.player_id)}</span>
                  <span className="flex-1 truncate rounded-full bg-surface/70 px-2 py-0.5">
                    {e.event_type}
                    {e.result ? ` · ${e.result}` : ""}
                    {e.zone ? ` · ${e.zone}` : ""}
                  </span>
                  <BubbleButton size="sm" tone="ghost" onClick={() => void deleteEvent(e)}>
                    ✕
                  </BubbleButton>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
