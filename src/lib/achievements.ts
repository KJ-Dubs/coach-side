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
  A("share_play", "Sharer", "Share a play.", P, "play_shared", 1, "/plays"),
  A("export_play", "Highlight Reel", "Export or download a play.", P, "play_exported", 1, "/plays"),
  A("library_1", "Library Scout", "Add a Library play to your Playbook.", P, "library_saved", 1, "/plays?tab=library"),
  A("library_5", "Library Scout 5", "Add 5 Library plays.", P, "library_saved", 5, "/plays?tab=library"),
  A("library_15", "Library Scout 15", "Add 15 Library plays.", P, "library_saved", 15, "/plays?tab=library", true),
  A("heart_1", "Fan", "Heart a Library play.", P, "hearts", 1, "/plays?tab=library"),
  A("follow_1", "Film Room", "Follow a coach.", P, "follows", 1, "/plays?tab=library"),

  A("team_1", "Program Builder", "Create a team.", T, "teams", 1, "/roster"),
  A("roster_1", "First Signing", "Add your first player.", T, "max_roster", 1, "/roster"),
  A("roster_5", "Starting Five", "Add 5 players.", T, "max_roster", 5, "/roster"),
  A("roster_10", "Full Bench", "Fill a roster with 10+ players.", T, "max_roster", 10, "/roster", true),
  A("qr_join", "Locker Room Open", "Have a player join by QR.", T, "qr_joins", 1, "/dashboard", true),
  A("announce_1", "Announcer", "Post an announcement.", T, "announcements", 1, "/lockerroom"),
  A("assign_1", "Homework", "Create an assignment.", T, "assignments", 1, "/lockerroom"),
  A("parent_link", "Family Connected", "Share your parent link.", T, "parent_link_shared", 1, "/locker"),

  A("gcal", "Calendar Synced", "Connect Google Calendar.", C, "calendar_connected", 1, "/settings"),
  A("event_1", "Scheduler", "Create an event.", C, "events", 1, "/calendar"),
  A("event_5", "Scheduler 5", "Create 5 events.", C, "events", 5, "/calendar"),

  A("game_1", "Tip-Off", "Track your first game.", G, "games", 1, "/games/new", true),
  A("game_5", "Tracker 5", "Track 5 games.", G, "games", 5, "/games/new"),
  A("game_15", "Tracker 15", "Track 15 games.", G, "games", 15, "/games/new", true),
  A("export_stats", "Scouting Report", "Export stats.", G, "stats_exported", 1, "/stats"),
  A("season", "Season Complete", "Finish a season.", G, "season_completed", 1, "/stats", true),
  A("board_game", "Timeout Artist", "Use the Coach's Board during a game.", G, "board_in_game", 1, "/board"),
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
  A("potd_5", "Daily Student", "View Play of the Day 5 times.", X, "potd_views", 5, "/dashboard"),
  A("profile", "Coach Profile", "Complete your profile and public coach handle.", X, "profile_complete", 1, "/profile"),
];

export const CATEGORIES: AchievementCategory[] = [P, T, C, G, D, X];

/** Achievements that define an "activated" coach for KPI purposes. */
export const ACTIVATION_KEYS = ["team_1", "roster_5", "plays_1", "library_1", "game_1"];
