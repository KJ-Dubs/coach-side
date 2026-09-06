import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { BubbleButton, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { ShotChart } from "@/components/court/ShotChart";
import { getLockerBundle, type LockerBundle } from "@/lib/locker.functions";
import { aggregatePlayers, aggregateTeam, fmtMinutes, fmtPct, fmtPer } from "@/lib/stats";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";

export const Route = createFileRoute("/locker/$token")({
  head: () => ({
    meta: [
      { title: "Team Locker Room — CoachSide" },
      {
        name: "description",
        content:
          "Team and player stats, the playbook and the shared game and practice calendar, shared by your coach.",
      },
      { property: "og:title", content: "Team Locker Room — CoachSide" },
      {
        property: "og:description",
        content: "Stats, plays and the team schedule in one shared link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
    queryFn: () => load({ data: { token } }),
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
          <Pill tone="grape" className="text-sm font-black">
            {b.team.name}
          </Pill>
          <Pill tone="muted">{b.team.season}</Pill>
          <Pill tone="flame">Locker Room</Pill>
        </div>
        <img
          src={wordmark.url}
          alt="CoachSide"
          className="ml-auto h-7 w-auto max-w-[140px] object-contain"
        />
      </Panel>

      <Panel className="grid grid-cols-3 gap-2">
        {(
          [
            ["stats", "Stats"],
            ["playbook", "Playbook"],
            ["schedule", "Schedule"],
          ] as const
        ).map(([key, label]) => (
          <BubbleButton key={key} tone={tab === key ? "grape" : "neutral"} onClick={() => setTab(key)}>
            {label}
          </BubbleButton>
        ))}
      </Panel>

      {tab === "stats" ? <StatsTab bundle={b} /> : null}
      {tab === "playbook" ? <PlaybookTab bundle={b} /> : null}
      {tab === "schedule" ? <ScheduleTab bundle={b} token={token} /> : null}
    </div>
  );
}

function StatsTab({ bundle }: { bundle: LockerBundle }) {
  const team = useMemo(() => aggregateTeam(bundle.games, bundle.events), [bundle]);
  const lines = useMemo(
    () => aggregatePlayers(bundle.games, bundle.events, bundle.subs),
    [bundle],
  );
  const rows = bundle.players
    .map((p) => ({ p, l: lines.get(p.id) }))
    .filter((r) => r.l && r.l.games > 0);

  if (!bundle.games.length) {
    return (
      <Panel>
        <Label>No finished games have been saved yet</Label>
      </Panel>
    );
  }

  return (
    <>
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
        <ShotChart events={bundle.events} />
      </Panel>
    </>
  );
}

function PlaybookTab({ bundle }: { bundle: LockerBundle }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const play = bundle.plays.find((p) => p.id === openId) ?? null;
  const frames = bundle.frames.filter((f) => f.play_id === openId).sort((a, b) => a.idx - b.idx);
  const current = frames[Math.min(i, Math.max(0, frames.length - 1))];

  if (!bundle.plays.length) {
    return (
      <Panel>
        <Label>Your coach has not added plays to this locker room yet</Label>
      </Panel>
    );
  }

  const categories = Array.from(new Set(bundle.plays.map((p) => p.category)));

  return (
    <>
      {play ? (
        <Panel className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="grape">{play.name}</Pill>
            <Pill tone="muted">{play.category}</Pill>
            <Pill tone="flame">
              Frame {frames.length ? Math.min(i + 1, frames.length) : 0} / {frames.length}
            </Pill>
            <BubbleButton
              size="sm"
              tone="neutral"
              className="ml-auto"
              onClick={() => {
                setOpenId(null);
                setI(0);
              }}
            >
              Close
            </BubbleButton>
          </div>
          <PlayCanvas frame={current} flip={play.attack_basket === "left"} />
          {current?.note ? <Pill tone="neutral">{current.note}</Pill> : null}
          <div className="flex flex-wrap justify-center gap-2">
            <BubbleButton
              tone="neutral"
              disabled={i === 0}
              onClick={() => setI((v) => Math.max(0, v - 1))}
            >
              ← Prev
            </BubbleButton>
            <BubbleButton
              tone="grape"
              disabled={i >= frames.length - 1}
              onClick={() => setI((v) => Math.min(frames.length - 1, v + 1))}
            >
              Next →
            </BubbleButton>
          </div>
        </Panel>
      ) : null}

      {categories.map((cat) => (
        <Panel key={cat} className="flex flex-col gap-2">
          <Label>{cat}</Label>
          <div className="flex flex-wrap gap-2">
            {bundle.plays
              .filter((p) => p.category === cat)
              .map((p) => (
                <BubbleButton
                  key={p.id}
                  size="sm"
                  tone={openId === p.id ? "grape" : "neutral"}
                  onClick={() => {
                    setOpenId(p.id);
                    setI(0);
                  }}
                >
                  {p.name}
                </BubbleButton>
              ))}
          </div>
        </Panel>
      ))}
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
