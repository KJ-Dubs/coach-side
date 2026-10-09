import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BubbleButton, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { Court, toLocal, type CourtZoom } from "@/components/court/Court";
import { getPublicGameReport, type PublicGameReport } from "@/lib/gameReport.functions";
import { fmtSplit, gameResult, opponentLine, scoreFromEvents } from "@/lib/stats";
import { boxRow } from "@/lib/pdf";
import { statColor, STAT_LABELS } from "@/lib/statColors";
import { ZONE_LABEL, type Zone } from "@/lib/court";

export const Route = createFileRoute("/game-report/$token")({
  loader: async ({ params }) => {
    const raw = await getPublicGameReport({ data: { token: params.token } }).catch(() => null);
    return { report: raw ? (JSON.parse(raw) as PublicGameReport) : null };
  },
  head: ({ loaderData }) => {
    const r = loaderData?.report;
    const title = r
      ? `${r.team?.name ?? "Team"} vs ${r.game.opponent} — Game Report | CoachSide`
      : "Game Report | CoachSide";
    const desc = "Final score and game stats shared from CoachSide.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  staleTime: 0,
  component: PublicReport,
});

const SHOTS = ["MADE", "MISS", "FT_MADE", "FT_MISS", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL"];

function PublicReport() {
  const { report } = Route.useLoaderData();
  const [zoom, setZoom] = useState<CourtZoom>("left");
  const [q, setQ] = useState<number | "ALL">("ALL");

  const events = report?.events ?? [];
  const filtered = useMemo(() => events.filter((e) => q === "ALL" || e.quarter === q), [events, q]);
  const plotted = useMemo(
    () =>
      filtered
        .filter((e) => e.x != null && e.y != null && SHOTS.includes(String(e.event_type)))
        .map((e) => ({ e, p: toLocal(zoom, { x: (e.x as number) / 2, y: e.y as number }) }))
        .filter((m) => m.p.x >= -0.02 && m.p.x <= 1.02),
    [filtered, zoom],
  );

  if (!report) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 p-4">
        <Panel className="flex flex-col items-center gap-2 text-center">
          <Pill tone="grape">CoachSide</Pill>
          <Label>This game report link is no longer active</Label>
        </Panel>
      </main>
    );
  }

  const { game, team, players } = report;
  const { team: us, opp: them } = scoreFromEvents(events);
  const result = gameResult(game, events);
  const oppL = opponentLine(events);
  const periods = game.periods || 4;
  const maxP = events.reduce((m, e) => Math.max(m, e.quarter), periods);
  const pList = Array.from({ length: maxP }, (_, i) => i + 1);
  const pLabel = (p: number) => (p > periods ? `OT${p - periods}` : `Q${p}`);
  const byPeriod = pList.map((p) => ({ p, ...scoreFromEvents(events.filter((e) => e.quarter === p)) }));
  const box = players.map((p) => ({ p, ...boxRow(p, filtered) })).filter((r) => r.fga || r.fta || r.pts || r.reb || r.ast || r.stl || r.to || r.blk || r.pf);
  const zones: Zone[] = ["rim", "paint", "midrange", "corner3", "wing3", "top3", "deep3"];
  const zoneRows = zones.map((z) => {
    const s = filtered.filter((e) => e.zone === z && (e.event_type === "MADE" || e.event_type === "MISS"));
    return { z, made: s.filter((e) => e.event_type === "MADE").length, att: s.length };
  });
  const dateLabel = new Date(`${game.game_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-3 overflow-x-hidden p-3 sm:p-5">
      <Panel className="flex flex-col items-center gap-2 text-center">
        <Pill tone="grape">CoachSide</Pill>
        <h1 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">
          {team?.name ?? "Team"} {game.home_away === "away" ? "@" : "vs"} {game.opponent}
        </h1>
        <Pill tone="muted">{dateLabel}</Pill>
      </Panel>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label={team?.name ?? "Us"} value={us} tone="grape" />
        <StatTile label={game.opponent} value={them} tone="flame" />
        <StatTile label="Final" value={result === "W" ? "WIN" : result === "L" ? "LOSS" : "TIE"} />
      </div>

      <Panel className="flex min-w-0 flex-col gap-2 overflow-hidden">
        <Label>By period</Label>
        <div className="max-w-full overflow-x-auto rounded-2xl border border-border bg-surface-2/60 p-2">
          <table className="w-full text-xs font-bold">
            <thead>
              <tr className="text-muted-foreground">
                <th className="px-1.5 py-1 text-left">Team</th>
                {byPeriod.map((r) => <th key={r.p} className="px-1.5 text-left">{pLabel(r.p)}</th>)}
                <th className="px-1.5 text-left">T</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/60"><td className="px-1.5 py-1.5">{team?.name ?? "Us"}</td>{byPeriod.map((r) => <td key={r.p} className="px-1.5">{r.team}</td>)}<td className="px-1.5">{us}</td></tr>
              <tr className="border-t border-border/60"><td className="px-1.5 py-1.5">{game.opponent}</td>{byPeriod.map((r) => <td key={r.p} className="px-1.5">{r.opp}</td>)}<td className="px-1.5">{them}</td></tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="flex min-w-0 flex-wrap items-center gap-2">
        <Label>Period</Label>
        <BubbleButton size="sm" tone={q === "ALL" ? "flame" : "neutral"} onClick={() => setQ("ALL")}>All</BubbleButton>
        {pList.map((p) => (
          <BubbleButton key={p} size="sm" tone={q === p ? "flame" : "neutral"} onClick={() => setQ(p)}>{pLabel(p)}</BubbleButton>
        ))}
      </Panel>

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <Label>Player stats</Label>
          <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-surface-2/60 p-2">
            <table className="w-full min-w-[520px] text-xs font-bold">
              <thead>
                <tr className="text-muted-foreground">
                  {["Player", "PTS", "FG", "3", "FT", "REB", "AST", "STL", "TO", "BLK", "PF"].map((h) => <th key={h} className="px-1.5 py-1 text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {box.map((r) => (
                  <tr key={r.p.id} className="border-t border-border/60">
                    <td className="px-1.5 py-1.5"><span className="rounded-full bg-grape/25 px-2 py-0.5">#{r.p.jersey} {r.p.name?.split(" ")[0]}</span></td>
                    <td className="px-1.5">{r.pts}</td>
                    <td className="px-1.5">{r.fgm}/{r.fga}</td>
                    <td className="px-1.5">{r.threes}</td>
                    <td className="px-1.5">{r.ftm}/{r.fta}</td>
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
          <div className="flex flex-wrap gap-2">
            {zoneRows.map((r) => (
              <Pill key={r.z} tone={r.att ? "grape" : "muted"}>
                {ZONE_LABEL[r.z]}: {r.made}/{r.att}{r.att ? ` · ${Math.round((r.made / r.att) * 100)}%` : ""}
              </Pill>
            ))}
          </div>
          <Label>Opponent</Label>
          <div className="flex flex-wrap gap-2">
            <Pill tone="flame">FG {fmtSplit(oppL.fg)}</Pill>
            <Pill tone="muted">3PT {fmtSplit(oppL.three)}</Pill>
            <Pill tone="muted">FT {fmtSplit(oppL.ft)}</Pill>
            <Pill tone="muted">OREB {oppL.oreb}</Pill>
            <Pill tone="muted">DREB {oppL.dreb}</Pill>
            <Pill tone="muted">TO {oppL.to}</Pill>
          </div>
        </Panel>

        <Panel className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Shot chart</Label>
            <BubbleButton size="sm" tone={zoom === "left" ? "flame" : "neutral"} onClick={() => setZoom("left")}>Half Court</BubbleButton>
            <BubbleButton size="sm" tone={zoom === "full" ? "flame" : "neutral"} onClick={() => setZoom("full")}>Full Court</BubbleButton>
          </div>
          <Court
            className="max-w-full"
            variant="full"
            zoom={zoom}
            cursor="default"
            overlay={
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {plotted.map(({ e, p }) => {
                  const c = statColor(String(e.event_type));
                  const hollow = e.event_type === "MISS" || e.event_type === "FT_MISS";
                  return <circle key={e.id} cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r={7} fill={hollow ? "transparent" : c} stroke={c} strokeWidth={2.5} opacity={0.8} />;
                })}
              </svg>
            }
          />
          <div className="flex flex-wrap gap-2">
            {["MADE", "MISS", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/70 px-3 py-1 text-xs font-semibold text-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: statColor(t) }} />
                {STAT_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="flex justify-center pb-4">
        <a href="https://coachside.live" className="rounded-full border border-border bg-surface-2/70 px-4 py-2 text-xs font-bold text-muted-foreground">
          Powered by CoachSide
        </a>
      </div>
    </main>
  );
}
