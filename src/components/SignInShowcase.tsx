import { Label, Panel, Pill } from "@/components/Bubbles";
import shotChart from "@/assets/snapshot-shot-chart.jpg.asset.json";
import teamStats from "@/assets/snapshot-team-stats.jpg.asset.json";
import leaders from "@/assets/snapshot-leaders.jpg.asset.json";

const FEATURES: { title: string; body: string; tone: "grape" | "flame" | "neutral" }[] = [
  {
    title: "Persistent-court live stats",
    body: "Tap the spot, tap the player, tap the stat. The court never leaves the screen.",
    tone: "grape",
  },
  {
    title: "Full court ⇄ half court",
    body: "One court, two views. Zoom into the half court or open the full floor for press action.",
    tone: "flame",
  },
  {
    title: "On-court overlays",
    body: "Assists, rebounds, fouls and free throws are follow-up bubbles right on the court.",
    tone: "neutral",
  },
  {
    title: "Substitutions & undo",
    body: "Tap a player out, tap one in. The active five follows every event after it.",
    tone: "neutral",
  },
  {
    title: "Shot charts & heat maps",
    body: "Green makes, red misses, blue rebounds — team-wide or one player at a time.",
    tone: "grape",
  },
  {
    title: "Team & player season stats",
    body: "W-L, points, FG% / 3PT% / FT%, rim finishing, rebounds, assists and leaders.",
    tone: "flame",
  },
  {
    title: "Play maker & press maker",
    body: "Two-team diagrams with cuts, curls, bumpy dribbles, screens and press setups.",
    tone: "neutral",
  },
  {
    title: "Game history & PDF reports",
    body: "Every saved game feeds history and shareable team and player PDF reports.",
    tone: "grape",
  },
  {
    title: "Works on bad gym wifi",
    body: "Events are stored on the device and sync as soon as signal returns.",
    tone: "neutral",
  },
];

const SNAPSHOTS = [
  { src: teamStats.url, caption: "Team season dashboard" },
  { src: leaders.url, caption: "Season leaders & results" },
  { src: shotChart.url, caption: "Colour-coded shot chart" },
];

export function SignInShowcase() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      <Panel className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Label>What you get</Label>
          <Pill tone="grape">Basketball only</Pill>
          <Pill tone="flame">iPad ready</Pill>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={
                "rounded-2xl border p-3 " +
                (f.tone === "grape"
                  ? "border-grape/50 bg-grape/12"
                  : f.tone === "flame"
                    ? "border-flame/50 bg-flame/10"
                    : "border-border/70 bg-surface-2/70")
              }
            >
              <div className="inline-flex rounded-full bg-background/60 px-3 py-1 text-sm font-black text-foreground">
                {f.title}
              </div>
              <p className="mt-2 rounded-2xl bg-background/40 px-3 py-2 text-xs font-semibold leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="flex flex-col gap-3 p-4">
        <Label>Snapshots from the app</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {SNAPSHOTS.map((s) => (
            <figure
              key={s.caption}
              className="flex flex-col gap-2 rounded-3xl border border-border/70 bg-surface-2/60 p-2"
            >
              <img
                src={s.src}
                alt={s.caption}
                loading="lazy"
                className="w-full rounded-2xl border border-border/60 object-cover"
              />
              <figcaption className="inline-flex justify-center rounded-full bg-background/60 px-3 py-1 text-[11px] font-bold text-muted-foreground">
                {s.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </Panel>
    </div>
  );
}
