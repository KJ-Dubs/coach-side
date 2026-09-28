import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { Court } from "@/components/court/Court";
import { fetchEvents, fetchGame, fetchPlayers, fetchSubs } from "@/lib/data";
import { cacheGet, pendingOps } from "@/lib/offline";
import { fmtSplit, gameResult, opponentLine, scoreFromEvents } from "@/lib/stats";
import { formatClock, ZONE_LABEL, type Zone } from "@/lib/court";
import { statColor, STAT_LABELS } from "@/lib/statColors";
import { buildGamePdf, boxRow } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";
import type { GameEvent } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/review/$gameId")({
  head: () => ({
    meta: [
      { title: "Game Report — CoachSide" },
      {
        name: "description",
        content:
          "Box score, colour-coded shot and rebound maps by team or player, plus a shareable PDF game report.",
      },
      { property: "og:title", content: "Game Report — CoachSide" },
      {
        property: "og:description",
        content: "Colour-coded location maps, box score and shareable PDF reports.",
      },
    ],
  }),
  component: ReviewPage,
});

const MAP_TYPES = [
  "ALL",
  "MADE",
  "MISS",
  "REBOUND",
  "ASSIST",
  "STEAL",
  "TURNOVER",
  "BLOCK",
  "FOUL",
] as const;

function ReviewPage() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => fetchGame(gameId) });
  const players = useQuery({
    queryKey: ["players", game.data?.team_id],
    queryFn: () => fetchPlayers(game.data!.team_id),
    enabled: !!game.data,
  });
  // Server first; if the gym wifi is down, fall back to the locally cached events
  // so the coach can still review right after End Game.
  const eventsQ = useQuery({
    queryKey: ["events", gameId],
    queryFn: async () => {
      try {
        const server = await fetchEvents(gameId);
        // Events still waiting in the offline queue belong in the review too.
        const queued = (await pendingOps())
          .filter((o) => o.kind === "insert_event")
          .map((o) => o.payload as GameEvent)
          .filter((e) => e.game_id === gameId);
        if (!queued.length) return server;
        const byId = new Map<string, GameEvent>();
        for (const e of [...server, ...queued]) byId.set(e.id, e);
        return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
      } catch (err) {
        const cached = await cacheGet<GameEvent[]>(`game-events-${gameId}`);
        if (cached?.length) return cached;
        throw err;
      }
    },
  });
  const subsQ = useQuery({ queryKey: ["subs", gameId], queryFn: () => fetchSubs(gameId) });

  const [playerFilter, setPlayerFilter] = useState<string | "ALL">("ALL");
  const [quarterFilter, setQuarterFilter] = useState<number | "ALL">("ALL");
  const [mapType, setMapType] = useState<(typeof MAP_TYPES)[number]>("ALL");

  const events = eventsQ.data ?? [];
  const roster = players.data ?? [];
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const jersey = (id: string | null) => (id ? `#${byId.get(id)?.jersey ?? "?"}` : "OPP");

  const periods = game.data?.periods ?? 4;
  const maxPeriod = events.reduce((m, e) => Math.max(m, e.quarter), periods);
  const periodList = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  const filtered = events.filter(
    (e) =>
      (playerFilter === "ALL" || e.player_id === playerFilter) &&
      (quarterFilter === "ALL" || e.quarter === quarterFilter),
  );

  const mapEvents = filtered.filter((e) => {
    if (e.x == null || e.y == null) return false;
    if ((e.x as number) > 1) return false; // backcourt actions: see the full-court shot chart
    if (mapType === "ALL")
      return ["MADE", "MISS", "FT_MADE", "FT_MISS", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL"].includes(
        String(e.event_type),
      );
    if (mapType === "MADE") return e.event_type === "MADE" || e.event_type === "FT_MADE";
    if (mapType === "MISS") return e.event_type === "MISS" || e.event_type === "FT_MISS";
    return e.event_type === mapType;
  });

  const box = roster.map((p) => ({ p, ...boxRow(p, events) }));

  const zones: Zone[] = ["rim", "paint", "midrange", "corner3", "wing3", "top3", "deep3"];
  const zoneRows = zones.map((z) => {
    const shots = filtered.filter(
      (e) => e.zone === z && (e.event_type === "MADE" || e.event_type === "MISS"),
    );
    const made = shots.filter((e) => e.event_type === "MADE").length;
    return { z, made, att: shots.length };
  });

  const { team: teamScore, opp: oppScore } = scoreFromEvents(events);
  const opp = opponentLine(events);
  const oppFouls = events.filter((e) => e.event_type === "OPP_FOUL").length;
  const isFinal = game.data?.status === "final";
  const result = game.data ? gameResult(game.data, eventsQ.data ?? []) : null;

  const deleteEvent = async (e: GameEvent) => {
    await supabase.from("game_events").delete().eq("id", e.id);
    void eventsQ.refetch();
  };

  const exportPdf = (scope: "team" | "player") => {
    if (!game.data) return;
    const selected =
      scope === "player" && playerFilter !== "ALL"
        ? roster.filter((p) => p.id === playerFilter)
        : roster;
    const doc = buildGamePdf({
      title: `${game.data.opponent} — Game Report`,
      subtitle: `${game.data.game_date} · CoachSide`,
      players: selected,
      events,
      teamScore,
      oppScore,
      zones,
    });
    doc.save(
      scope === "player" && playerFilter !== "ALL"
        ? `player-${byId.get(playerFilter)?.jersey}-report.pdf`
        : `team-game-report.pdf`,
    );
    toast.success("PDF report downloaded");
  };

  return (
    <AppShell
      wide
      balancedTitle
      title={game.data ? `${game.data.opponent} — Report` : "Game Report"}
      subtitle={game.data?.game_date}
    >
      <Panel className="mb-3 grid min-w-0 max-w-full grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-4">
          <BubbleButton size="sm" tone="neutral" onClick={() => navigate({ to: "/film" })}>
            Film Room
          </BubbleButton>
          <BubbleButton size="sm" tone="grape" onClick={() => exportPdf("team")}>
            PDF · Whole team
          </BubbleButton>
          <BubbleButton
            size="sm"
            tone="flame"
            disabled={playerFilter === "ALL"}
            onClick={() => exportPdf("player")}
          >
            PDF · Selected player
          </BubbleButton>
          {isFinal ? (
            <BubbleButton
              tone="neutral"
              size="sm"
              onClick={() => navigate({ to: "/games" })}
            >
              Game History
            </BubbleButton>
          ) : (
            <BubbleButton
              tone="neutral"
              size="sm"
              onClick={() => navigate({ to: "/game/$gameId", params: { gameId } })}
            >
              Back To Live Court
            </BubbleButton>
          )}
      </Panel>
      <Panel className="mb-3 flex min-w-0 max-w-full flex-wrap items-center gap-2">
        <Label>Opponent</Label>
        <Pill tone="flame">FG {fmtSplit(opp.fg)}</Pill>
        <Pill tone="muted">3PT {fmtSplit(opp.three)}</Pill>
        <Pill tone="muted">FT {fmtSplit(opp.ft)}</Pill>
        <Pill tone="flame">OREB {opp.oreb}</Pill>
        <Pill tone="muted">DREB {opp.dreb}</Pill>
        <Pill tone="muted">TO {opp.to}</Pill>
      </Panel>
      <Panel className="mb-3 flex min-w-0 max-w-full flex-wrap items-center gap-2">
        <Pill tone={isFinal ? "grape" : "flame"}>{isFinal ? "FINAL — saved" : "In progress"}</Pill>
        {result ? (
          <Pill tone={result === "W" ? "success" : result === "L" ? "danger" : "muted"}>
            {result === "W" ? "WIN" : result === "L" ? "LOSS" : "TIE"}
          </Pill>
        ) : null}
        {game.data ? (
          <>
            <Pill tone="muted">{game.data.home_away === "away" ? "Away" : "Home"}</Pill>
            <Pill tone="muted">
              {game.data.periods} × {game.data.period_minutes} min
            </Pill>
            {game.data.quarter > game.data.periods ? <Pill tone="flame">Overtime</Pill> : null}
          </>
        ) : null}
        {isFinal ? <Label>Counted in Team & Player Stats</Label> : null}
        {!isFinal && game.data ? (
          <BubbleButton
            size="sm"
            tone="flame"
            onClick={() => navigate({ to: "/game/$gameId", params: { gameId } })}
          >
            Resume live court
          </BubbleButton>
        ) : null}
      </Panel>
      <div className="mb-3 grid min-w-0 max-w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Us" value={teamScore} tone="grape" />
        <StatTile label="Opponent" value={oppScore} tone="flame" />
        <StatTile label="Opp fouls" value={oppFouls} />
        <StatTile label="Events" value={events.length} />
        <StatTile label="Subs" value={subsQ.data?.length ?? 0} />
      </div>

      <Panel className="mb-3 flex min-w-0 max-w-full flex-wrap items-center gap-2 overflow-hidden">
        <Label>Filters</Label>
        <BubbleButton
          size="sm"
          tone={playerFilter === "ALL" ? "grape" : "neutral"}
          onClick={() => setPlayerFilter("ALL")}
        >
          Whole team
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
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <BubbleButton
          size="sm"
          tone={quarterFilter === "ALL" ? "flame" : "neutral"}
          onClick={() => setQuarterFilter("ALL")}
        >
          All periods
        </BubbleButton>
        {periodList.map((q) => (
          <BubbleButton
            key={q}
            size="sm"
            tone={quarterFilter === q ? "flame" : "neutral"}
            onClick={() => setQuarterFilter(q)}
          >
            {q > periods ? `OT${q - periods}` : `Q${q}`}
          </BubbleButton>
        ))}
      </Panel>

      <div className="grid min-w-0 max-w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Panel className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden">
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <Label>Location map</Label>
            {MAP_TYPES.map((c) => (
              <BubbleButton
                key={c}
                size="sm"
                tone={mapType === c ? "grape" : "neutral"}
                onClick={() => setMapType(c)}
              >
                {c === "ALL" ? "EVERYTHING" : c}
              </BubbleButton>
            ))}
            <Pill tone="muted">{mapEvents.length} plotted</Pill>
          </div>
          <Court
            className="max-w-full"
            cursor="default"
            overlay={
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {mapEvents.map((e) => {
                  const c = statColor(String(e.event_type));
                  const hollow = e.event_type === "MISS" || e.event_type === "FT_MISS";
                  return (
                    <circle
                      key={e.id}
                      cx={`${Math.min(1, e.x as number) * 100}%`}
                      cy={`${(e.y as number) * 100}%`}
                      r={7}
                      fill={hollow ? "transparent" : c}
                      stroke={c}
                      strokeWidth={2.5}
                      opacity={0.8}
                    />
                  );
                })}
              </svg>
            }
          />
          <div className="flex min-w-0 max-w-full flex-wrap gap-2">
            {["MADE", "MISS", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL"].map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/70 px-3 py-1 text-xs font-semibold text-foreground"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: statColor(t) }}
                />
                {STAT_LABELS[t] ?? t}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 max-w-full flex-wrap gap-2">
            {zoneRows.map((r) => (
              <Pill key={r.z} tone={r.att ? "grape" : "muted"}>
                {ZONE_LABEL[r.z]}: {r.made}/{r.att}
                {r.att ? ` · ${Math.round((r.made / r.att) * 100)}%` : ""}
              </Pill>
            ))}
          </div>
        </Panel>

        <div className="flex min-w-0 max-w-full flex-col gap-3">
          <Panel className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden">
            <Label>Box score</Label>
            <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-surface-2/60 p-2">
              <table className="w-full min-w-[520px] text-xs font-bold">
                <thead>
                  <tr className="text-muted-foreground">
                    {["#", "PTS", "FG", "3", "FT", "REB", "AST", "STL", "TO", "BLK", "PF"].map((h) => (
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
                      <td className="px-1.5">
                        {r.ftm}/{r.fta}
                      </td>
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

          <Panel className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden">
            <Label>Substitution timeline</Label>
            <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
              {subsQ.data?.map((s) => (
                <div
                  key={s.id}
                  className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-surface-2/70 px-2 py-1.5 text-xs font-bold"
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

          <Panel className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden">
            <Label>Event timeline ({filtered.length})</Label>
            <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {[...filtered].reverse().map((e) => (
                <div
                  key={e.id}
                  className="grid min-w-0 max-w-full grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-2xl border border-border bg-surface-2/70 px-2 py-1.5 text-xs font-bold"
                >
                  <Pill tone="muted">Q{e.quarter}</Pill>
                  <Pill tone="muted">{formatClock(e.clock_seconds)}</Pill>
                  <span className="rounded-full bg-grape/25 px-2 py-0.5">{jersey(e.player_id)}</span>
                  <span className="min-w-0 truncate rounded-full bg-surface/70 px-2 py-0.5">
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
