/**
 * CoachSide Progress — achievement catalogue. Progress is measured on the
 * server from real rows (see my_achievement_metrics); this file only names them.
 */
export type AchievementCategory =
  | "Playmaker & Playbook"
  | "Team & Locker Room"
  | "Calendar & Events"
  | "Game & Stats"
  | "Drills & Practice"
  | "Product";

export type Achievement = {
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  metric: string;
  target: number;
  major?: boolean;
  /** Where the coach goes to earn it. */
  link: string;
};

const A = (
  key: string, name: string, description: string, category: AchievementCategory,
  metric: string, target: number, link: string, major = false,
): Achievement => ({ key, name, description, category, metric, target, link, major });

const P: AchievementCategory = "Playmaker & Playbook";
const T: AchievementCategory = "Team & Locker Room";
const C: AchievementCategory = "Calendar & Events";
const G: AchievementCategory = "Game & Stats";
const D: AchievementCategory = "Drills & Practice";
const X: AchievementCategory = "Product";

export const ACHIEVEMENTS: Achievement[] = [
  A("plays_1", "Playmaker 1", "Create your first play.", P, "plays_created", 1, "/plays/new"),
  A("plays_5", "Playmaker 5", "You've created 5 plays in CoachSide.", P, "plays_created", 5, "/plays/new", true),
  A("plays_15", "Playmaker 15", "Create 15 plays.", P, "plays_created", 15, "/plays/new", true),
  A("publish_1", "Published", "Publish a play to the Library.", P, "plays_published", 1, "/plays"),
  A("publish_5", "Published 5", "Publish 5 plays.", P, "plays_published", 5, "/plays", true),
  A("publish_15", "Published 15", "Publish 15 plays.", P, "plays_published", 15, "/plays", true),
  A("share_play", "Sharer", "Copy a share link for a play from its ••• menu.", P, "play_shared", 1, "/plays"),
  A("export_play", "Highlight Reel", "Download a play as an MP4 video.", P, "play_exported", 1, "/plays"),
  A("library_1", "Library Scout", "Add a Library play to your Playbook.", P, "library_saved", 1, "/plays?tab=library"),
  A("library_5", "Library Scout 5", "Add 5 Library plays.", P, "library_saved", 5, "/plays?tab=library"),
  A("library_15", "Library Scout 15", "Add 15 Library plays.", P, "library_saved", 15, "/plays?tab=library", true),
  A("heart_1", "Fan", "Heart a Library play.", P, "hearts", 1, "/library"),
  A("follow_1", "Film Room", "Discover and follow a coach in the CoachSide Library.", P, "follows", 1, "/plays?tab=library&content=coaches"),

  A("team_1", "Program Builder", "Create a team.", T, "teams", 1, "/roster"),
  A("roster_1", "First Signing", "Add your first player.", T, "max_roster", 1, "/roster"),
  A("roster_5", "Starting Five", "Add 5 players.", T, "max_roster", 5, "/roster"),
  A("roster_10", "Full Bench", "Fill a roster with 10+ players.", T, "max_roster", 10, "/roster", true),
  A("qr_join", "Locker Room Open", "Have a player join with your team QR code or invite link.", T, "qr_joins", 1, "/lockerroom", true),
  A("announce_1", "Team Communicator", "Send or pin a coach message in Team Chat.", T, "announcements", 1, "/lockerroom?area=chat"),
  A("assign_1", "Plan Setter", "Send a Plan or task to your players.", T, "assignments", 1, "/lockerroom?area=plans"),
  A("parent_link", "Family Connected", "Copy your read-only parent link.", T, "parent_link_shared", 1, "/locker"),

  A("gcal", "Calendar Synced", "Connect Google Calendar in Locker Room Schedule.", C, "calendar_connected", 1, "/lockerroom?area=schedule"),
  A("event_1", "Scheduler", "Add an event to your team Schedule.", C, "events", 1, "/lockerroom?area=schedule"),
  A("event_5", "Scheduler 5", "Add 5 events to your team Schedule.", C, "events", 5, "/lockerroom?area=schedule"),

  A("game_1", "Tip-Off", "Track your first game.", G, "games", 1, "/games/new", true),
  A("game_5", "Tracker 5", "Track 5 games.", G, "games", 5, "/games/new"),
  A("game_15", "Tracker 15", "Track 15 games.", G, "games", 15, "/games/new", true),
  A("export_stats", "Scouting Report", "Download a PDF Game Report.", G, "stats_exported", 1, "/games"),
  A("season", "Season Grind", "Track 10 games for one team.", G, "max_team_games", 10, "/games/new", true),
  A("board_game", "Timeout Artist", "Open the Timeout Board from the Live Game screen.", G, "board_in_game", 1, "/games/new"),
  A("shot_1", "Shot Charter", "Record your first shot location.", G, "shot_locations", 1, "/games/new"),
  A("shot_100", "Shot Chart 100", "Reach 100 tracked shot events.", G, "shot_locations", 100, "/games/new", true),

  A("drill_1", "Drill Designer", "Create your first drill.", D, "drills_created", 1, "/drills/new"),
  A("drill_5", "Drill Designer 5", "Create 5 drills.", D, "drills_created", 5, "/drills/new"),
  A("drill_publish", "Drill Publisher", "Publish a drill.", D, "drills_published", 1, "/drills"),
  A("drill_saved", "Drill Collector", "Add a Drill Library drill.", D, "drills_saved", 1, "/drills"),
  A("practice_1", "Practice Planner", "Create your first practice plan.", D, "practice_plans", 1, "/practice"),
  A("practice_5", "Practice Planner 5", "Create 5 practice plans.", D, "practice_plans", 5, "/practice"),
  A("practice_share", "Posted Practice", "Share a practice plan to the Locker Room.", D, "practice_shared", 1, "/practice"),

  A("pwa", "Courtside Ready", "Install CoachSide on your device.", X, "pwa_installed", 1, "/dashboard"),
  A("push", "Always Informed", "Enable push notifications.", X, "push_enabled", 1, "/dashboard"),
  A("potd_5", "Daily Student", "Open Play of the Day on 5 different days.", X, "potd_views", 5, "/dashboard"),
  A("profile", "Coach Profile", "Complete your profile and public coach handle.", X, "profile_complete", 1, "/profile"),
];

/**
 * Metric -> the visible action that writes it. Every metric here is returned
 * by my_achievement_metrics and has a current UI flow. Keep in sync.
 */
export const METRIC_SOURCES: Record<string, string> = {
  plays_created: "Original plays you created (Playmaker)",
  plays_published: "Your plays published to the Library",
  library_saved: "Activity: library_play_added_to_playbook (Add to My Playbook)",
  play_shared: "Activity: play_shared (••• Share / Copy Link) + your plays with a share link on",
  play_exported: "Activity: play_exported_video (Download MP4 of a play; drills excluded)",
  hearts: "Hearts you gave Library plays",
  follows: "Coaches you follow (Library > Coaches or /coach/:username)",
  teams: "Teams you coach",
  max_roster: "Largest roster among your teams",
  qr_joins: "Players who joined your teams (QR/invite)",
  announcements: "Your Team Chat messages/pins in coached teams + legacy announcements",
  assignments: "Plans sent from Locker Room > Plans",
  parent_link_shared: "Activity: parent_link_shared (Copy parent link)",
  calendar_connected: "Google Calendar connections",
  events: "Schedule events you created",
  games: "Games across your teams",
  max_team_games: "Most games tracked for one team",
  stats_exported: "Activity: stats_exported (Game Report PDF download)",
  board_in_game: "Activity: board_used_in_game (Timeout Board from Live Game)",
  shot_locations: "Located game events across your teams",
  drills_created: "Original drills you created",
  drills_published: "Your drills published to the Drill Library",
  drills_saved: "Drill Library copies you saved",
  practice_plans: "Practice plans you created",
  practice_shared: "Practice plans shared to the Locker Room",
  pwa_installed: "Activity: pwa_installed (install prompt or opening the installed app)",
  push_enabled: "Active push subscriptions",
  potd_views: "Activity: potd_viewed (once per day from Play of the Day)",
  profile_complete: "Profile with name and public handle",
};

export const CATEGORIES: AchievementCategory[] = [P, T, C, G, D, X];

/** Achievements that define an "activated" coach for KPI purposes. */
export const ACTIVATION_KEYS = ["team_1", "roster_5", "plays_1", "library_1", "game_1"];
