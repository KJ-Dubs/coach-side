import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";
import { createScheduleEvent, EVENT_TYPES, HOME_AWAY } from "../service";

export default defineTool({
  name: "create_schedule_event",
  title: "Create schedule event",
  description:
    "Adds a game, practice or other event to a team's CoachSide schedule (it appears in the Locker Room Schedule right away, and team members are notified the same way as when a coach adds it in the app). This modifies CoachSide data. Give times as local wall time 'YYYY-MM-DDTHH:mm' in the team's timezone (from list_teams), or ISO 8601 with an offset. Resolve relative dates like 'Thursday' to a concrete date first. Fails with DUPLICATE_EVENT if the same event already exists at that time.",
  inputSchema: {
    team_id: z.string().describe("Team id from list_teams."),
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
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) =>
    runTool("create_schedule_event", ctx, async (db, userId) => {
      const data = await createScheduleEvent(db, userId, args);
      return { summary: `Added ${data.event.event_type} "${data.event.title}" on ${data.event.starts_label}.`, data };
    }),
});
