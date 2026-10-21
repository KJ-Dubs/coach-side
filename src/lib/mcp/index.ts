import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTeams from "./tools/list-teams";
import getRoster from "./tools/get-roster";
import listSchedule from "./tools/list-schedule";
import createTeam from "./tools/create-team";
import addPlayer from "./tools/add-player";
import addPlayersBulk from "./tools/add-players-bulk";
import updatePlayer from "./tools/update-player";
import createScheduleEvent from "./tools/create-schedule-event";
import updateScheduleEvent from "./tools/update-schedule-event";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "courtside-coach",
  title: "CourtSide Coach",
  version: "1.0.0",
  instructions:
    "CoachSide basketball coaching tools acting as the signed-in coach. Phase 1 covers teams, rosters and team schedules. Always call list_teams first to turn a team name into a team_id, get_roster before editing a player, and list_schedule before editing an event. Write tools change real CoachSide data: confirm ambiguous requests with the coach instead of guessing, and report any error code (TEAM_NOT_FOUND, NO_ACCESS, DUPLICATE_JERSEY, INVALID_DATE, PERMISSION_NOT_GRANTED, ...) in plain language. Schedule times are local wall times in each team's timezone.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
    resourceName: "CoachSide",
    resourceDocumentation: "https://coachside.live/",
  }),
  tools: [
    listTeams,
    getRoster,
    listSchedule,
    createTeam,
    addPlayer,
    addPlayersBulk,
    updatePlayer,
    createScheduleEvent,
    updateScheduleEvent,
  ],
});
