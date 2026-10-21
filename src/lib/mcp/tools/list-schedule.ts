import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";
import { EVENT_TYPES, listSchedule } from "../service";

export default defineTool({
  name: "list_schedule",
  title: "List schedule",
  description:
    "List a team's games, practices and events (the same schedule shown in the CoachSide Locker Room) between start_date and end_date (inclusive, YYYY-MM-DD in the team's timezone). Defaults to today through the next 60 days. Times come back as UTC plus local wall time in the team's timezone. Use event ids from here for update_schedule_event; events marked read_only came from a synced calendar. Read-only.",
  inputSchema: {
    team_id: z.string().describe("Team id from list_teams."),
    start_date: z.string().max(40).optional().describe("First day, YYYY-MM-DD. Default today."),
    end_date: z.string().max(40).optional().describe("Last day (inclusive), YYYY-MM-DD. Default 60 days after start."),
    event_type: z.enum(EVENT_TYPES).optional().describe("Only return game, practice or event."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (args, ctx) =>
    runTool("list_schedule", ctx, async (db) => {
      const data = await listSchedule(db, args);
      return { summary: `${data.team.name}: ${data.events.length} event(s) (${data.team.timezone}).`, data };
    }),
});
