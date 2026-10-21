import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";

export default defineTool({
  name: "list_teams",
  title: "List teams",
  description:
    "List the CoachSide teams the connected coach coaches (id, name, season, level, role, timezone). Call this first to resolve a team name like 'East High' to its team_id before any roster or schedule tool. Read-only.",
  inputSchema: TOOL_INPUTS.list_teams,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (args, ctx) => runSharedTool("list_teams", ctx, args),
});
