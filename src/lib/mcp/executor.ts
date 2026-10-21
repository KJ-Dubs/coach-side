/**
 * Shared CoachSide tool executor. Both the external MCP connector and the
 * native CoachSide AI Assistant call these permission-checked actions, so
 * there is one implementation of every team/roster/schedule rule.
 *
 * Callers pass a database client acting as the signed-in coach (RLS applies)
 * plus the verified user id; nothing here trusts a caller-supplied user id.
 */
import { z } from "zod";
import type { McpToolName } from "./permissions";
import {
  addPlayer,
  addPlayersBulk,
  createScheduleEvent,
  createTeam,
  EVENT_TYPES,
  getRoster,
  HOME_AWAY,
  listSchedule,
  listTeams,
  updatePlayer,
  updateScheduleEvent,
  type Db,
} from "./service";

const teamId = z.string().describe("Team id from list_teams.");

/** Input shapes (raw zod shapes) for every CoachSide tool. */
export const TOOL_INPUTS = {
  list_teams: {},
  get_roster: {
    team_id: teamId,
    include_inactive: z.boolean().optional().describe("Also return inactive players. Default false."),
  },
  list_schedule: {
    team_id: teamId,
    start_date: z.string().max(40).optional().describe("First day, YYYY-MM-DD. Default today."),
    end_date: z.string().max(40).optional().describe("Last day (inclusive), YYYY-MM-DD. Default 60 days after start."),
    event_type: z.enum(EVENT_TYPES).optional().describe("Only return game, practice or event."),
  },
  create_team: {
    name: z.string().min(1).max(80).describe("Team name, e.g. 'East High JV'."),
    season: z.string().max(20).optional().describe("Season label, e.g. '2026-27'."),
    level: z.string().max(40).optional().describe("Level, e.g. 'JV'."),
  },
  add_player: {
    team_id: teamId,
    jersey: z.string().min(1).max(4).describe("Jersey number, e.g. '24'."),
    name: z.string().min(1).max(80).describe("Player name."),
    position: z.string().max(20).optional().describe("Position, e.g. 'G', 'F', 'C'."),
  },
  add_players_bulk: {
    team_id: teamId,
    players: z
      .array(
        z.object({
          jersey: z.string().min(1).max(4),
          name: z.string().min(1).max(80),
          position: z.string().max(20).optional(),
        }),
      )
      .min(1)
      .max(50)
      .describe("Players to add, e.g. [{jersey:'4', name:'John Smith'}]."),
  },
  update_player: {
    team_id: teamId,
    player_id: z.string().describe("Player id from get_roster."),
    patch: z
      .object({
        jersey: z.string().min(1).max(4).optional(),
        name: z.string().min(1).max(80).optional(),
        position: z.string().max(20).nullable().optional().describe("Empty or null clears it."),
        active: z.boolean().optional(),
      })
      .describe("Only the fields to change."),
  },
  create_schedule_event: {
    team_id: teamId,
    event_type: z.enum(EVENT_TYPES).describe("game, practice or event."),
    title: z.string().min(1).max(120).describe("e.g. 'Practice' or 'vs Mission Viejo'."),
    starts_at: z.string().max(40).describe("Start, e.g. '2026-10-23T16:30'."),
    ends_at: z.string().max(40).optional().describe("Optional end, same format."),
    opponent: z.string().max(80).optional().describe("Opponent for games."),
    home_away: z.enum(HOME_AWAY).optional().describe("For games."),
    location: z.string().max(160).optional(),
    notes: z.string().max(2000).optional(),
    arrival_minutes_before: z.number().int().min(0).max(240).optional().describe("Player arrival time, minutes before start."),
  },
  update_schedule_event: {
    team_id: teamId,
    event_id: z.string().describe("Event id from list_schedule."),
    patch: z
      .object({
        title: z.string().min(1).max(120).optional(),
        event_type: z.enum(EVENT_TYPES).optional(),
        starts_at: z.string().max(40).optional().describe("'YYYY-MM-DDTHH:mm' in the team's timezone, or ISO with offset."),
        ends_at: z.string().max(40).nullable().optional(),
        opponent: z.string().max(80).nullable().optional(),
        home_away: z.enum(HOME_AWAY).nullable().optional(),
        location: z.string().max(160).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        arrival_minutes_before: z.number().int().min(0).max(240).nullable().optional(),
        status: z.enum(["scheduled", "cancelled"]).optional(),
      })
      .describe("Only the fields to change."),
  },
} as const satisfies Record<McpToolName, z.ZodRawShape>;

export type ToolArgs<N extends McpToolName> = z.infer<z.ZodObject<(typeof TOOL_INPUTS)[N]>>;

export type ToolOutcome = { summary: string; data: Record<string, unknown> };

/** Runs one CoachSide action as the signed-in coach. Throws CoachSideError on rule failures. */
export async function executeTool<N extends McpToolName>(
  name: N,
  db: Db,
  userId: string,
  rawArgs: unknown,
): Promise<ToolOutcome> {
  const args = z.object(TOOL_INPUTS[name]).parse(rawArgs ?? {}) as Record<string, never>;
  switch (name) {
    case "list_teams": {
      const data = await listTeams(db);
      return { summary: data.teams.length ? `${data.teams.length} team(s).` : "No coached teams yet.", data };
    }
    case "get_roster": {
      const a = args as ToolArgs<"get_roster">;
      const data = await getRoster(db, a.team_id, a.include_inactive ?? false);
      return { summary: `${data.team.name}: ${data.players.length} player(s).`, data };
    }
    case "list_schedule": {
      const data = await listSchedule(db, args as ToolArgs<"list_schedule">);
      return { summary: `${data.team.name}: ${data.events.length} event(s) (${data.team.timezone}).`, data };
    }
    case "create_team": {
      const data = await createTeam(db, userId, args as ToolArgs<"create_team">);
      return { summary: `Created ${data.team.name} (${data.team.season}).`, data };
    }
    case "add_player": {
      const { team_id, ...player } = args as ToolArgs<"add_player">;
      const data = await addPlayer(db, team_id, player);
      return { summary: `Added #${data.player.jersey} ${data.player.name}.`, data };
    }
    case "add_players_bulk": {
      const a = args as ToolArgs<"add_players_bulk">;
      const data = await addPlayersBulk(db, a.team_id, a.players);
      return {
        summary: `Added ${data.created.length} player(s) to ${data.team.name}${data.rejected.length ? `; ${data.rejected.length} skipped` : ""}.`,
        data,
      };
    }
    case "update_player": {
      const a = args as ToolArgs<"update_player">;
      const data = await updatePlayer(db, a.team_id, a.player_id, a.patch);
      return { summary: `Updated #${data.player.jersey} ${data.player.name}: ${data.changed.join(", ")}.`, data };
    }
    case "create_schedule_event": {
      const data = await createScheduleEvent(db, userId, args as ToolArgs<"create_schedule_event">);
      return { summary: `Added ${data.event.event_type} "${data.event.title}" on ${data.event.starts_label}.`, data };
    }
    case "update_schedule_event": {
      const data = await updateScheduleEvent(db, args as ToolArgs<"update_schedule_event">);
      return { summary: `Updated "${data.event.title}" (${data.changed.join(", ")}); now ${data.event.starts_label}.`, data };
    }
    default:
      throw new Error(`Unknown CoachSide tool ${String(name)}`);
  }
}
