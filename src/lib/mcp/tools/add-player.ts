import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";

export default defineTool({
  name: "add_player",
  title: "Add player",
  description:
    "Adds one player to a team's CoachSide roster. This modifies CoachSide data. Jersey is 1–3 digits; fails with DUPLICATE_JERSEY if an active player already wears it. For several players at once use add_players_bulk.",
  inputSchema: TOOL_INPUTS.add_player,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) => runSharedTool("add_player", ctx, args),
});
