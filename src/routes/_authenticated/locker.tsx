import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  Field,
  Label,
  Panel,
  Pill,
  SelectInput,
  TextInput,
} from "@/components/Bubbles";
import {
  createTeamEvent,
  deleteTeamEvent,
  fetchTeamEvents,
  lockerCalendarUrl,
  lockerUrl,
  setLockerSharing,
} from "@/lib/data";
import { useMe } from "@/lib/useMe";

export const Route = createFileRoute("/_authenticated/locker")({
  head: () => ({
    meta: [
      { title: "Share Team Locker Room Link — CoachSide" },
      {
        name: "description",
        content:
          "Share one read-only link with families for team and player stats and a Google-Calendar-ready schedule of games and practices.",
      },
      { property: "og:title", content: "Share Team Locker Room Link — CoachSide" },
      {
        property: "og:description",
        content: "One read-only link for families: team stats and the schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LockerAdmin,
});

const KINDS = [
  { value: "game", label: "Game" },
  { value: "practice", label: "Practice" },
  { value: "event", label: "Team event" },
];

function LockerAdmin() {
  const me = useMe();
  const qc = useQueryClient();
  const [teamId, setTeamId] = useState<string>("");

  useEffect(() => {
    if (!teamId && me.teams.length) setTeamId(me.teams[0]!.id);
  }, [me.teams, teamId]);

  const team = me.teams.find((t) => t.id === teamId) ?? null;

  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchTeamEvents(teamId),
    enabled: !!teamId,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setLockerSharing(teamId, enabled),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Locker room sharing updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("practice");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [place, setPlace] = useState("");

  const addEvent = useMutation({
    mutationFn: () =>
      createTeamEvent({
        team_id: teamId,
        event_type: kind,
        title: title.trim(),
        starts_at: new Date(starts).toISOString(),
        ends_at: ends ? new Date(ends).toISOString() : null,
        location: place.trim() || null,
        notes: null,
      }),
    onSuccess: async () => {
      setTitle("");
      setStarts("");
      setEnds("");
      setPlace("");
      await qc.invalidateQueries({ queryKey: ["team-events", teamId] });
      toast.success("Added to the team calendar");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEvent = useMutation({
    mutationFn: (id: string) => deleteTeamEvent(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["team-events", teamId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shareLink = team?.locker_token ? lockerUrl(team.locker_token) : "";
  const calLink = team?.locker_token ? lockerCalendarUrl(team.locker_token) : "";

  const copy = (value: string, what: string) => {
    void navigator.clipboard?.writeText(value);
    toast.success(`${what} copied`);
  };

  return (
    <AppShell title="Locker Room" subtitle="Read-only stats and schedule link for families">
      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Team</Label>
        <SelectInput value={teamId} onChange={(e) => setTeamId(e.target.value)} className="max-w-xs">
          {me.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.season}
            </option>
          ))}
        </SelectInput>
      </Panel>

      {team ? (
        <>
          <Panel className="mb-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label>Sharing</Label>
              <Pill tone={team.locker_enabled ? "success" : "muted"}>
                {team.locker_enabled ? "Link is live" : "Link is off"}
              </Pill>
              <BubbleButton
                tone={team.locker_enabled ? "neutral" : "grape"}
                onClick={() => toggle.mutate(!team.locker_enabled)}
                disabled={toggle.isPending}
              >
                {team.locker_enabled ? "Turn off link" : "Turn on link"}
              </BubbleButton>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-2">
              <Pill tone="muted" className="max-w-full break-all">
                {shareLink}
              </Pill>
              <BubbleButton size="sm" tone="flame" onClick={() => copy(shareLink, "Locker room link")}>
                Copy locker room link
              </BubbleButton>
              <BubbleButton size="sm" tone="neutral" onClick={() => copy(calLink, "Calendar link")}>
                Copy calendar link
              </BubbleButton>
            </div>
            <Pill tone="muted">
              Anyone with the link sees team and player stats and this schedule only — no playbook
              and no chat. Read-only, no sign-in. Players use the Locker Room QR code instead.
            </Pill>
          </Panel>

          <Panel className="mb-3 flex flex-col gap-2">
            <Label>Add a game or practice</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="What">
                <SelectInput value={kind} onChange={(e) => setKind(e.target.value)}>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Title">
                <TextInput
                  value={title}
                  placeholder="vs Mission Viejo"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Starts">
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
              <Field label="Location (optional)">
                <TextInput
                  value={place}
                  placeholder="Main gym"
                  onChange={(e) => setPlace(e.target.value)}
                />
              </Field>
            </div>
            <BubbleButton
              tone="grape"
              disabled={!title.trim() || !starts || addEvent.isPending}
              onClick={() => addEvent.mutate()}
            >
              Add to calendar
            </BubbleButton>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Team calendar</Label>
            {(events.data ?? []).length ? (
              (events.data ?? []).map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-2"
                >
                  <Pill tone={e.kind === "game" ? "flame" : "grape"}>
                    {e.kind === "game" ? "Game" : e.kind === "practice" ? "Practice" : "Team"}
                  </Pill>
                  <Pill tone="neutral">{e.title}</Pill>
                  <Pill tone="muted">
                    {new Date(e.starts_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Pill>
                  {e.location ? <Pill tone="muted">{e.location}</Pill> : null}
                  <BubbleButton
                    size="sm"
                    tone="neutral"
                    className="ml-auto"
                    onClick={() => removeEvent.mutate(e.id)}
                  >
                    Remove
                  </BubbleButton>
                </div>
              ))
            ) : (
              <Pill tone="muted">No games or practices scheduled yet</Pill>
            )}
          </Panel>
        </>
      ) : (
        <Panel>
          <Label>Add a team first to open a locker room</Label>
        </Panel>
      )}
    </AppShell>
  );
}
