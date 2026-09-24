export const SUPPORT_EMAIL = "support@coachside.live";

export type HelpSection = {
  id: string;
  title: string;
  what: string;
  when: string;
  useCases: string[];
  steps: string[];
  faq?: { q: string; a: string }[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-started", title: "Getting Started",
    what: "CoachSide puts your playbook, practice planning, game-day stats and team communication in one place.",
    when: "Your first 10 minutes: set up a team, draw one play, and invite players.",
    useCases: ["Set up your varsity team before the first practice.", "Try the Library first, then build your own playbook."],
    steps: ["Create your team from Home.", "Add players to your roster.", "Open Playmaker and draw your first play.", "Share the team QR code so players join the Locker Room."],
    faq: [{ q: "What's the Complete trial?", a: "Every new coach team gets 14 days of CoachSide Complete (Playbook+, GameDay+ and Team Hub+). After that, Free Core stays and nothing is deleted." }],
  },
  {
    id: "teams", title: "Teams & Players",
    what: "Manage multiple teams and rosters, and connect players and parents to each team.",
    when: "Preseason setup, adding a call-up, or running JV and varsity side by side.",
    useCases: ["Run JV and varsity from one account.", "Players scan the team QR code and claim their roster spot."],
    steps: ["Open Team Stats → Roster or Manage teams.", "Add players with jersey numbers.", "Show the player QR from Home."],
    faq: [{ q: "A player picked the wrong roster spot.", a: "Remove their membership from the team and have them rejoin with the QR code." }],
  },
  {
    id: "playmaker", title: "Playmaker",
    what: "Design animated plays step by step: passes, cuts, dribbles and screens.",
    when: "Installing a new set, preparing a scouting look, or teaching a special situation.",
    useCases: ["Install your BLOB before practice, animate it for players, then assign it to the team.", "Draw a late-game ATO and flip it to attack the other basket."],
    steps: ["Open Playmaker and place players.", "Tap a tool (Cut, Dribble, Pass, Screen) and drag on the court.", "Add a new sequence for the next action.", "Preview, then save to your Playbook."],
    faq: [{ q: "The pass went to the wrong player.", a: "Tap the pass and choose the correct receiver in the action inspector." }],
  },
  {
    id: "playbook", title: "Playbook & CoachSide Library",
    what: "Your team's plays plus a public Library of plays shared by other coaches.",
    when: "Game prep, film review, or looking for a new press break.",
    useCases: ["Save a Library zone offense to your Playbook in one tap.", "Publish your best inbound so other coaches can use it."],
    steps: ["Open Playbook.", "Switch between My Playbook and CoachSide Library.", "Tap Add to Playbook, or Present to run it for players."],
  },
  {
    id: "drills", title: "Drill Maker",
    what: "Animated drills with multiple balls, cones, defenders and steps.",
    when: "Designing a warm-up, shooting station or defensive breakdown.",
    useCases: ["Three-line layup drill with three balls moving at once.", "Shell drill with defenders rotating each step."],
    steps: ["Open Drill Maker.", "Place players and equipment.", "Drag a ball onto a player, then draw passes or dribbles.", "Add steps and preview."],
  },
  {
    id: "practice", title: "Practice Planner",
    what: "Timed practice plans built from drills, plays, conditioning and film.",
    when: "The night before practice or at lunch on game day.",
    useCases: ["Build a 90-minute practice from drills + plays in under two minutes.", "Share tomorrow's plan to the Locker Room so assistants are ready."],
    steps: ["Open Practice Planner and create a plan.", "Add blocks and set minutes.", "Reorder and share to the Locker Room."],
  },
  {
    id: "live-game", title: "Live Game",
    what: "Tap-the-court stat tracking that keeps the court visible the whole game.",
    when: "Every game, from the bench or scorer's table.",
    useCases: ["Have an assistant/stat-table volunteer tap the court during games to build shot locations and game history.", "Track subs so every stat carries the right five."],
    steps: ["Start Live Game and choose your starting five.", "Tap the location → player → stat.", "Add optional context (rebound, assist) or skip.", "Tap OUT then IN for substitutions."],
    faq: [{ q: "The gym Wi-Fi dropped.", a: "Stats save on your device and sync automatically when the connection returns." }],
  },
  {
    id: "team-stats", title: "Team Stats",
    what: "Game, player and team numbers plus shot charts from real locations.",
    when: "After games, weekly film sessions, and end-of-season awards.",
    useCases: ["Find your best shooting zones before playoffs.", "Export a stat report for your athletic director."],
    steps: ["Open Team Stats.", "Filter by team, game, player or season.", "Export a PDF report."],
  },
  {
    id: "board", title: "Coach's Board",
    what: "A fast whiteboard for timeouts: marker, arrows, screens, X/O and players.",
    when: "30-second timeouts and halftime adjustments.",
    useCases: ["Use the Coach's Board during a timeout to sketch an adjustment in seconds.", "Zoom to a half court to draw a zone attack."],
    steps: ["Open Coach's Board.", "Pick Full, Left Half or Right Half.", "Draw, then Clear for the next timeout."],
  },
  {
    id: "locker-room", title: "Locker Room",
    what: "Team chat, announcements, assignments and the schedule for players and staff.",
    when: "Daily team communication.",
    useCases: ["Post tomorrow's practice time, assign 500 layups, and share the play you want reviewed.", "Require acknowledgments on bus times."],
    steps: ["Open Locker Room.", "Post an announcement or assignment.", "Attach a play or practice plan."],
  },
  {
    id: "calendar", title: "Calendar / Google Calendar",
    what: "Your team schedule, optionally synced in from Google Calendar.",
    when: "When your school calendar already lives in Google.",
    useCases: ["Connect Google Calendar so practices and games stay visible to your team."],
    steps: ["Open Settings → Google Calendar.", "Connect and choose a calendar per team.", "Events sync in automatically."],
    faq: [{ q: "Can I edit imported events?", a: "Imported events are read-only in CoachSide; edit them in Google Calendar." }],
  },
  {
    id: "notifications", title: "Notifications",
    what: "In-app and push alerts for announcements, schedule changes, Play of the Day and tips.",
    when: "Turn on push on the phone you bring to practice.",
    useCases: ["Get a push when the bus time changes."],
    steps: ["Tap Enable push on Home.", "Choose categories in Settings → Notifications, including Onboarding tips."],
    faq: [{ q: "I'm not getting pushes on iPhone.", a: "Install CoachSide to your Home Screen first, then enable push from inside the app." }],
  },
  {
    id: "billing", title: "Membership & Billing",
    what: "Free Core plus team modules: Playbook+ $6, GameDay+ $6, Team Hub+ $6, or Complete $15/month.",
    when: "Near the end of your 14-day Complete trial.",
    useCases: ["Keep only GameDay+ for a stat-focused season.", "Pick Complete for $15 instead of $18."],
    steps: ["Open Membership.", "Pick modules for the team.", "One monthly charge per team."],
    faq: [{ q: "What happens if I downgrade?", a: "Your data is never deleted. Premium actions simply show an upgrade option." }],
  },
  {
    id: "sharing", title: "Sharing / MP4 / Social",
    what: "Share play links and export plays as MP4 in 9:16, 16:9 or 1:1.",
    when: "Posting a play to social or sending it to a player.",
    useCases: ["Export your plays as MP4s and tag CoachSide.live when you post them."],
    steps: ["Open a play and tap Present.", "Tap Export video and pick a format.", "Download and post."],
  },
  {
    id: "parents", title: "Parents",
    what: "A read-only parent link for stats and schedule — no account needed.",
    when: "Start of season.",
    useCases: ["Share your parent link for read-only stats and schedule access."],
    steps: ["From Home, tap Share link under Parents & families.", "Send the link to your parent group."],
  },
  {
    id: "troubleshooting", title: "Troubleshooting",
    what: "Quick fixes for common issues.",
    when: "Anything feels off.",
    useCases: ["The app looks outdated: pull to refresh or reopen the installed app."],
    steps: ["Refresh the page.", "Sign out and back in.", `Still stuck? Email ${SUPPORT_EMAIL}.`],
  },
];
