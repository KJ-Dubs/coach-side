import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";
import { addPlayer } from "../service";

export default defineTool({
  name: "add_player",
  title: "Add player",
  description:
    "Adds one player to a team's CoachSide roster. This modifies CoachSide data. Jersey is 1–3 digits; fails with DUPLICATE_JERSEY if an active player already wears it. For several players at once use add_players_bulk.",
  inputSchema: {
    team_id: z.string().describe("Team id from list_teams."),
    jersey: z.string().min(1).max(4).describe("Jersey number, e.g. '24'."),
    name: z.string().min(1).max(80).describe("Player name."),
    position: z.string().max(20).optional().describe("Position, e.g. 'G', 'F', 'C'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: ({ team_id, ...player }, ctx) =>
    runTool("add_player", ctx, async (db) => {
      const data = await addPlayer(db, team_id, player);
      return { summary: `Added #${data.player.jersey} ${data.player.name}.`, data };
    }),
});
