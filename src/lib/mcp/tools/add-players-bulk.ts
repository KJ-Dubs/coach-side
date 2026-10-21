import { defineTool } from "@lovable.dev/mcp-js";
import { runSharedTool } from "../run";
import { TOOL_INPUTS } from "../executor";
import { MAX_BULK_PLAYERS } from "../service";

export default defineTool({
  name: "add_players_bulk",
  title: "Add players (bulk)",
  description: `Adds up to ${MAX_BULK_PLAYERS} players to a team's CoachSide roster in one call, e.g. from "4 John Smith, 12 Marcus Lee". This modifies CoachSide data. Every row is validated: valid rows are created, and invalid rows or jerseys already in use come back in 'rejected' with a code (INVALID_INPUT, DUPLICATE_JERSEY) so you can tell the coach exactly what was skipped.`,
  inputSchema: TOOL_INPUTS.add_players_bulk,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) => runSharedTool("add_players_bulk", ctx, args),
});
