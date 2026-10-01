import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BubbleButton, Label, Panel } from "@/components/Bubbles";
import { useMyProgress } from "@/components/ProgressCard";
import { COACHSIDE_TIPS } from "@/lib/tips";

type NextStep = { title: string; body: string; cta: string; link: string };

/** One next action, in priority order, from real progress metrics. */
function pickNextStep(m: Record<string, number>): NextStep | null {
  const v = (k: string) => m[k] ?? 0;
  if (v("teams") < 1) return { title: "Create your first team", body: "Teams unlock rosters, Live Game stats and the Locker Room.", cta: "Create a team", link: "/roster" };
  if (v("plays_created") < 1) return { title: "Build your first play", body: "Draw it once in Playmaker, then present, share or export it.", cta: "Open Playmaker", link: "/plays/new" };
  if (v("max_roster") < 5) return { title: "Add your players", body: "A roster of five or more gets you ready for Live Game.", cta: "Add players", link: "/roster" };
  if (v("library_saved") < 1) return { title: "Add a play from the CoachSide Library", body: "Borrow a proven set from another coach in one tap.", cta: "Browse the Library", link: "/library" };
  if (v("calendar_connected") < 1) return { title: "Connect your calendar", body: "Bring games and practices into your team Schedule.", cta: "Open Schedule", link: "/lockerroom?area=schedule" };
  if (v("games") < 1) return { title: "Try Live Game", body: "Tap the court, pick a player, pick a stat. That's it.", cta: "Start Live Game", link: "/games/new" };
  return null;
}

/** Persistent Home card: one calm tip (changes daily or on request) plus one next step. */
export function HomeTipCard() {
  const router = useRouter();
  const progress = useMyProgress();
  const [idx, setIdx] = useState<number | null>(null);
  useEffect(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    setIdx(day % COACHSIDE_TIPS.length);
  }, []);
  const tip = idx === null ? null : COACHSIDE_TIPS[idx];
  const next = progress.data ? pickNextStep(progress.data.metrics) : null;
  const go = (link: string) => router.history.push(link);

  return (
    <Panel className="flex flex-col items-center gap-3 px-4 py-4 text-center">
      {next ? (
        <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-flame/50 bg-flame/10 p-3">
          <Label>Try this next</Label>
          <p className="text-base font-black text-foreground">{next.title}</p>
          <p className="text-sm font-semibold text-muted-foreground">{next.body}</p>
          <BubbleButton tone="flame" onClick={() => go(next.link)}>{next.cta}</BubbleButton>
        </div>
      ) : null}
      <Label>CoachSide Tip</Label>
      <p className="max-w-xl text-sm font-semibold leading-relaxed text-foreground sm:text-base">{tip?.text ?? "\u00a0"}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {tip?.link && tip.cta ? (
          <BubbleButton size="sm" tone="grape" onClick={() => go(tip.link!)}>{tip.cta}</BubbleButton>
        ) : null}
        <BubbleButton size="sm" tone="ghost" onClick={() => setIdx((i) => ((i ?? 0) + 1) % COACHSIDE_TIPS.length)}>
          Next tip
        </BubbleButton>
      </div>
    </Panel>
  );
}
