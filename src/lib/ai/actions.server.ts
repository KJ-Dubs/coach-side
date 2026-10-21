/**
 * Staging and executing coach-confirmed AI actions. The model only ever
 * stages a preview; this module runs the change after the coach confirms,
 * rebuilding the preview from fresh data and the coach's edits and calling
 * the shared permission-checked CoachSide executor. Server-only.
 */
import { z } from "zod";
import { executeTool } from "@/lib/mcp/executor";
import {
  CoachSideError,
  listSchedule,
  requireCoachTeam,
  getRoster,
  type Db,
} from "@/lib/mcp/service";
import {
  buildEventPreview,
  buildRosterPreview,
  dateLabel,
  normalizeDate,
  to12h,
  type EventPreviewItem,
  type ExistingEvent,
  type ExtractedEvent,
  type PlayerPreviewItem,
} from "./preview";
import type { AiActionKind, AiActionStatus } from "./limits";

export type ActionRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  kind: AiActionKind;
  payload: Record<string, unknown>;
  status: AiActionStatus;
  result: Record<string, unknown> | null;
};

export async function stageAction(
  db: Db,
  userId: string,
  conversationId: string | null,
  teamId: string | null,
  kind: AiActionKind,
  payload: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await db
    .from("ai_pending_actions")
    .insert({ user_id: userId, conversation_id: conversationId, team_id: teamId, kind, payload })
    .select("id")
    .single();
  if (error || !data)
    throw new CoachSideError("SERVER_ERROR", "Could not prepare this change for review.");
  return (data as { id: string }).id;
}

/** Existing events covering the preview's date range (for duplicate/conflict flags). */
export async function existingEventsFor(
  db: Db,
  teamId: string,
  dates: (string | null)[],
): Promise<ExistingEvent[]> {
  const sorted = dates
    .map((d) => normalizeDate(d))
    .filter((d): d is string => !!d)
    .sort();
  if (!sorted.length) return [];
  try {
    const res = await listSchedule(db, {
      team_id: teamId,
      start_date: sorted[0]!,
      end_date: sorted[sorted.length - 1]!,
    });
    return res.events.map((e) => ({
      event_type: e.event_type,
      title: e.title,
      starts_local: e.starts_local,
      status: e.status,
    }));
  } catch {
    return [];
  }
}

const eventEdit = z.object({
  key: z.string().max(20),
  include: z.boolean(),
  event_type: z.enum(["game", "practice", "event"]),
  title: z.string().max(120),
  date: z.string().max(20).nullable(),
  start_time: z.string().max(20).nullable(),
  end_time: z.string().max(20).nullable(),
  opponent: z.string().max(80).nullable(),
  location: z.string().max(160).nullable(),
  notes: z.string().max(2000).nullable(),
  confidence: z.number().min(0).max(1),
});
const playerEdit = z.object({
  key: z.string().max(20),
  include: z.boolean(),
  jersey: z.string().max(6),
  name: z.string().max(80),
  position: z.string().max(20).nullable(),
  confidence: z.number().min(0).max(1),
});
export const confirmInput = z.object({
  actionId: z.string().uuid(),
  decision: z.enum(["confirm", "cancel"]),
  events: z.array(eventEdit).max(60).optional(),
  players: z.array(playerEdit).max(60).optional(),
});
export type ConfirmInput = z.infer<typeof confirmInput>;

type Failure = { label: string; message: string };
export type ActionResult = { summary: string; created: number; failed: Failure[] };

const errMessage = (e: unknown) =>
  e instanceof CoachSideError
    ? e.message
    : e instanceof z.ZodError
      ? "Some details were invalid."
      : "CoachSide could not save this.";

async function runSchedule(
  db: Db,
  userId: string,
  row: ActionRow,
  edits: ConfirmInput["events"],
): Promise<ActionResult> {
  const team = row.payload["team"] as { id: string; name: string };
  const original = (row.payload["items"] ?? []) as EventPreviewItem[];
  const source = (edits ?? original).slice(0, original.length);
  const include = new Map(source.map((e) => [e.key, e.include]));
  const raw: ExtractedEvent[] = source.map((e) => ({
    event_type: e.event_type,
    title: e.title,
    date: e.date,
    starts_at: e.start_time,
    ends_at: e.end_time,
    opponent: e.opponent,
    location: e.location,
    notes: e.notes,
    confidence: e.confidence,
  }));
  await requireCoachTeam(db, team.id);
  const rebuilt = buildEventPreview(
    raw,
    await existingEventsFor(
      db,
      team.id,
      raw.map((r) => r.date),
    ),
  );
  let created = 0;
  const failed: Failure[] = [];
  for (let i = 0; i < rebuilt.length; i++) {
    const it = rebuilt[i]!;
    if (!include.get(source[i]!.key)) continue;
    const label = `${it.title} · ${dateLabel(it.date)} ${to12h(it.start_time)}`;
    if (it.status !== "ready") {
      failed.push({ label, message: it.issues[0] ?? "Needs review" });
      continue;
    }
    try {
      await executeTool("create_schedule_event", db, userId, {
        team_id: team.id,
        event_type: it.event_type,
        title: it.title,
        starts_at: `${it.date}T${it.start_time}`,
        ...(it.end_time ? { ends_at: `${it.date}T${it.end_time}` } : {}),
        ...(it.opponent ? { opponent: it.opponent } : {}),
        ...(it.location ? { location: it.location } : {}),
        ...(it.notes ? { notes: it.notes } : {}),
      });
      created++;
    } catch (e) {
      failed.push({ label, message: errMessage(e) });
    }
  }
  return {
    summary: `${created} event${created === 1 ? "" : "s"} added to ${team.name}`,
    created,
    failed,
  };
}

async function runRoster(
  db: Db,
  userId: string,
  row: ActionRow,
  edits: ConfirmInput["players"],
): Promise<ActionResult> {
  const team = row.payload["team"] as { id: string; name: string };
  const original = (row.payload["items"] ?? []) as PlayerPreviewItem[];
  const source = (edits ?? original).slice(0, original.length);
  const roster = await getRoster(db, team.id);
  const rebuilt = buildRosterPreview(
    source.map((p) => ({
      jersey: p.jersey,
      name: p.name,
      position: p.position,
      confidence: p.confidence,
    })),
    roster.players,
  );
  const failed: Failure[] = [];
  const ready: { jersey: string; name: string; position?: string }[] = [];
  rebuilt.forEach((p, i) => {
    if (!source[i]!.include) return;
    if (p.status !== "ready")
      failed.push({
        label: `#${p.jersey} ${p.name}`.trim(),
        message: p.issues[0] ?? "Needs review",
      });
    else
      ready.push({
        jersey: p.jersey,
        name: p.name,
        ...(p.position ? { position: p.position } : {}),
      });
  });
  let created = 0;
  if (ready.length) {
    const out = await executeTool("add_players_bulk", db, userId, {
      team_id: team.id,
      players: ready,
    });
    const data = out.data as {
      created: unknown[];
      rejected: { jersey: string; name: string; message: string }[];
    };
    created = data.created.length;
    for (const r of data.rejected)
      failed.push({ label: `#${r.jersey} ${r.name}`, message: r.message });
  }
  return {
    summary: `${created} player${created === 1 ? "" : "s"} added to ${team.name}`,
    created,
    failed,
  };
}

async function runSingle(db: Db, userId: string, row: ActionRow): Promise<ActionResult> {
  const p = row.payload;
  if (row.kind === "schedule_update") {
    const team = p["team"] as { id: string; name: string };
    const event = p["event"] as { id: string; title: string };
    const out = await executeTool("update_schedule_event", db, userId, {
      team_id: team.id,
      event_id: event.id,
      patch: p["patch"],
    });
    return { summary: out.summary, created: 1, failed: [] };
  }
  if (row.kind === "player_update") {
    const team = p["team"] as { id: string };
    const player = p["player"] as { id: string };
    const out = await executeTool("update_player", db, userId, {
      team_id: team.id,
      player_id: player.id,
      patch: p["patch"],
    });
    return { summary: out.summary, created: 1, failed: [] };
  }
  const out = await executeTool("create_team", db, userId, {
    name: p["name"],
    season: p["season"] ?? undefined,
    level: p["level"] ?? undefined,
  });
  return { summary: out.summary, created: 1, failed: [] };
}

/** Confirm or cancel a staged action exactly once. */
export async function resolveAction(
  db: Db,
  userId: string,
  input: ConfirmInput,
): Promise<{ status: AiActionStatus; result: ActionResult | null }> {
  const { data, error } = await db
    .from("ai_pending_actions")
    .select("id,user_id,team_id,kind,payload,status,result")
    .eq("id", input.actionId)
    .maybeSingle();
  if (error) throw new Error("Could not load this change.");
  const row = data as ActionRow | null;
  if (!row || row.user_id !== userId) throw new Error("This change was not found.");
  if (row.status !== "pending")
    return { status: row.status, result: row.result as ActionResult | null };

  // Claim it first so a double tap can never run it twice.
  const claim = await db
    .from("ai_pending_actions")
    .update({
      status: input.decision === "cancel" ? "cancelled" : "confirmed",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  if (claim.error || !claim.data?.length) return { status: "confirmed", result: null };
  if (input.decision === "cancel") return { status: "cancelled", result: null };

  let result: ActionResult;
  try {
    if (row.kind === "schedule_create") result = await runSchedule(db, userId, row, input.events);
    else if (row.kind === "roster_add") result = await runRoster(db, userId, row, input.players);
    else result = await runSingle(db, userId, row);
  } catch (e) {
    result = {
      summary: "Nothing was saved",
      created: 0,
      failed: [{ label: "Change", message: errMessage(e) }],
    };
  }
  const status: AiActionStatus =
    result.created === 0 ? "failed" : result.failed.length ? "partial" : "confirmed";
  await db.from("ai_pending_actions").update({ status, result }).eq("id", row.id);
  return { status, result };
}
