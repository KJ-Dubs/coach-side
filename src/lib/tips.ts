/**
 * CoachSide Tips — the single place to add or edit tips. Used by the brief
 * loading interstitial and the persistent Home tip card.
 */
export type TipDestination = "dashboard" | "playmaker" | "drillmaker" | "playbook";

export type CoachTip = { text: string; link?: string; cta?: string };

export const COACHSIDE_TIPS: CoachTip[] = [
  { text: "Make your own plays and add them directly to your team's Playbook.", link: "/plays/new", cta: "Open Playmaker" },
  { text: "Connect Google Calendar from Locker Room > Schedule so games and practices stay in sync.", link: "/lockerroom?area=schedule", cta: "Open Schedule" },
  { text: "Use the Coach's Board during a timeout to sketch an adjustment in seconds.", link: "/board", cta: "Open Coach's Board" },
  { text: "Save plays from the CoachSide Library directly to your Playbook.", link: "/library", cta: "Browse the Library" },
  { text: "Publish a play to the Library so other coaches can discover it.", link: "/plays", cta: "Open My Playbook" },
  { text: "Export a play as an MP4 from its view screen and tag CoachSide.live when you post it.", link: "/plays", cta: "Open My Playbook" },
  { text: "Track shot locations in Live Game to build automatic shot charts.", link: "/games/new", cta: "Start Live Game" },
  { text: "Build a practice plan using drills, plays, conditioning, film, and more.", link: "/practice", cta: "Plan a practice" },
  { text: "Create drills with multiple balls, cones, defenders, and animated steps.", link: "/drills/new", cta: "Open Drill Maker" },
  { text: "Players can scan your team QR code to join the Locker Room." },
  { text: "Share your parent link for read-only stats and schedule access.", link: "/locker", cta: "Get parent link" },
  { text: "Follow coaches straight from the ••• menu on any Library play.", link: "/library", cta: "Find coaches" },
  { text: "Open Play of the Day on Home to discover something new before practice." },
  { text: "Team Stats can be filtered by player, team, game, and season.", link: "/stats", cta: "Open Team Stats" },
  { text: "Send a Plan in the Locker Room so players know exactly what to work on.", link: "/lockerroom?area=plans", cta: "Open Plans" },
  { text: "Install CoachSide on your phone or tablet for faster courtside access.", link: "/help", cta: "How to install" },
  { text: "Flip a play to attack the other basket without redrawing it." },
  { text: "Play Types say what a play is; Folders say when your team uses it. A play can live in many folders.", link: "/plays", cta: "Organize Playbook" },
  { text: "Pin important coach messages in Team Chat so players see them first.", link: "/lockerroom?area=chat", cta: "Open Team Chat" },
  { text: "Check your CoachSide Progress on Home to find features you haven't tried.", link: "/achievements", cta: "See Progress" },
];

export const TIP_MIN_MS = 4500;
export const TIP_SKIP_AFTER_MS = 1200;
export const TIP_MAX_MS = 7000;
export const TIP_FADE_MS = 300;
