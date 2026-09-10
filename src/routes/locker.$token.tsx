import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { BubbleButton, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { ShotChart } from "@/components/court/ShotChart";
import { getLockerBundle, type LockerBundle } from "@/lib/locker.functions";
import type { GameEvent } from "@/lib/types";
import {
  aggregatePlayers,
  aggregateTeam,
  fmtMinutes,
  fmtPct,
  fmtPer,
  fmtSplit,
  gameScore,
} from "@/lib/stats";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";

export const Route = createFileRoute("/locker/$token")({
  head: () => ({
    meta: [
      { title: "Team Locker Room — CoachSide" },
      {
        name: "description",
        content:
          "Team and player stats and the shared game and practice calendar, shared by your coach. Read-only, no account needed.",
      },
      { property: "og:title", content: "Team Locker Room — CoachSide" },
      {
        property: "og:description",
        content: "Team stats and the team schedule in one read-only shared link.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://coachside.live/og-cover.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://coachside.live/og-cover.png" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LockerRoom,
});

type Tab = "stats" | "playbook" | "schedule";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LockerRoom() {
  const { token } = Route.useParams();
  const load = useServerFn(getLockerBundle);
  const q = useQuery({
    queryKey: ["locker", token],
    queryFn: async () => {
      const raw = await load({ data: { token } });
      return raw ? (JSON.parse(raw) as LockerBundle) : null;
    },
    // Poll every 15s only while a live game exists.
    refetchInterval: (query) => (query.state.data?.live ? 15000 : false),
  });
  const [tab, setTab] = useState<Tab>("stats");

  if (q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Panel>
          <Label>Opening the locker room…</Label>
        </Panel>
      </div>
    );
  }

  if (!q.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Panel className="text-center">
          <Label>This locker room link is turned off or no longer valid</Label>
        </Panel>
      </div>
    );
  }

  const b = q.data;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-3 p-3">
      <Panel className="flex flex-wrap items-center gap-3">
        {b.logoUrl ? (
          <span className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2">
            <img
              src={b.logoUrl}
              alt={`${b.team.name} logo`}
              className="h-full w-full object-contain"
            />
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="inline-flex w-fit rounded-2xl border border-grape/60 bg-grape/20 px-4 py-2 text-xl font-black leading-tight text-foreground sm:text-2xl">
            {b.team.name} {b.team.season} Locker Room
          </h1>
        </div>
        <img
          src={wordmark.url}
          alt="CoachSide"
          className="ml-auto h-7 w-auto max-w-[140px] object-contain"
        />
      </Panel>

      <Panel className="grid grid-cols-2 gap-2">
        {(
          [
            ["stats", "Stats"],
            ["schedule", "Schedule"],
          ] as const
        ).map(([key, label]) => (
          <BubbleButton key={key} tone={tab === key ? "grape" : "neutral"} onClick={() => setTab(key)}>
            {label}
          </BubbleButton>
        ))}
      </Panel>

      {tab === "stats" ? (
        <StatsTab
          bundle={b}
          onRefresh={() => void q.refetch()}
          refreshing={q.isFetching}
        />
      ) : null}
      {tab === "schedule" ? <ScheduleTab bundle={b} token={token} /> : null}
    </div>
  );
}

function fmtClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtAgo(iso: string, now: number) {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `Updated ${diff} second${diff === 1 ? "" : "s"} ago`;
  const m = Math.round(diff / 60);
  if (m < 60) return `Updated ${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  return `Updated ${h} hour${h === 1 ? "" : "s"} ago`;
}

function LiveGameCard({
  live,
  players,
  onRefresh,
  refreshing,
}: {
  live: NonNullable<LockerBundle["live"]>;
  players: LockerBundle["players"];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  const g = live.game;
  const hasEvents = live.events.length > 0;
  const score = useMemo(() => gameScore(g, live.events), [g, live.events]);
  const lines = useMemo(
    () => aggregatePlayers([g], live.events, live.subs),
    [g, live.events, live.subs],
  );
  const rows = players
    .map((p) => ({ p, l: lines.get(p.id) }))
    .filter((r) => r.l && (r.l.games > 0 || r.l.seconds > 0));

  return (
    <Panel className="flex flex-col gap-3 border-2 border-flame ring-2 ring-flame/40">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="flame" className="animate-pulse text-base font-black">
          ● LIVE GAME
        </Pill>
        <Pill tone="grape" className="text-base font-black">
          vs {g.opponent}
        </Pill>
        <Pill tone="muted">{g.home_away === "away" ? "Away" : "Home"}</Pill>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Us" value={String(score.team)} tone="grape" />
        <StatTile label={g.opponent} value={String(score.opp)} tone="flame" />
        <StatTile
          label="Period"
          value={g.quarter ? `Q${g.quarter}` : "—"}
        />
        <StatTile
          label="Clock"
          value={typeof g.clock_seconds === "number" ? fmtClock(g.clock_seconds) : "—"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="muted">{fmtAgo(live.lastSyncedAt, now)}</Pill>
        <BubbleButton
          tone="flame"
          className="ml-auto min-h-14 px-6 text-base font-black"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </BubbleButton>
      </div>

      {!hasEvents ? (
        <Pill tone="neutral">Waiting for first sync from your coach</Pill>
      ) : (
        <div className="flex flex-col gap-2">
          <Label>Live player stats</Label>
          {rows.map(({ p, l }) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-flame/40 bg-surface-2/70 p-2"
            >
              <Pill tone="flame">#{p.jersey}</Pill>
              <Pill tone="neutral">{p.name}</Pill>
              <Pill tone="muted">{l!.pts} PTS</Pill>
              <Pill tone="muted">{l!.reb} REB</Pill>
              <Pill tone="muted">{l!.ast} AST</Pill>
              <Pill tone="muted">{l!.stl} STL</Pill>
              <Pill tone="muted">{l!.blk} BLK</Pill>
              <Pill tone="muted">{l!.to} TO</Pill>
              <Pill tone="muted">{l!.pf} FOULS</Pill>
              <Pill tone="muted">FG {fmtSplit(l!.fg)}</Pill>
              <Pill tone="muted">3PT {fmtSplit(l!.three)}</Pill>
              <Pill tone="muted">FT {fmtSplit(l!.ft)}</Pill>
              {l!.seconds > 0 ? <Pill tone="muted">{fmtMinutes(l!.seconds)} MIN</Pill> : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function StatsTab({
  bundle,
  onRefresh,
  refreshing,
}: {
  bundle: LockerBundle;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const team = useMemo(() => aggregateTeam(bundle.games, bundle.events), [bundle]);
  const lines = useMemo(
    () => aggregatePlayers(bundle.games, bundle.events, bundle.subs),
    [bundle],
  );
  const rows = bundle.players
    .map((p) => ({ p, l: lines.get(p.id) }))
    .filter((r) => r.l && r.l.games > 0);

  const liveCard = bundle.live ? (
    <LiveGameCard
      live={bundle.live}
      players={bundle.players}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  ) : null;

  if (!bundle.games.length) {
    return (
      <>
        {liveCard}
        <Panel>
          <Label>No finished games have been saved yet</Label>
        </Panel>
      </>
    );
  }

  return (
    <>
      {liveCard}
      <Panel className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Record" value={`${team.wins}-${team.losses}`} tone="grape" />
        <StatTile label="Points / game" value={fmtPer(team.pts, team.games)} tone="flame" />
        <StatTile label="FG%" value={fmtPct(team.fg)} />
        <StatTile label="3PT%" value={fmtPct(team.three)} />
        <StatTile label="FT%" value={fmtPct(team.ft)} />
        <StatTile label="Rebounds / game" value={fmtPer(team.reb, team.games)} />
        <StatTile label="Assists / game" value={fmtPer(team.ast, team.games)} />
        <StatTile label="Steals / game" value={fmtPer(team.stl, team.games)} />
      </Panel>

      <Panel className="flex flex-col gap-2">
        <Label>Player stats</Label>
        <div className="flex flex-col gap-2">
          {rows.map(({ p, l }) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-2"
            >
              <Pill tone="flame">#{p.jersey}</Pill>
              <Pill tone="neutral">{p.name}</Pill>
              <Pill tone="muted">{l!.games} G</Pill>
              <Pill tone="muted">{l!.pts} PTS</Pill>
              <Pill tone="muted">{fmtPer(l!.pts, l!.games)} PPG</Pill>
              <Pill tone="muted">{l!.reb} REB</Pill>
              <Pill tone="muted">{l!.ast} AST</Pill>
              <Pill tone="muted">FG {fmtPct(l!.fg)}</Pill>
              <Pill tone="muted">{fmtMinutes(l!.seconds)} MIN</Pill>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="flex flex-col gap-2">
        <Label>Team shot chart</Label>
        <ShotChart events={bundle.events as GameEvent[]} />
      </Panel>
    </>
  );
}

function ScheduleTab({ bundle, token }: { bundle: LockerBundle; token: string }) {
  const now = Date.now();
  const upcoming = bundle.schedule.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = bundle.schedule
    .filter((e) => new Date(e.starts_at).getTime() < now)
    .slice()
    .reverse();
  const feed =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/public/locker/${token}/calendar`;
  const webcal = feed.replace(/^https?:/, "webcal:");

  return (
    <>
      <Panel className="flex flex-wrap items-center gap-2">
        <Label>Add this schedule to Google Calendar</Label>
        <a
          href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
          target="_blank"
          rel="noreferrer"
        >
          <BubbleButton size="sm" tone="grape">
            Add to Google Calendar
          </BubbleButton>
        </a>
        <BubbleButton
          size="sm"
          tone="neutral"
          onClick={() => void navigator.clipboard?.writeText(feed)}
        >
          Copy calendar link
        </BubbleButton>
      </Panel>

      <Panel className="flex flex-col gap-2">
        <Label>Upcoming</Label>
        {upcoming.length ? (
          upcoming.map((e) => <EventRow key={e.id} e={e} />)
        ) : (
          <Pill tone="muted">Nothing scheduled yet</Pill>
        )}
      </Panel>

      {past.length ? (
        <Panel className="flex flex-col gap-2">
          <Label>Past</Label>
          {past.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </Panel>
      ) : null}
    </>
  );
}

function EventRow({ e }: { e: LockerBundle["schedule"][number] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-2">
      <Pill tone={e.kind === "game" ? "flame" : "grape"}>
        {e.kind === "game" ? "Game" : e.kind === "practice" ? "Practice" : "Team"}
      </Pill>
      <Pill tone="neutral">{e.title}</Pill>
      <Pill tone="muted">{fmtDate(e.starts_at)}</Pill>
      {e.location ? <Pill tone="muted">{e.location}</Pill> : null}
      {e.notes ? <Pill tone="muted">{e.notes}</Pill> : null}
    </div>
  );
}
