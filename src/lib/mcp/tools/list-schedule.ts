import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";

export default defineTool({
  name: "list_schedule",
  title: "List schedule",
  description:
    "List a team's games, practices and events (the same schedule shown in the CoachSide Locker Room) between start_date and end_date (inclusive, YYYY-MM-DD in the team's timezone). Defaults to today through the next 60 days. Times come back as UTC plus local wall time in the team's timezone. Use event ids from here for update_schedule_event; events marked read_only came from a synced calendar. Read-only.",
  inputSchema: TOOL_INPUTS.list_schedule,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (args, ctx) => runSharedTool("list_schedule", ctx, args),
});
