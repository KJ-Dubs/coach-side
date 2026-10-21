import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";
import { createTeam } from "../service";

export default defineTool({
  name: "create_team",
  title: "Create team",
  description:
    "Creates a new team in the coach's CoachSide program. This modifies CoachSide data. Season is a label like '2026-27' (defaults to the current season); level is optional, e.g. 'Varsity', 'JV', 'Sophomore'. Fails with DUPLICATE_TEAM if the coach already has a team with the same name and season. Only use when the coach clearly asks to create a team.",
  inputSchema: {
    name: z.string().min(1).max(80).describe("Team name, e.g. 'East High JV'."),
    season: z.string().max(20).optional().describe("Season label, e.g. '2026-27'."),
    level: z.string().max(40).optional().describe("Level, e.g. 'JV'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) =>
    runTool("create_team", ctx, async (db, userId) => {
      const data = await createTeam(db, userId, args);
      return { summary: `Created ${data.team.name} (${data.team.season}).`, data };
    }),
});
