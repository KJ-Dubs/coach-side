import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";

export default defineTool({
  name: "create_schedule_event",
  title: "Create schedule event",
  description:
    "Adds a game, practice or other event to a team's CoachSide schedule (it appears in the Locker Room Schedule right away, and team members are notified the same way as when a coach adds it in the app). This modifies CoachSide data. Give times as local wall time 'YYYY-MM-DDTHH:mm' in the team's timezone (from list_teams), or ISO 8601 with an offset. Resolve relative dates like 'Thursday' to a concrete date first. Fails with DUPLICATE_EVENT if the same event already exists at that time.",
  inputSchema: TOOL_INPUTS.create_schedule_event,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) => runSharedTool("create_schedule_event", ctx, args),
});
