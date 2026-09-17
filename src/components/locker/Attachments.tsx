import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BubbleButton, Label, Pill, SelectInput } from "@/components/Bubbles";
import { fetchPlays, fetchTeamEvents } from "@/lib/data";
import type { Attachment, NewAttachment } from "@/lib/locker";
import { EVENT_TYPE_LABEL } from "@/lib/types";

/**
 * Attachments point at existing CoachSide objects by id. The type list already
 * covers future video objects, so clips can be attached without a rewrite.
 */

export function useTeamAttachmentSources(teamId: string | null) {
  const plays = useQuery({ queryKey: ["plays"], queryFn: fetchPlays, enabled: !!teamId });
  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchTeamEvents(teamId as string),
    enabled: !!teamId,
  });
  return {
    plays: (plays.data ?? []).filter((p) => !teamId || p.team_id === teamId || p.team_id === null),
    events: events.data ?? [],
  };
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Read-only card shown inside a message, announcement or assignment. */
export function AttachmentCard({
  attachment,
  teamId,
}: {
  attachment: Attachment;
  teamId: string | null;
}) {
  const { plays, events } = useTeamAttachmentSources(teamId);

  if (attachment.attachment_type === "play") {
    const play = plays.find((p) => p.id === attachment.related_id);
    return (
      <Link
        to="/plays/$playId/view"
        params={{ playId: attachment.related_id ?? "" }}
        search={{ from: "lockerroom" }}
        className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-grape/60 bg-grape/15 px-3 py-2 transition-colors hover:bg-grape/25"
      >
        <Pill tone="grape">Play</Pill>
        <span className="text-base font-black text-foreground">
          {play?.name ?? (attachment.metadata["name"] as string) ?? "Saved play"}
        </span>
        <Pill tone="muted">Tap to watch</Pill>
      </Link>
    );
  }

  if (attachment.attachment_type === "event") {
    const ev = events.find((e) => e.id === attachment.related_id);
    return (
      <Link
        to="/calendar"
        className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-flame/60 bg-flame/15 px-3 py-2 transition-colors hover:bg-flame/25"
      >
        <Pill tone="flame">{EVENT_TYPE_LABEL[ev?.event_type ?? "event"] ?? "Event"}</Pill>
        <span className="text-base font-black text-foreground">
          {ev?.title ?? (attachment.metadata["title"] as string) ?? "Team event"}
        </span>
        {ev ? <Pill tone="muted">{fmtWhen(ev.starts_at)}</Pill> : <Pill tone="muted">Time TBD</Pill>}
        {ev?.location ? <Pill tone="muted">{ev.location}</Pill> : null}
        {ev?.opponent ? <Pill tone="neutral">vs {ev.opponent}</Pill> : null}
        {ev?.arrival_at ? <Pill tone="muted">Arrive {fmtWhen(ev.arrival_at)}</Pill> : null}
      </Link>
    );
  }

  if (attachment.attachment_type === "game") {
    return (
      <Link
        to="/review/$gameId"
        params={{ gameId: attachment.related_id ?? "" }}
        className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/80 px-3 py-2"
      >
        <Pill tone="neutral">Game review</Pill>
        <span className="text-base font-black text-foreground">
          {(attachment.metadata["label"] as string) ?? "Open the game"}
        </span>
      </Link>
    );
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/80 px-3 py-2">
      <Pill tone="muted">{attachment.attachment_type.replace(/_/g, " ")}</Pill>
      <span className="text-sm font-bold text-foreground">
        {(attachment.metadata["label"] as string) ?? "Attached item"}
      </span>
    </div>
  );
}

/** Coach-side picker: attach a saved play or a scheduled event. */
export function AttachmentPicker({
  teamId,
  value,
  onChange,
}: {
  teamId: string | null;
  value: NewAttachment[];
  onChange: (next: NewAttachment[]) => void;
}) {
  const { plays, events } = useTeamAttachmentSources(teamId);
  const [playId, setPlayId] = useState("");
  const [eventId, setEventId] = useState("");

  const add = (a: NewAttachment) => {
    if (value.some((v) => v.related_id === a.related_id)) return;
    onChange([...value, a]);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/50 p-2">
      <Label>Attach</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex gap-2">
          <SelectInput value={playId} onChange={(e) => setPlayId(e.target.value)}>
            <option value="">Choose a play…</option>
            {plays.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
          <BubbleButton
            size="sm"
            tone="grape"
            disabled={!playId}
            onClick={() => {
              const p = plays.find((x) => x.id === playId);
              add({ attachment_type: "play", related_id: playId, metadata: { name: p?.name } });
              setPlayId("");
            }}
          >
            Add play
          </BubbleButton>
        </div>
        <div className="flex gap-2">
          <SelectInput value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Choose an event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {fmtWhen(e.starts_at)}
              </option>
            ))}
          </SelectInput>
          <BubbleButton
            size="sm"
            tone="flame"
            disabled={!eventId}
            onClick={() => {
              const e = events.find((x) => x.id === eventId);
              add({ attachment_type: "event", related_id: eventId, metadata: { title: e?.title } });
              setEventId("");
            }}
          >
            Add event
          </BubbleButton>
        </div>
      </div>
      {value.length ? (
        <div className="flex flex-wrap gap-2">
          {value.map((a) => (
            <button
              key={`${a.attachment_type}-${a.related_id}`}
              type="button"
              onClick={() => onChange(value.filter((v) => v.related_id !== a.related_id))}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground"
            >
              {a.attachment_type === "play" ? "Play" : "Event"}:{" "}
              {(a.metadata?.["name"] as string) ?? (a.metadata?.["title"] as string) ?? "item"} ✕
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
