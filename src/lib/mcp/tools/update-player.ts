import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";

export default defineTool({
  name: "update_player",
  title: "Update player",
  description:
    "Edits one player's jersey, name, position or active flag on a team. This modifies CoachSide data. Get player_id from get_roster first. Setting active=false hides the player from the active roster without deleting stats. Fails with DUPLICATE_JERSEY if the new jersey is taken.",
  inputSchema: TOOL_INPUTS.update_player,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (args, ctx) => runSharedTool("update_player", ctx, args),
});
