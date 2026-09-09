import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  Field,
  Label,
  Panel,
  Pill,
  SelectInput,
  TextInput,
} from "@/components/Bubbles";
import {
  createReminders,
  createTeamEvent,
  deleteTeamEvent,
  fetchGames,
  fetchReminders,
  fetchTeamEvents,
  lockerCalendarUrl,
  setLockerSharing,
  updateTeamEvent,
} from "@/lib/data";
import { EVENT_TYPES, EVENT_TYPE_LABEL, type TeamEvent } from "@/lib/types";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Team Calendar — CoachSide" },
      {
        name: "description",
        content:
          "Plan practices, games and team events in one place, with arrival times, uniforms, reminders and a shareable team schedule.",
      },
      { property: "og:title", content: "Team Calendar — CoachSide" },
      {
        property: "og:description",
        content: "Practices, games and team events with reminders and a shared schedule link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

type ViewMode = "agenda" | "week" | "month";
type Filter = "all" | "practice" | "game" | "event";

const PRACTICE_SPOTS = ["Main Gym", "Auxiliary Gym", "Weight Room", "Track"];

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function typeTone(t: string): "flame" | "grape" | "neutral" {
  if (t === "game" || t === "tournament") return "flame";
  if (t === "practice" || t === "workout") return "grape";
  return "neutral";
}

function bucket(e: TeamEvent): Filter {
  if (e.event_type === "game" || e.event_type === "tournament") return "game";
  if (e.event_type === "practice" || e.event_type === "workout") return "practice";
  return "event";
}

function CalendarPage() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState("");
  const [view, setView] = useState<ViewMode>("agenda");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamEvent | null>(null);

  useEffect(() => {
    if (!teamId && me.teams.length) setTeamId(me.teams[0]!.id);
  }, [me.teams, teamId]);

  const team = me.teams.find((t) => t.id === teamId) ?? null;

  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchTeamEvents(teamId),
    enabled: !!teamId,
  });

  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });

  const reminders = useQuery({
    queryKey: ["event-reminders", teamId, (events.data ?? []).length],
    queryFn: () => fetchReminders((events.data ?? []).map((e) => e.id)),
    enabled: !!(events.data ?? []).length,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTeamEvent(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["team-events", teamId] });
      toast.success("Event removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const share = useMutation({
    mutationFn: () => setLockerSharing(teamId, true),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team calendar link is live");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = events.data ?? [];
  const shown = useMemo(() => {
    const now = Date.now();
    let list = all.filter((e) => filter === "all" || bucket(e) === filter);
    if (view === "week" || view === "month") {
      const end = now + (view === "week" ? 7 : 31) * 86400000;
      list = list.filter((e) => {
        const t = new Date(e.starts_at).getTime();
        return t >= now - 86400000 && t <= end;
      });
    }
    return list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [all, filter, view]);

  const nextOf = (kind: Filter) => {
    const now = Date.now();
    return (
      all
        .filter((e) => bucket(e) === kind && new Date(e.starts_at).getTime() >= now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
    );
  };

  const grouped = useMemo(() => {
    const map = new Map<string, TeamEvent[]>();
    for (const e of shown) {
      const key = new Date(e.starts_at).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return Array.from(map.entries());
  }, [shown]);

  const feed = team?.locker_token ? lockerCalendarUrl(team.locker_token) : "";

  return (
    <AppShell title="Team Calendar" subtitle="Practices, games and team events in one place">
      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Team</Label>
        <SelectInput
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="max-w-xs"
        >
          {me.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.season}
            </option>
          ))}
        </SelectInput>
        <BubbleButton
          tone="flame"
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setOpen((v) => !v);
          }}
        >
          {open ? "Close" : "+ Event"}
        </BubbleButton>
      </Panel>

      {!team ? (
        <Panel>
          <EmptyState>Add a team in Rosters to start a calendar</EmptyState>
        </Panel>
      ) : (
        <>
          <Panel className="mb-3 grid gap-2 sm:grid-cols-3">
            {(
              [
                ["practice", "Next practice"],
                ["game", "Next game"],
                ["event", "Next team event"],
              ] as const
            ).map(([k, label]) => {
              const e = nextOf(k);
              return (
                <div
                  key={k}
                  className="flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-surface-2/70 p-3"
                >
                  <Pill tone={typeTone(k)}>{label}</Pill>
                  {e ? (
                    <>
                      <span className="rounded-2xl border border-border bg-surface px-3 py-2 text-lg font-black leading-tight text-foreground">{e.title}</span>
                      <Pill tone="muted">
                        {fmtDay(e.starts_at)} · {fmtTime(e.starts_at)}
                      </Pill>
                      {e.location ? <Pill tone="muted">{e.location}</Pill> : null}
                    </>
                  ) : (
                    <Pill tone="muted">Nothing scheduled</Pill>
                  )}
                </div>
              );
            })}
          </Panel>

          {open ? (
            <EventForm
              key={editing?.id ?? "new"}
              teamId={teamId}
              defaults={{
                homeGym: team.home_gym ?? null,
                practiceSpot: team.default_practice_location ?? null,
                arrivalOffset: team.default_arrival_offset_minutes ?? 60,
                practiceReminder: team.default_practice_reminder_minutes ?? 60,
                gameReminder: team.default_game_reminder_minutes ?? 60,
              }}
              editing={editing}
              onDone={async () => {
                setOpen(false);
                setEditing(null);
                await qc.invalidateQueries({ queryKey: ["team-events", teamId] });
              }}
            />
          ) : null}

          <Panel className="mb-3 flex flex-wrap items-center gap-2">
            <Label>View</Label>
            {(
              [
                ["agenda", "Agenda"],
                ["week", "Week"],
                ["month", "Month"],
              ] as const
            ).map(([v, label]) => (
              <BubbleButton
                key={v}
                size="sm"
                tone={view === v ? "grape" : "neutral"}
                onClick={() => setView(v)}
              >
                {label}
              </BubbleButton>
            ))}
            <Label className="ml-2">Show</Label>
            {(
              [
                ["all", "All"],
                ["practice", "Practices"],
                ["game", "Games"],
                ["event", "Team events"],
              ] as const
            ).map(([f, label]) => (
              <BubbleButton
                key={f}
                size="sm"
                tone={filter === f ? "flame" : "neutral"}
                onClick={() => setFilter(f)}
              >
                {label}
              </BubbleButton>
            ))}
          </Panel>

          <Panel className="mb-3 flex flex-wrap items-center gap-2">
            <Label>Share with players & families</Label>
            {team.locker_enabled ? (
              <>
                <Pill tone="success">Subscription link is live</Pill>
                <BubbleButton
                  size="sm"
                  tone="grape"
                  onClick={() => {
                    void navigator.clipboard?.writeText(feed);
                    toast.success("Calendar link copied");
                  }}
                >
                  Copy calendar link
                </BubbleButton>
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
                    feed.replace(/^https?:/, "webcal:"),
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BubbleButton size="sm" tone="flame">
                    Add to Calendar
                  </BubbleButton>
                </a>
              </>
            ) : (
              <BubbleButton
                size="sm"
                tone="grape"
                disabled={share.isPending}
                onClick={() => share.mutate()}
              >
                Turn on subscribe link
              </BubbleButton>
            )}
          </Panel>

          {grouped.length ? (
            grouped.map(([day, list]) => (
              <Panel key={day} className="mb-3 flex flex-col gap-2">
                <Label>{fmtDay(list[0]!.starts_at)}</Label>
                {list.map((e) => {
                  const game = games.data?.find((g) => g.id === e.game_id) ?? null;
                  const rem = (reminders.data ?? []).filter((r) => r.event_id === e.id);
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        "flex flex-wrap items-center gap-2 rounded-2xl border p-3",
                        bucket(e) === "game"
                          ? "border-flame/50 bg-flame/10"
                          : bucket(e) === "practice"
                            ? "border-grape/50 bg-grape/10"
                            : "border-border/70 bg-surface-2/70",
                      )}
                    >
                      <Pill tone={typeTone(e.event_type)}>
                        {(EVENT_TYPE_LABEL[e.event_type] ?? "Event").toUpperCase()}
                      </Pill>
                      <span className="rounded-2xl border border-border bg-surface px-3 py-2 text-lg font-black leading-tight text-foreground">
                        {e.event_type === "game" && e.opponent
                          ? `${e.home_away === "away" ? "@" : "vs"} ${e.opponent}`
                          : e.title}
                      </span>
                      {e.event_type === "game" && e.home_away ? (
                        <Pill tone="muted">
                          {e.home_away === "home"
                            ? "Home"
                            : e.home_away === "away"
                              ? "Away"
                              : "Neutral"}
                        </Pill>
                      ) : null}
                      {e.arrival_at ? <Pill tone="muted">Arrival {fmtTime(e.arrival_at)}</Pill> : null}
                      <Pill tone="muted">
                        {e.event_type === "game" ? "Tip " : ""}
                        {fmtTime(e.starts_at)}
                        {e.ends_at ? `–${fmtTime(e.ends_at)}` : ""}
                      </Pill>
                      {e.location ? <Pill tone="muted">{e.location}</Pill> : null}
                      {e.uniform ? <Pill tone="muted">{e.uniform} uniforms</Pill> : null}
                      {rem.length ? <Pill tone="muted">{rem.length} reminders</Pill> : null}
                      {e.notes ? <Pill tone="muted">{e.notes}</Pill> : null}

                      <div className="ml-auto flex flex-wrap gap-2">
                        {e.event_type === "game" && game && game.status === "final" ? (
                          <>
                            <Pill tone="grape">
                              Final {game.team_score}-{game.opp_score}
                            </Pill>
                            <BubbleButton
                              size="sm"
                              tone="grape"
                              onClick={() =>
                                navigate({ to: "/review/$gameId", params: { gameId: game.id } })
                              }
                            >
                              View Game Review
                            </BubbleButton>
                          </>
                        ) : e.event_type === "game" && game ? (
                          <BubbleButton
                            size="sm"
                            tone="flame"
                            onClick={() =>
                              navigate({ to: "/game/$gameId", params: { gameId: game.id } })
                            }
                          >
                            Back to live game
                          </BubbleButton>
                        ) : e.event_type === "game" ? (
                          <BubbleButton
                            size="sm"
                            tone="flame"
                            onClick={() =>
                              navigate({
                                to: "/games/new",
                                search: {
                                  team: e.team_id,
                                  opponent: e.opponent ?? "",
                                  homeAway: e.home_away === "away" ? "away" : "home",
                                  date: e.starts_at.slice(0, 10),
                                  eventId: e.id,
                                },
                              })
                            }
                          >
                            Start Game
                          </BubbleButton>
                        ) : null}
                        <BubbleButton
                          size="sm"
                          tone="neutral"
                          onClick={() => {
                            setEditing(e);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </BubbleButton>
                        <BubbleButton
                          size="sm"
                          tone="neutral"
                          onClick={() => remove.mutate(e.id)}
                        >
                          Remove
                        </BubbleButton>
                      </div>
                    </div>
                  );
                })}
              </Panel>
            ))
          ) : (
            <Panel>
              <EmptyState>Nothing on the calendar for this view yet</EmptyState>
            </Panel>
          )}
        </>
      )}
    </AppShell>
  );
}

function EventForm({
  teamId,
  defaults,
  editing,
  onDone,
}: {
  teamId: string;
  defaults: {
    homeGym: string | null;
    practiceSpot: string | null;
    arrivalOffset: number;
    practiceReminder: number;
    gameReminder: number;
  };
  editing: TeamEvent | null;
  onDone: () => void | Promise<void>;
}) {
  const [type, setType] = useState<string>(editing?.event_type ?? "practice");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [starts, setStarts] = useState(
    editing ? toLocalInput(new Date(editing.starts_at)) : toLocalInput(new Date()),
  );
  const [ends, setEnds] = useState(editing?.ends_at ? toLocalInput(new Date(editing.ends_at)) : "");
  const [place, setPlace] = useState(editing?.location ?? defaults.practiceSpot ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [opponent, setOpponent] = useState(editing?.opponent ?? "");
  const [homeAway, setHomeAway] = useState(editing?.home_away ?? "home");
  const [arrival, setArrival] = useState(
    editing?.arrival_at ? toLocalInput(new Date(editing.arrival_at)) : "",
  );
  const [uniform, setUniform] = useState(editing?.uniform ?? "");
  const [visibility, setVisibility] = useState(editing?.visibility ?? "team");
  const [remindMorning, setRemindMorning] = useState(type === "game");
  const [remindBefore, setRemindBefore] = useState<number>(
    type === "game" ? defaults.gameReminder : defaults.practiceReminder,
  );

  const isGame = type === "game" || type === "tournament";
  const isPractice = type === "practice" || type === "workout";

  useEffect(() => {
    if (editing) return;
    setRemindMorning(isGame);
    setRemindBefore(isGame ? defaults.gameReminder : defaults.practiceReminder);
    if (isGame && homeAway === "home" && defaults.homeGym) setPlace(defaults.homeGym);
    if (isPractice && defaults.practiceSpot) setPlace(defaults.practiceSpot);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isGame || !starts || arrival) return;
    const t = new Date(starts).getTime() - defaults.arrivalOffset * 60000;
    setArrival(toLocalInput(new Date(t)));
  }, [starts, isGame]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        event_type: type,
        title:
          title.trim() ||
          (isGame && opponent.trim()
            ? `${homeAway === "away" ? "@" : "vs"} ${opponent.trim()}`
            : (EVENT_TYPE_LABEL[type] ?? "Team event")),
        starts_at: new Date(starts).toISOString(),
        ends_at: ends ? new Date(ends).toISOString() : null,
        location: place.trim() || null,
        notes: notes.trim() || null,
        opponent: isGame ? opponent.trim() || null : null,
        home_away: isGame ? homeAway : null,
        arrival_at: isGame && arrival ? new Date(arrival).toISOString() : null,
        uniform: isGame ? uniform.trim() || null : null,
        visibility,
      };
      if (editing) {
        await updateTeamEvent(editing.id, payload);
        return editing.id;
      }
      const created = await createTeamEvent({ team_id: teamId, ...payload });
      const rem: {
        reminder_type: string;
        minutes_before: number | null;
        fixed_time: string | null;
      }[] = [];
      if (remindMorning)
        rem.push({ reminder_type: "morning_of", minutes_before: null, fixed_time: "08:00" });
      if (remindBefore > 0)
        rem.push({ reminder_type: "relative", minutes_before: remindBefore, fixed_time: null });
      await createReminders(created.id, rem);
      return created.id;
    },
    onSuccess: async () => {
      toast.success(editing ? "Event updated" : "Added to the team calendar");
      await onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="mb-3 flex flex-col gap-3">
      <Label>{editing ? "Edit event" : "New event"}</Label>
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map((t) => (
          <BubbleButton
            key={t}
            size="sm"
            tone={type === t ? "grape" : "neutral"}
            onClick={() => setType(t)}
          >
            {EVENT_TYPE_LABEL[t]}
          </BubbleButton>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Title">
          <TextInput
            value={title}
            placeholder={isGame ? "vs Tesoro" : "Team practice"}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label={isGame ? "Tip-off" : "Starts"}>
          <TextInput
            type="datetime-local"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
          />
        </Field>
        <Field label="Ends (optional)">
          <TextInput
            type="datetime-local"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
          />
        </Field>
        <Field label="Location">
          <TextInput value={place} placeholder="Main Gym" onChange={(e) => setPlace(e.target.value)} />
        </Field>

        {isPractice ? (
          <Field label="Quick gym pick">
            <div className="flex flex-wrap gap-2">
              {PRACTICE_SPOTS.map((s) => (
                <BubbleButton
                  key={s}
                  size="sm"
                  tone={place === s ? "grape" : "neutral"}
                  onClick={() => setPlace(s)}
                >
                  {s}
                </BubbleButton>
              ))}
            </div>
          </Field>
        ) : null}

        {isGame ? (
          <>
            <Field label="Opponent">
              <TextInput
                value={opponent}
                placeholder="Tesoro"
                onChange={(e) => setOpponent(e.target.value)}
              />
            </Field>
            <Field label="Venue">
              <div className="flex flex-wrap gap-2">
                {(["home", "away", "neutral"] as const).map((v) => (
                  <BubbleButton
                    key={v}
                    size="sm"
                    tone={homeAway === v ? "flame" : "neutral"}
                    onClick={() => {
                      setHomeAway(v);
                      if (v === "home" && defaults.homeGym) setPlace(defaults.homeGym);
                    }}
                  >
                    {v === "home" ? "Home" : v === "away" ? "Away" : "Neutral"}
                  </BubbleButton>
                ))}
              </div>
            </Field>
            <Field label="Arrival time">
              <TextInput
                type="datetime-local"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
              />
            </Field>
            <Field label="Uniform">
              <TextInput
                value={uniform}
                placeholder="White"
                onChange={(e) => setUniform(e.target.value)}
              />
            </Field>
          </>
        ) : null}

        <Field label="Notes">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Visibility">
          <SelectInput value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="team">Whole team</option>
            <option value="coaches">Coaches only</option>
          </SelectInput>
        </Field>
      </div>

      {!editing ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-2">
          <Label>Reminders</Label>
          <BubbleButton
            size="sm"
            tone={remindMorning ? "grape" : "neutral"}
            onClick={() => setRemindMorning((v) => !v)}
          >
            Morning of · 8:00 AM
          </BubbleButton>
          {[30, 60, 120].map((m) => (
            <BubbleButton
              key={m}
              size="sm"
              tone={remindBefore === m ? "flame" : "neutral"}
              onClick={() => setRemindBefore(remindBefore === m ? 0 : m)}
            >
              {m >= 60 ? `${m / 60} hr before` : `${m} min before`}
            </BubbleButton>
          ))}
        </div>
      ) : null}

      <BubbleButton
        tone="flame"
        disabled={!starts || save.isPending}
        onClick={() => save.mutate()}
      >
        {editing ? "Save event" : "Add to calendar"}
      </BubbleButton>
    </Panel>
  );
}
