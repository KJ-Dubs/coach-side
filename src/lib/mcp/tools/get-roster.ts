import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";

export default defineTool({
  name: "get_roster",
  title: "Get roster",
  description:
    "Get a team's roster: player id, jersey, name, position and active flag, sorted by jersey. Active players only unless include_inactive is true. Use player ids from here for update_player. Read-only.",
  inputSchema: TOOL_INPUTS.get_roster,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (args, ctx) => runSharedTool("get_roster", ctx, args),
});
