import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";

export default defineTool({
  name: "update_schedule_event",
  title: "Update schedule event",
  description:
    "Edits one event on a team's CoachSide schedule, e.g. 'Move Friday's practice to 5 PM'. This modifies CoachSide data and team members are notified of time changes as in the app. Find event_id with list_schedule first; if several events match, ask the coach which one. When only starts_at changes, the end time and arrival time move with it so the length stays the same. status 'cancelled' cancels without deleting. Events imported from a synced calendar are read-only (READ_ONLY_EVENT).",
  inputSchema: TOOL_INPUTS.update_schedule_event,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (args, ctx) => runSharedTool("update_schedule_event", ctx, args),
});
