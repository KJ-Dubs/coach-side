import { defineTool } from "@lovable.dev/mcp-js";
import { runTool } from "../run";
import { listTeams } from "../service";

export default defineTool({
  name: "list_teams",
  title: "List teams",
  description:
    "List the CoachSide teams the connected coach coaches (id, name, season, level, role, timezone). Call this first to resolve a team name like 'East High' to its team_id before any roster or schedule tool. Read-only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_args, ctx) =>
    runTool("list_teams", ctx, async (db) => {
      const data = await listTeams(db);
      return {
        summary: data.teams.length ? `${data.teams.length} team(s).` : "No coached teams yet.",
        data,
      };
    }),
});
