import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, CheckCircle2, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BubbleButton, InfoPanel, Pill } from "@/components/Bubbles";
import { supabase } from "@/integrations/supabase/client";
import { resolveAiAction } from "@/lib/ai/assistant.functions";
import type { AiActionKind, AiActionStatus } from "@/lib/ai/limits";
import {
  buildEventPreview,
  buildRosterPreview,
  dateLabel,
  previewCounts,
  to12h,
  type EventPreviewItem,
  type PlayerPreviewItem,
} from "@/lib/ai/preview";
import { cn } from "@/lib/utils";

type ActionRow = {
  id: string;
  kind: AiActionKind;
  status: AiActionStatus;
  payload: Record<string, unknown>;
  result: {
    summary?: string;
    created?: number;
    failed?: { label: string; message: string }[];
  } | null;
};

const TYPE_LABEL = { game: "Game", practice: "Practice", event: "Event" } as const;
const fieldCls =
  "min-h-10 w-full min-w-0 rounded-xl border border-input bg-surface-2/80 px-2 text-sm font-semibold text-foreground outline-none focus:border-grape";

/** Review/confirm card for a change the assistant staged. Nothing saves until Confirm. */
export function AiActionCard({ actionId }: { actionId: string }) {
  const qc = useQueryClient();
  const resolveFn = useServerFn(resolveAiAction);
  const q = useQuery({
    queryKey: ["ai-action", actionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_pending_actions")
        .select("id,kind,status,payload,result")
        .eq("id", actionId)
        .single();
      if (error) throw error;
      return data as unknown as ActionRow;
    },
  });
  const row = q.data;
  const [editing, setEditing] = useState(false);
  const [events, setEvents] = useState<EventPreviewItem[]>([]);
  const [players, setPlayers] = useState<PlayerPreviewItem[]>([]);
  useEffect(() => {
    if (!row) return;
    if (row.kind === "schedule_create")
      setEvents((row.payload["items"] ?? []) as EventPreviewItem[]);
    if (row.kind === "roster_add") setPlayers((row.payload["items"] ?? []) as PlayerPreviewItem[]);
  }, [row]);

  const resolve = useMutation({
    mutationFn: (decision: "confirm" | "cancel") =>
      resolveFn({
        data: {
          actionId,
          decision,
          ...(row?.kind === "schedule_create" ? { events } : {}),
          ...(row?.kind === "roster_add" ? { players } : {}),
        },
      }),
    onSuccess: async (res, decision) => {
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ["ai-action", actionId] });
      if (decision === "confirm") {
        if (res.status === "failed")
          toast.error(res.result?.failed?.[0]?.message ?? "Nothing was saved.");
        else toast.success(res.result?.summary ?? "Saved");
        // Roster, schedule and team screens pick up the change.
        void qc.invalidateQueries({
          predicate: (query) => !String(query.queryKey[0] ?? "").startsWith("ai-"),
        });
      }
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save this change."),
  });

  if (q.isLoading) return <Pill tone="muted">Loading preview…</Pill>;
  if (!row) return <InfoPanel tone="danger">This preview is no longer available.</InfoPanel>;

  const pending = row.status === "pending";
  const team = row.payload["team"] as { name?: string } | undefined;

  const buttons = (primary: string, canConfirm: boolean, allowEdit: boolean) =>
    pending ? (
      <div className="flex flex-wrap gap-1.5">
        <BubbleButton
          tone="flame"
          disabled={!canConfirm || resolve.isPending}
          onClick={() => resolve.mutate("confirm")}
        >
          {resolve.isPending && resolve.variables === "confirm" ? "Saving…" : primary}
        </BubbleButton>
        {allowEdit ? (
          <BubbleButton
            tone="neutral"
            disabled={resolve.isPending}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Done reviewing" : "Review/edit"}
          </BubbleButton>
        ) : null}
        <BubbleButton
          tone="ghost"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate("cancel")}
        >
          Cancel
        </BubbleButton>
      </div>
    ) : null;

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-grape/50 bg-surface/90 p-3 shadow-lg shadow-black/30">
      {row.kind === "schedule_create" ? (
        <ScheduleBody
          events={events}
          setEvents={setEvents}
          editing={editing && pending}
          teamName={team?.name}
        />
      ) : row.kind === "roster_add" ? (
        <RosterBody
          players={players}
          setPlayers={setPlayers}
          editing={editing && pending}
          teamName={team?.name}
        />
      ) : (
        <SingleBody row={row} />
      )}

      <ResultBanner row={row} />

      {row.kind === "schedule_create"
        ? (() => {
            const n = events.filter((e) => e.include && e.status !== "duplicate").length;
            return buttons(
              events.length === 1 ? "Confirm" : `Add ${n === events.length ? "all " : ""}${n}`,
              n > 0,
              true,
            );
          })()
        : row.kind === "roster_add"
          ? (() => {
              const n = players.filter((p) => p.include && p.status !== "duplicate").length;
              return buttons(
                n === players.length
                  ? `Add all ${n}`
                  : `Add ${n} valid player${n === 1 ? "" : "s"}`,
                n > 0,
                true,
              );
            })()
          : buttons("Confirm", true, false)}
    </div>
  );
}

function ResultBanner({ row }: { row: ActionRow }) {
  if (row.status === "pending") return null;
  if (row.status === "cancelled") return <Pill tone="muted">Cancelled — nothing was changed</Pill>;
  const failed = row.result?.failed ?? [];
  const ok = row.status === "confirmed" || row.status === "partial";
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black",
          ok
            ? "border-chart-4/60 bg-chart-4/15 text-foreground"
            : "border-destructive/60 bg-destructive/15 text-foreground",
        )}
      >
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-chart-4" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        {row.result?.summary ?? (ok ? "Saved" : "Nothing was saved")}
      </div>
      {failed.length ? (
        <InfoPanel tone="danger" className="p-3">
          <p className="mb-1 text-xs font-black uppercase">Not saved ({failed.length})</p>
          <ul className="space-y-0.5 text-xs">
            {failed.slice(0, 12).map((f, i) => (
              <li key={i}>
                {f.label}: {f.message}
              </li>
            ))}
          </ul>
        </InfoPanel>
      ) : null}
    </div>
  );
}

/* ---------------- schedule ---------------- */

function ScheduleBody({
  events,
  setEvents,
  editing,
  teamName,
}: {
  events: EventPreviewItem[];
  setEvents: (fn: (prev: EventPreviewItem[]) => EventPreviewItem[]) => void;
  editing: boolean;
  teamName: string | undefined;
}) {
  const counts = previewCounts(events);
  const byType = (t: EventPreviewItem["event_type"]) =>
    events.filter((e) => e.event_type === t).length;
  const update = (key: string, patch: Partial<EventPreviewItem>) =>
    setEvents((prev) =>
      prev.map((e) => {
        if (e.key !== key) return e;
        const next = { ...e, ...patch };
        if ("include" in patch && Object.keys(patch).length === 1) return next;
        // Coach-edited rows are trusted as read; duplicates are re-checked on save.
        const [rebuilt] = buildEventPreview([
          { ...next, starts_at: next.start_time, ends_at: next.end_time, confidence: 1 },
        ]);
        return {
          ...next,
          ...rebuilt!,
          key,
          include: rebuilt!.status === "ready" ? true : next.include,
        };
      }),
    );

  if (events.length === 1 && !editing) {
    const e = events[0]!;
    return (
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-grape" /> Confirm schedule change
        </span>
        <div className="grid grid-cols-2 gap-1.5 text-sm">
          <Pill tone="grape">{TYPE_LABEL[e.event_type]}</Pill>
          <Pill tone="neutral">{dateLabel(e.date)}</Pill>
          <Pill tone="neutral">
            {to12h(e.start_time)}
            {e.end_time ? ` – ${to12h(e.end_time)}` : ""}
          </Pill>
          <Pill tone="neutral">{teamName ?? "Team"}</Pill>
        </div>
        {e.title !== TYPE_LABEL[e.event_type] ? (
          <p className="text-sm font-bold text-foreground">{e.title}</p>
        ) : null}
        {e.location ? (
          <p className="text-xs font-semibold text-muted-foreground">{e.location}</p>
        ) : null}
        <Issues item={e} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-black text-foreground">
        <CalendarDays className="h-4 w-4 text-grape" /> I found {counts.total} event
        {counts.total === 1 ? "" : "s"}
        {teamName ? ` for ${teamName}` : ""}.
      </span>
      <div className="flex flex-wrap gap-1.5">
        {byType("game") ? <Pill tone="flame">{byType("game")} Games</Pill> : null}
        {byType("practice") ? <Pill tone="grape">{byType("practice")} Practices</Pill> : null}
        {byType("event") ? <Pill tone="neutral">{byType("event")} Events</Pill> : null}
        {counts.review ? <Pill tone="danger">{counts.review} need review</Pill> : null}
        {counts.duplicate ? <Pill tone="muted">{counts.duplicate} already added</Pill> : null}
      </div>
      <ul className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
        {events.map((e) =>
          editing ? (
            <li
              key={e.key}
              className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/50 p-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={e.include}
                  disabled={e.status === "duplicate"}
                  onChange={(ev) => update(e.key, { include: ev.target.checked })}
                  aria-label="Include this event"
                  className="h-5 w-5 accent-[var(--color-flame)]"
                />
                <select
                  value={e.event_type}
                  onChange={(ev) =>
                    update(e.key, { event_type: ev.target.value as EventPreviewItem["event_type"] })
                  }
                  className={cn(fieldCls, "w-28")}
                  aria-label="Type"
                >
                  <option value="game">Game</option>
                  <option value="practice">Practice</option>
                  <option value="event">Event</option>
                </select>
                <input
                  value={e.title}
                  onChange={(ev) => update(e.key, { title: ev.target.value })}
                  className={fieldCls}
                  aria-label="Title"
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="date"
                  value={e.date ?? ""}
                  onChange={(ev) => update(e.key, { date: ev.target.value || null })}
                  className={fieldCls}
                  aria-label="Date"
                />
                <input
                  type="time"
                  value={e.start_time ?? ""}
                  onChange={(ev) => update(e.key, { start_time: ev.target.value || null })}
                  className={fieldCls}
                  aria-label="Start time"
                />
                <input
                  type="time"
                  value={e.end_time ?? ""}
                  onChange={(ev) => update(e.key, { end_time: ev.target.value || null })}
                  className={fieldCls}
                  aria-label="End time"
                />
              </div>
              <input
                value={e.location ?? ""}
                placeholder="Location"
                onChange={(ev) => update(e.key, { location: ev.target.value || null })}
                className={fieldCls}
                aria-label="Location"
              />
              <Issues item={e} />
            </li>
          ) : (
            <li
              key={e.key}
              className={cn(
                "flex flex-col gap-0.5 rounded-xl border px-2.5 py-1.5",
                e.status === "ready"
                  ? "border-border/70 bg-background/40"
                  : "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-foreground">
                <span className="rounded-full border border-border px-2 py-0.5">
                  {TYPE_LABEL[e.event_type]}
                </span>
                <span>{dateLabel(e.date)}</span>
                <span>{to12h(e.start_time)}</span>
                <span className="min-w-0 truncate font-black">{e.title}</span>
              </div>
              {e.location ? (
                <span className="truncate text-[11px] font-semibold text-muted-foreground">
                  {e.location}
                </span>
              ) : null}
              <Issues item={e} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function Issues({
  item,
}: {
  item: { issues: string[]; status: string; conflict?: string | null };
}) {
  if (!item.issues.length && !item.conflict) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {item.issues.map((i) => (
        <span
          key={i}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-bold",
            item.status === "duplicate"
              ? "border-border text-muted-foreground"
              : "border-destructive/50 text-foreground",
          )}
        >
          {i}
        </span>
      ))}
      {item.conflict ? (
        <span className="rounded-full border border-flame/50 px-2 py-0.5 text-[11px] font-bold text-foreground">
          {item.conflict}
        </span>
      ) : null}
    </div>
  );
}

/* ---------------- roster ---------------- */

function RosterBody({
  players,
  setPlayers,
  editing,
  teamName,
}: {
  players: PlayerPreviewItem[];
  setPlayers: (fn: (prev: PlayerPreviewItem[]) => PlayerPreviewItem[]) => void;
  editing: boolean;
  teamName: string | undefined;
}) {
  const counts = previewCounts(players);
  const update = (key: string, patch: Partial<PlayerPreviewItem>) =>
    setPlayers((prev) => {
      const next = prev.map((p) => (p.key === key ? { ...p, ...patch } : p));
      if ("include" in patch && Object.keys(patch).length === 1) return next;
      // Re-check edited rows (within-list duplicates); roster duplicates are re-checked on save.
      const target = next.find((p) => p.key === key)!;
      const others = next
        .filter((p) => p.key !== key && p.include)
        .map((p) => ({ jersey: p.jersey, name: p.name }));
      const [rebuilt] = buildRosterPreview([{ ...target, confidence: 1 }], others);
      return next.map((p) =>
        p.key === key ? { ...p, ...rebuilt!, key, include: rebuilt!.status === "ready" } : p,
      );
    });

  return (
    <div className="flex flex-col gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-black text-foreground">
        <Users className="h-4 w-4 text-grape" /> {counts.total} player
        {counts.total === 1 ? "" : "s"} found{teamName ? ` for ${teamName}` : ""}
      </span>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="success">{counts.ready} ready</Pill>
        {counts.review ? <Pill tone="danger">{counts.review} need review</Pill> : null}
        {counts.duplicate ? <Pill tone="muted">{counts.duplicate} already on roster</Pill> : null}
      </div>
      <ul className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
        {players.map((p) =>
          editing ? (
            <li
              key={p.key}
              className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/50 p-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.include}
                  disabled={p.status === "duplicate"}
                  onChange={(ev) => update(p.key, { include: ev.target.checked })}
                  aria-label="Include this player"
                  className="h-5 w-5 accent-[var(--color-flame)]"
                />
                <input
                  value={p.jersey}
                  inputMode="numeric"
                  onChange={(ev) => update(p.key, { jersey: ev.target.value })}
                  className={cn(fieldCls, "w-16")}
                  aria-label="Jersey"
                />
                <input
                  value={p.name}
                  onChange={(ev) => update(p.key, { name: ev.target.value })}
                  className={fieldCls}
                  aria-label="Name"
                />
                <input
                  value={p.position ?? ""}
                  placeholder="Pos"
                  onChange={(ev) => update(p.key, { position: ev.target.value || null })}
                  className={cn(fieldCls, "w-16")}
                  aria-label="Position"
                />
              </div>
              <Issues item={p} />
            </li>
          ) : (
            <li
              key={p.key}
              className={cn(
                "flex flex-col gap-0.5 rounded-xl border px-2.5 py-1.5",
                p.status === "ready"
                  ? "border-border/70 bg-background/40"
                  : "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-full border border-flame/60 bg-flame/15 px-1.5 text-xs font-black">
                  #{p.jersey || "?"}
                </span>
                <span className="min-w-0 truncate">{p.name || "Name?"}</span>
                {p.position ? (
                  <span className="text-xs text-muted-foreground">{p.position}</span>
                ) : null}
              </div>
              <Issues item={p} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/* ---------------- single edits ---------------- */

function SingleBody({ row }: { row: ActionRow }) {
  const p = row.payload;
  if (row.kind === "schedule_update") {
    const event = p["event"] as { title: string; starts_label: string };
    const patch = (p["patch"] ?? {}) as Record<string, unknown>;
    const after = (p["after"] ?? {}) as { starts_label?: string | null };
    const other = Object.entries(patch).filter(([k]) => k !== "starts_at" && k !== "ends_at");
    return (
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-grape" /> Update event
        </span>
        <p className="text-sm font-black text-foreground">{event.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="muted">{event.starts_label}</Pill>
          {after.starts_label ? (
            <>
              <span className="text-xs font-black text-muted-foreground">→</span>
              <Pill tone="flame">{after.starts_label}</Pill>
            </>
          ) : null}
        </div>
        {other.map(([k, v]) => (
          <Pill key={k} tone="neutral">
            {k.replace(/_/g, " ")}: {v === null || v === "" ? "cleared" : String(v)}
          </Pill>
        ))}
      </div>
    );
  }
  if (row.kind === "player_update") {
    const player = p["player"] as { jersey: string; name: string };
    const patch = (p["patch"] ?? {}) as Record<string, unknown>;
    return (
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-muted-foreground">
          <Users className="h-4 w-4 text-grape" /> Update player
        </span>
        <p className="text-sm font-black text-foreground">
          #{player.jersey} {player.name}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(patch).map(([k, v]) => (
            <Pill key={k} tone="flame">
              {k === "active"
                ? v
                  ? "Make active"
                  : "Make inactive"
                : `${k}: ${v === null || v === "" ? "cleared" : String(v)}`}
            </Pill>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-muted-foreground">
        <Users className="h-4 w-4 text-grape" /> Create team
      </span>
      <p className="text-sm font-black text-foreground">{String(p["name"] ?? "")}</p>
      <div className="flex flex-wrap gap-1.5">
        {p["season"] ? (
          <Pill tone="neutral">{String(p["season"])}</Pill>
        ) : (
          <Pill tone="muted">Current season</Pill>
        )}
        {p["level"] ? <Pill tone="neutral">{String(p["level"])}</Pill> : null}
      </div>
    </div>
  );
}
