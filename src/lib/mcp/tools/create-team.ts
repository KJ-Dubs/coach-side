import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";

export default defineTool({
  name: "create_team",
  title: "Create team",
  description:
    "Creates a new team in the coach's CoachSide program. This modifies CoachSide data. Season is a label like '2026-27' (defaults to the current season); level is optional, e.g. 'Varsity', 'JV', 'Sophomore'. Fails with DUPLICATE_TEAM if the coach already has a team with the same name and season. Only use when the coach clearly asks to create a team.",
  inputSchema: TOOL_INPUTS.create_team,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: (args, ctx) => runSharedTool("create_team", ctx, args),
});
