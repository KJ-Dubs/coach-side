import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";
import { getRoster } from "../service";

export default defineTool({
  name: "get_roster",
  title: "Get roster",
  description:
    "Get a team's roster: player id, jersey, name, position and active flag, sorted by jersey. Active players only unless include_inactive is true. Use player ids from here for update_player. Read-only.",
  inputSchema: {
    team_id: z.string().describe("Team id from list_teams."),
    include_inactive: z.boolean().optional().describe("Also return inactive players. Default false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ team_id, include_inactive }, ctx) =>
    runTool("get_roster", ctx, async (db) => {
      const data = await getRoster(db, team_id, include_inactive ?? false);
      return { summary: `${data.team.name}: ${data.players.length} player(s).`, data };
    }),
});
