import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BubbleButton, Label, Pill, SelectInput } from "@/components/Bubbles";
import { fetchPlaybookFolders, fetchTeamEvents, fetchTeamPlays } from "@/lib/data";
import { fetchMyDrills } from "@/lib/drills";
import { fetchPracticePlans } from "@/lib/practice";
import type { Attachment, NewAttachment } from "@/lib/locker";
import { EVENT_TYPE_LABEL } from "@/lib/types";

/**
 * Attachments point at existing CoachSide objects by id. The type list already
 * covers future video objects, so clips can be attached without a rewrite.
 */

export function useTeamAttachmentSources(teamId: string | null) {
  const plays = useQuery({
    queryKey: ["team-plays", teamId],
    queryFn: () => fetchTeamPlays(teamId as string),
    enabled: !!teamId,
  });
  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchTeamEvents(teamId as string),
    enabled: !!teamId,
  });
  const folders = useQuery({ queryKey: ["playbook-folders", teamId], queryFn: () => fetchPlaybookFolders(teamId as string), enabled: !!teamId });
  const drills = useQuery({ queryKey: ["my-drills"], queryFn: fetchMyDrills, enabled: !!teamId });
  const plans = useQuery({ queryKey: ["practice-plans", teamId], queryFn: () => fetchPracticePlans(teamId), enabled: !!teamId });
  return {
    plays: plays.data ?? [],
    events: events.data ?? [],
    folders: folders.data ?? [],
    drills: drills.data ?? [],
    practicePlans: plans.data ?? [],
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
        search={{ from: "lockerroom", ...(teamId ? { team: teamId } : {}) }}
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
        to="/lockerroom"
        search={attachment.related_id ? { area: "schedule", item: attachment.related_id } : { area: "schedule" }}
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

  if (attachment.attachment_type === "playbook_folder") {
    return <Link to="/lockerroom" search={attachment.related_id ? { area: "playbook", folder: attachment.related_id } : { area: "playbook" }} className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-grape/60 bg-grape/15 px-3 py-2"><Pill tone="grape">Playbook Folder</Pill><span className="text-base font-black text-foreground">{(attachment.metadata["name"] as string) ?? "Open folder"}</span></Link>;
  }
  if (attachment.attachment_type === "drill") {
    return <Link to="/drills" className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-flame/60 bg-flame/15 px-3 py-2"><Pill tone="flame">Drill</Pill><span className="text-base font-black text-foreground">{(attachment.metadata["name"] as string) ?? "Open drill"}</span></Link>;
  }
  if (attachment.attachment_type === "practice_plan") {
    return <Link to="/practice/$planId" params={{ planId: attachment.related_id ?? "" }} className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/80 px-3 py-2"><Pill tone="neutral">Practice Plan</Pill><span className="text-base font-black text-foreground">{(attachment.metadata["name"] as string) ?? "Open practice plan"}</span></Link>;
  }
  if (attachment.attachment_type === "plan") {
    return <Link to="/lockerroom" search={attachment.related_id ? { area: "plans", item: attachment.related_id } : { area: "plans" }} className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/80 px-3 py-2"><Pill tone="neutral">Plan</Pill><span className="text-base font-black text-foreground">{(attachment.metadata["name"] as string) ?? "Open plan"}</span></Link>;
  }
  if (attachment.attachment_type === "url") {
    const href = String(attachment.metadata["url"] ?? "");
    return <a href={href} target="_blank" rel="noreferrer" className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/80 px-3 py-2"><Pill tone="muted">Link</Pill><span className="text-base font-black text-foreground">{(attachment.metadata["label"] as string) ?? "Open link"}</span></a>;
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
  compact = false,
}: {
  teamId: string | null;
  value: NewAttachment[];
  onChange: (next: NewAttachment[]) => void;
  compact?: boolean;
}) {
  const { plays, events, folders, drills, practicePlans } = useTeamAttachmentSources(teamId);
  const [playId, setPlayId] = useState("");
  const [eventId, setEventId] = useState("");
  const [kind, setKind] = useState("play");
  const [otherId, setOtherId] = useState("");
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(!compact);

  const add = (a: NewAttachment) => {
    if (value.some((v) => v.related_id === a.related_id)) return;
    onChange([...value, a]);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/50 p-2">
      <BubbleButton size="sm" tone="neutral" className="w-fit" onClick={() => setOpen((v) => !v)}>{open ? "Close attachments" : "+ Attach"}</BubbleButton>
      {open ? <>
      <Label>Attach</Label>
      <SelectInput value={kind} onChange={(e) => { setKind(e.target.value); setOtherId(""); }}>
        <option value="play">Play</option><option value="playbook_folder">Playbook Folder</option><option value="drill">Drill</option><option value="practice_plan">Practice Plan</option><option value="event">Event</option><option value="url">Resource / Link</option>
      </SelectInput>
      <div className="grid gap-2 sm:grid-cols-2">
        {kind === "play" ? <div className="flex gap-2">
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
        </div> : null}
        {kind === "event" ? <div className="flex gap-2">
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
        </div> : null}
        {kind === "playbook_folder" || kind === "drill" || kind === "practice_plan" ? <div className="flex gap-2">
          <SelectInput value={otherId} onChange={(e) => setOtherId(e.target.value)}><option value="">Choose…</option>{(kind === "playbook_folder" ? folders : kind === "drill" ? drills : practicePlans).map((x) => <option key={x.id} value={x.id}>{"name" in x ? x.name : x.title}</option>)}</SelectInput>
          <BubbleButton size="sm" tone="grape" disabled={!otherId} onClick={() => { const source = kind === "playbook_folder" ? folders : kind === "drill" ? drills : practicePlans; const item = source.find((x) => x.id === otherId); add({ attachment_type: kind as NewAttachment["attachment_type"], related_id: otherId, metadata: { name: item && ("name" in item ? item.name : item.title) } }); setOtherId(""); }}>Add</BubbleButton>
        </div> : null}
        {kind === "url" ? <div className="flex gap-2"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="min-h-11 min-w-0 flex-1 rounded-2xl border border-input bg-surface px-3 text-foreground"/><BubbleButton size="sm" tone="flame" disabled={!/^https:\/\//i.test(url)} onClick={() => { add({ attachment_type: "url", related_id: null, metadata: { url, label: url } }); setUrl(""); }}>Add</BubbleButton></div> : null}
      </div>
      </> : null}
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
