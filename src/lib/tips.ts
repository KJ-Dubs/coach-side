/**
 * CoachSide Tips — the single place to add or edit tips.
 * Shown briefly before a few coach destinations, once per destination per session.
 */
export type TipDestination = "dashboard" | "playmaker" | "drillmaker" | "playbook";

export const COACHSIDE_TIPS: string[] = [
  "Make your own plays and add them directly to your team's Playbook.",
  "Connect Google Calendar so practices and games stay visible to your team.",
  "Use the Coach's Board during a timeout to sketch an adjustment in seconds.",
  "Save plays from the CoachSide Library directly to your Playbook.",
  "Publish a play to the Library so other coaches can discover it.",
  "Export your plays as MP4s and tag CoachSide.live when you post them.",
  "Track shot locations in Live Game to build automatic shot charts.",
  "Build a practice plan using drills, plays, conditioning, film, and more.",
  "Create drills with multiple balls, cones, defenders, and animated steps.",
  "Players can scan your team QR code to join the Locker Room.",
  "Share your parent link for read-only stats and schedule access.",
  "Follow coaches in the Library to discover more of the basketball you like.",
  "Use Play of the Day to discover something new before practice.",
  "Team Stats can be filtered by player, team, game, and season.",
  "Add assignments in the Locker Room so players know exactly what to work on.",
  "Install CoachSide on your phone or tablet for faster courtside access.",
  "Flip a play to attack the other basket without redrawing it.",
  "Check your CoachSide Progress on Home to find features you haven't tried.",
];

export const TIP_MIN_MS = 1800;
export const TIP_SKIP_AFTER_MS = 1000;
