import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";
import { EVENT_TYPES, HOME_AWAY, updateScheduleEvent } from "../service";

export default defineTool({
  name: "update_schedule_event",
  title: "Update schedule event",
  description:
    "Edits one event on a team's CoachSide schedule, e.g. 'Move Friday's practice to 5 PM'. This modifies CoachSide data and team members are notified of time changes as in the app. Find event_id with list_schedule first; if several events match, ask the coach which one. When only starts_at changes, the end time and arrival time move with it so the length stays the same. status 'cancelled' cancels without deleting. Events imported from a synced calendar are read-only (READ_ONLY_EVENT).",
  inputSchema: {
    team_id: z.string().describe("Team id from list_teams."),
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
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (args, ctx) =>
    runTool("update_schedule_event", ctx, async (db) => {
      const data = await updateScheduleEvent(db, args);
      return { summary: `Updated "${data.event.title}" (${data.changed.join(", ")}); now ${data.event.starts_label}.`, data };
    }),
});
