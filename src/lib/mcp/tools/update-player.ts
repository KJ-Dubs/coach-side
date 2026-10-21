import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";
import { updatePlayer } from "../service";

export default defineTool({
  name: "update_player",
  title: "Update player",
  description:
    "Edits one player's jersey, name, position or active flag on a team. This modifies CoachSide data. Get player_id from get_roster first. Setting active=false hides the player from the active roster without deleting stats. Fails with DUPLICATE_JERSEY if the new jersey is taken.",
  inputSchema: {
    team_id: z.string().describe("Team id from list_teams."),
    player_id: z.string().describe("Player id from get_roster."),
    patch: z
      .object({
        jersey: z.string().min(1).max(4).optional(),
        name: z.string().min(1).max(80).optional(),
        position: z.string().max(20).nullable().optional().describe("Empty or null clears it."),
        active: z.boolean().optional(),
      })
      .describe("Only the fields to change."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: ({ team_id, player_id, patch }, ctx) =>
    runTool("update_player", ctx, async (db) => {
      const data = await updatePlayer(db, team_id, player_id, patch);
      return { summary: `Updated #${data.player.jersey} ${data.player.name}: ${data.changed.join(", ")}.`, data };
    }),
});
