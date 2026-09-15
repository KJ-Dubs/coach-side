import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  ClipboardPenLine,
  MessagesSquare,
  Target,
  UsersRound,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { BubbleButton, InfoList, InfoPanel, Panel, Pill, SectionHeader } from "@/components/Bubbles";
import { DemoPlay } from "@/components/marketing/DemoPlay";
import { InstallAppPill } from "@/components/InstallApp";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";
import mark from "@/assets/coachside-mark.jpg.asset.json";
import shotChart from "@/assets/snapshot-shot-chart.jpg.asset.json";
import teamStats from "@/assets/snapshot-team-stats.jpg.asset.json";
import leaders from "@/assets/snapshot-leaders.jpg.asset.json";

function SignUpButton({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <Link to="/auth" search={{ mode: "signup" }}>
      <BubbleButton size={size} tone="flame" className="min-h-12">
        Create Coach Account
      </BubbleButton>
    </Link>
  );
}

function SignInButton({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <Link to="/auth" search={{ mode: "signin" }}>
      <BubbleButton size={size} tone="grape" className="min-h-12">
        Sign In
      </BubbleButton>
    </Link>
  );
}

function SectionTitle({ children, tone = "grape" }: { children: string; tone?: "grape" | "flame" }) {
  return (
    <h2
      className={
        "text-center text-2xl font-black leading-tight text-foreground sm:text-3xl " +
        (tone === "flame" ? "border-flame/60 bg-flame/20" : "border-grape/60 bg-grape/20")
      }
    >
      {children}
    </h2>
  );
}

function Body({ children }: { children: string }) {
  return (
    <p className="w-full rounded-2xl border border-border/60 bg-surface-2/70 px-4 py-3 text-left text-sm font-semibold leading-relaxed text-muted-foreground sm:text-base">
      {children}
    </p>
  );
}

const FEATURES: { title: string; body: string; icon: LucideIcon; tone: "flame" | "grape" }[] = [
  {
    title: "Live stats from the court",
    body: "Tap the spot, tap the player, tap the stat. Substitutions, undo and free throws never leave the court screen.",
    icon: Target,
    tone: "flame",
  },
  {
    title: "Season stats & reports",
    body: "Team and player totals, splits, leaders, game history, shot charts and shareable PDF reports.",
    icon: BarChart3,
    tone: "grape",
  },
  {
    title: "Animated play designer",
    body: "Frame-by-frame cuts, curls, screens, passes, dribbles and handoffs for offense, defense and presses.",
    icon: ClipboardPenLine,
    tone: "grape",
  },
  {
    title: "Locker Room for players",
    body: "Announcements, team chat, assignments, assigned plays, schedule and resources behind a player login.",
    icon: MessagesSquare,
    tone: "flame",
  },
  {
    title: "Schedule & Google Calendar",
    body: "Build the team schedule or connect a coach Google Calendar; games and practices flow into the Locker Room.",
    icon: CalendarDays,
    tone: "grape",
  },
  {
    title: "Family view, read-only",
    body: "One public link gives parents team and player stats plus the calendar. No account, no playbook, no chat.",
    icon: Users,
    tone: "flame",
  },
  {
    title: "Multiple teams, one program",
    body: "Varsity, JV and frosh rosters live under one coach account with plays shared across teams.",
    icon: UsersRound,
    tone: "grape",
  },
  {
    title: "Built for gym wifi",
    body: "Live events are stored on the device first and sync when the connection comes back.",
    icon: WifiOff,
    tone: "flame",
  },
];

function Shot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <Panel className="flex flex-col gap-2">
      <Pill tone="grape">{caption}</Pill>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-2xl border border-border/70 object-cover"
      />
    </Panel>
  );
}

export function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-3 py-2.5">
          <span className="inline-flex items-center rounded-2xl border border-grape/50 bg-grape/15 px-3 py-1.5">
            <img src={wordmark.url} alt="CoachSide" className="h-8 w-auto sm:h-9" />
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SignInButton size="sm" />
            <SignUpButton size="sm" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4">
        <Panel className="flex flex-col gap-4 border-2 border-grape/60 bg-grape/10 p-4 sm:p-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
            <Pill tone="flame">Plan. Track. Coach.</Pill>
            <h1 className="text-3xl font-black leading-tight text-foreground sm:text-5xl">
              The basketball coaching operating system
            </h1>
            <Body>
              CoachSide runs your season from one place: live stats from the court, season reporting,
              an animated play designer, a team Locker Room, the schedule and a read-only view for
              families.
            </Body>
            <div className="flex flex-wrap justify-center gap-2">
              <SignUpButton />
              <SignInButton />
              <Link to="/library">
                <BubbleButton size="lg" tone="neutral" className="min-h-12">
                  Browse the Play Library
                </BubbleButton>
              </Link>
            </div>
            <InstallAppPill />
            <InfoList items={["Live stat tracking", "Play designer", "Locker Room", "Family stats link"]} className="max-w-xl" />
          </div>
          <Panel className="w-full flex-1 bg-surface/80">
            <Pill tone="grape">Play Maker</Pill>
            <DemoPlay className="mt-2" />
          </Panel>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <div className="flex justify-center"><SectionTitle>One system for the season</SectionTitle></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={
                    "flex flex-col gap-2 rounded-3xl border border-l-4 p-3 " +
                    (f.tone === "flame"
                      ? "border-flame/70 bg-flame/10"
                      : "border-grape/70 bg-grape/10")
                  }
                >
                  <span
                    aria-hidden
                    className={
                      "inline-flex h-10 w-10 items-center justify-center rounded-2xl border " +
                      (f.tone === "flame"
                        ? "border-flame/60 bg-flame/20 text-flame"
                        : "border-grape/60 bg-grape/20 text-grape-bright")
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-center text-base font-black leading-tight text-foreground">
                    {f.title}
                  </span>
                  <Body>{f.body}</Body>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3 border-2 border-flame/50 bg-flame/5">
          <SectionTitle tone="flame">Run the game from the court</SectionTitle>
          <Body>
            The court stays on screen the whole game. Tap where it happened, tap the player, tap the
            stat — rebounds, assists, fouls and free throws come back as quick bubbles on the same
            court.
          </Body>
           <InfoList items={[
              "Tap the shot location",
              "Tap the player",
              "Tap MADE or MISS",
              "Follow-up bubble, then next play",
             ]} tone="flame" />
           <InfoPanel>Substitutions stay on the same screen. Undo, recent events, overtime, automatic final saving, and offline-friendly sync remain close at hand.</InfoPanel>
        </Panel>

        <Panel className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
            <SectionTitle>Teach the play, not just the picture</SectionTitle>
            <Body>
              Draw cuts, curls, screens, passes, bumpy dribbles and handoffs, sequence them, then play
              the whole thing back frame by frame. Offense, defense and full-court press concepts with
              both teams on the floor.
            </Body>
            <InfoList items={["Offense, BLOB, and SLOB", "Defense, Press Break, and Presses", "Half-court zoom", "Shareable play links"]} />
          </div>
          <Panel className="w-full flex-1 bg-surface/80">
            <Pill tone="flame">Animated playback</Pill>
            <DemoPlay className="mt-2" />
          </Panel>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <SectionTitle>See CoachSide in action</SectionTitle>
          <Body>
            Real screens from the app: team season stats, statistical leaders and the colour-coded shot
            chart built from tapped court locations.
          </Body>
          <div className="grid gap-3 lg:grid-cols-3">
            <Shot src={teamStats.url} alt="CoachSide team season stats screen" caption="Team stats" />
            <Shot src={leaders.url} alt="CoachSide statistical leaders screen" caption="Leaders" />
            <Shot src={shotChart.url} alt="CoachSide shot chart screen" caption="Shot chart" />
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3 border-2 border-grape/50 bg-grape/5">
          <SectionTitle>Locker Room, calendar and family access</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-3xl border border-grape/70 bg-grape/10 p-3">
              <Pill tone="grape">Players</Pill>
              <Body>
                Players scan one QR code at practice, create an account and land in the Locker Room:
                announcements, chat, assignments, assigned plays and the schedule.
              </Body>
            </div>
            <div className="flex flex-col gap-2 rounded-3xl border border-flame/70 bg-flame/10 p-3">
              <Pill tone="flame">Calendar</Pill>
              <Body>
                Build games and practices in CoachSide or connect a coach Google Calendar; the schedule
                flows straight into the Locker Room and a subscribable feed.
              </Body>
            </div>
            <div className="flex flex-col gap-2 rounded-3xl border border-border bg-surface-2/70 p-3">
              <Pill tone="neutral">Families</Pill>
              <Body>
                Parents open one read-only link for team and player stats and the calendar. No account,
                and no access to the playbook or team chat.
              </Body>
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col items-center gap-3 border-2 border-flame/60 bg-flame/10 p-5 text-center">
          <SectionTitle tone="flame">Start coaching from one place</SectionTitle>
          <Body>Create your coach account, add a roster and run your next game from the court.</Body>
          <div className="flex flex-wrap justify-center gap-2">
            <SignUpButton />
            <SignInButton />
          </div>
        </Panel>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-3 pb-6">
        <span className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 px-3 py-2">
          <img src={mark.url} alt="" aria-hidden className="h-6 w-6 rounded-lg object-cover" />
          <span className="text-sm font-bold text-foreground">CoachSide</span>
        </span>
        <Pill tone="muted">coachside.live</Pill>
        <Pill tone="muted">Basketball coaching platform</Pill>
      </footer>
    </div>
  );
}
