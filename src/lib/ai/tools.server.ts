/**
 * Tools the CoachSide AI model may call. Reads go through the shared
 * executor; writes only STAGE a preview the coach must confirm in the app.
 * There is no raw SQL or direct mutation available to the model.
 */
import { tool } from "ai";
import { z } from "zod";
import { executeTool, TOOL_INPUTS } from "@/lib/mcp/executor";
import { CoachSideError, getRoster, requireCoachTeam, type Db } from "@/lib/mcp/service";
import { parseEventDateTime, safeTimeZone, toLocalLabel } from "@/lib/mcp/time";
import { stageAction, existingEventsFor } from "./actions.server";
import { buildEventPreview, buildRosterPreview, previewCounts } from "./preview";
import { AI_LIMITS } from "./limits";

type Ctx = { db: Db; userId: string; conversationId: string };

async function guard<T>(
  fn: () => Promise<T>,
): Promise<T | { error: { code: string; message: string } }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof CoachSideError) {
      const message = e.code === "COACH_ONLY" ? "Only coach accounts can do this." : e.message;
      return { error: { code: e.code, message } };
    }
    if (e instanceof z.ZodError)
      return { error: { code: "INVALID_INPUT", message: "Some details were missing or invalid." } };
    console.error("[ai] tool failed", e instanceof Error ? e.message : e);
    return { error: { code: "SERVER_ERROR", message: "CoachSide could not complete this step." } };
  }
}

const AWAITING = "awaiting_coach_confirmation" as const;

const extractedEvent = z.object({
  event_type: z.enum(["game", "practice", "event"]),
  title: z
    .string()
    .max(120)
    .nullable()
    .describe("e.g. 'vs Mission Viejo' or 'Practice'. Null to auto-title."),
  date: z.string().max(20).nullable().describe("YYYY-MM-DD, or null if unreadable."),
  starts_at: z
    .string()
    .max(20)
    .nullable()
    .describe("Local start time HH:mm (24h), or null if unknown."),
  ends_at: z.string().max(20).nullable().describe("Local end time HH:mm, or null."),
  opponent: z.string().max(80).nullable().describe("Opponent exactly as written, for games."),
  location: z.string().max(160).nullable().describe("Location exactly as written."),
  notes: z.string().max(500).nullable(),
  confidence: z.number().min(0).max(1).describe("How sure you are this row was read correctly."),
});

const extractedPlayer = z.object({
  jersey: z.string().max(6).nullable().describe("Jersey number digits, or null if unreadable."),
  name: z.string().max(80).nullable(),
  position: z.string().max(20).nullable().describe("Only if clearly printed."),
  confidence: z.number().min(0).max(1),
});

export function buildAssistantTools({ db, userId, conversationId }: Ctx) {
  return {
    list_teams: tool({
      description:
        "List the coach's CoachSide teams (id, name, season, level, timezone). Read-only.",
      inputSchema: z.object(TOOL_INPUTS.list_teams),
      execute: () => guard(async () => (await executeTool("list_teams", db, userId, {})).data),
    }),
    get_roster: tool({
      description: "Get a team's roster (player id, jersey, name, position, active). Read-only.",
      inputSchema: z.object(TOOL_INPUTS.get_roster),
      execute: (args) =>
        guard(async () => (await executeTool("get_roster", db, userId, args)).data),
    }),
    list_schedule: tool({
      description:
        "List a team's games, practices and events between start_date and end_date (YYYY-MM-DD, inclusive, team timezone). Defaults to today + 60 days. Read-only.",
      inputSchema: z.object(TOOL_INPUTS.list_schedule),
      execute: (args) =>
        guard(async () => {
          const data = (await executeTool("list_schedule", db, userId, args)).data as {
            events: unknown[];
          };
          return { ...data, events: data.events.slice(0, 60), truncated: data.events.length > 60 };
        }),
    }),
    propose_schedule_events: tool({
      description: `Stage one or more new schedule events (from text or an uploaded schedule) for the coach to review and confirm. Saves nothing by itself. Max ${AI_LIMITS.maxExtractedEvents} events.`,
      inputSchema: z.object({
        team_id: z.string().describe("Team id."),
        source: z.enum(["text", "image", "file"]),
        events: z.array(extractedEvent).min(1).max(AI_LIMITS.maxExtractedEvents),
      }),
      execute: ({ team_id, source, events }) =>
        guard(async () => {
          const { team } = await requireCoachTeam(db, team_id);
          const tz = safeTimeZone(team.timezone);
          const items = buildEventPreview(
            events,
            await existingEventsFor(
              db,
              team.id,
              events.map((e) => e.date),
            ),
          );
          const counts = previewCounts(items);
          const action_id = await stageAction(
            db,
            userId,
            conversationId,
            team.id,
            "schedule_create",
            {
              team: { id: team.id, name: team.name, timezone: tz },
              source,
              items,
            },
          );
          return {
            action_id,
            status: AWAITING,
            team: team.name,
            counts,
            summary: `Preview of ${counts.total} event(s) for ${team.name}: ${counts.ready} ready, ${counts.review} need review, ${counts.duplicate} already on the schedule.`,
          };
        }),
    }),
    propose_schedule_update: tool({
      description:
        "Stage an edit to one existing event (e.g. move Friday practice to 5 PM) for the coach to confirm. Call list_schedule first for event_id. starts_at/ends_at are full local 'YYYY-MM-DDTHH:mm'. Saves nothing by itself.",
      inputSchema: z.object({
        team_id: z.string(),
        event_id: z.string(),
        patch: TOOL_INPUTS.update_schedule_event.patch,
      }),
      execute: ({ team_id, event_id, patch }) =>
        guard(async () => {
          const { team } = await requireCoachTeam(db, team_id);
          const tz = safeTimeZone(team.timezone);
          const { data: ev } = await db
            .from("team_events")
            .select("id,title,event_type,starts_at,location,source")
            .eq("id", event_id)
            .eq("team_id", team.id)
            .maybeSingle();
          const event = ev as {
            id: string;
            title: string;
            event_type: string;
            starts_at: string;
            location: string | null;
            source: string;
          } | null;
          if (!event)
            throw new CoachSideError(
              "EVENT_NOT_FOUND",
              "That event isn't on this team's schedule. Call list_schedule first.",
            );
          if (event.source !== "coachside")
            throw new CoachSideError(
              "READ_ONLY_EVENT",
              "This event comes from a synced calendar and can only be changed there.",
            );
          let newStart: string | null = null;
          if (patch.starts_at) {
            const iso = parseEventDateTime(patch.starts_at, tz);
            if (!iso)
              throw new CoachSideError(
                "INVALID_DATE",
                `"${patch.starts_at}" isn't a valid date-time. Use YYYY-MM-DDTHH:mm.`,
              );
            newStart = toLocalLabel(iso, tz);
          }
          const before = {
            id: event.id,
            title: event.title,
            event_type: event.event_type,
            starts_label: toLocalLabel(event.starts_at, tz),
            location: event.location,
          };
          const action_id = await stageAction(
            db,
            userId,
            conversationId,
            team.id,
            "schedule_update",
            {
              team: { id: team.id, name: team.name, timezone: tz },
              event: before,
              patch,
              after: { starts_label: newStart },
            },
          );
          return {
            action_id,
            status: AWAITING,
            summary: `Edit to "${event.title}" (${before.starts_label}) staged for review.`,
          };
        }),
    }),
    propose_players: tool({
      description: `Stage players to add to a roster (typed list or uploaded roster) for the coach to review. Duplicates are flagged automatically. Saves nothing by itself. Max ${AI_LIMITS.maxExtractedPlayers}.`,
      inputSchema: z.object({
        team_id: z.string(),
        source: z.enum(["text", "image", "file"]),
        players: z.array(extractedPlayer).min(1).max(AI_LIMITS.maxExtractedPlayers),
      }),
      execute: ({ team_id, source, players }) =>
        guard(async () => {
          const roster = await getRoster(db, team_id);
          const items = buildRosterPreview(players, roster.players);
          const counts = previewCounts(items);
          const action_id = await stageAction(
            db,
            userId,
            conversationId,
            roster.team.id,
            "roster_add",
            {
              team: roster.team,
              source,
              items,
            },
          );
          return {
            action_id,
            status: AWAITING,
            team: roster.team.name,
            counts,
            summary: `Preview of ${counts.total} player(s) for ${roster.team.name}: ${counts.ready} ready, ${counts.review} need review, ${counts.duplicate} duplicates.`,
          };
        }),
    }),
    propose_player_update: tool({
      description:
        "Stage an edit to one player (jersey, name, position, active) for the coach to confirm. Call get_roster first. Saves nothing by itself.",
      inputSchema: z.object({
        team_id: z.string(),
        player_id: z.string(),
        patch: TOOL_INPUTS.update_player.patch,
      }),
      execute: ({ team_id, player_id, patch }) =>
        guard(async () => {
          const roster = await getRoster(db, team_id, true);
          const player = roster.players.find((p) => p.id === player_id);
          if (!player)
            throw new CoachSideError(
              "PLAYER_NOT_FOUND",
              "That player isn't on this roster. Call get_roster first.",
            );
          const action_id = await stageAction(
            db,
            userId,
            conversationId,
            roster.team.id,
            "player_update",
            { team: roster.team, player, patch },
          );
          return {
            action_id,
            status: AWAITING,
            summary: `Edit to #${player.jersey} ${player.name} staged for review.`,
          };
        }),
    }),
    propose_team: tool({
      description:
        "Stage creating a new team in the coach's program for the coach to confirm. Only when the coach clearly asks to create a team. Saves nothing by itself.",
      inputSchema: z.object(TOOL_INPUTS.create_team),
      execute: ({ name, season, level }) =>
        guard(async () => {
          const action_id = await stageAction(db, userId, conversationId, null, "team_create", {
            name: name.trim(),
            season: season?.trim() || null,
            level: level?.trim() || null,
          });
          return { action_id, status: AWAITING, summary: `New team "${name}" staged for review.` };
        }),
    }),
  };
}
