import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";
import { addPlayersBulk, MAX_BULK_PLAYERS } from "../service";

export default defineTool({
  name: "add_players_bulk",
  title: "Add players (bulk)",
  description: `Adds up to ${MAX_BULK_PLAYERS} players to a team's CoachSide roster in one call, e.g. from "4 John Smith, 12 Marcus Lee". This modifies CoachSide data. Every row is validated: valid rows are created, and invalid rows or jerseys already in use come back in 'rejected' with a code (INVALID_INPUT, DUPLICATE_JERSEY) so you can tell the coach exactly what was skipped.`,
  inputSchema: {
    team_id: z.string().describe("Team id from list_teams."),
    players: z
      .array(
        z.object({
          jersey: z.string().min(1).max(4).describe("Jersey number."),
          name: z.string().min(1).max(80).describe("Player name."),
          position: z.string().max(20).optional().describe("Position."),
        }),
      )
      .min(1)
      .max(MAX_BULK_PLAYERS)
      .describe(`1–${MAX_BULK_PLAYERS} players.`),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: ({ team_id, players }, ctx) =>
    runTool("add_players_bulk", ctx, async (db) => {
      const data = await addPlayersBulk(db, team_id, players);
      return {
        summary: `Added ${data.created.length} player(s) to ${data.team.name}; ${data.rejected.length} rejected.`,
        data,
      };
    }),
});
