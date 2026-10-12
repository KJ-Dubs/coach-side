import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BubbleButton, Label, Panel } from "@/components/Bubbles";
import { useMyProgress } from "@/components/ProgressCard";
import { useQuery } from "@tanstack/react-query";
import { COACHSIDE_TIPS } from "@/lib/tips";
import { fetchOnboarding, pickNextAction } from "@/lib/onboarding";

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
  const ob = useQuery({ queryKey: ["onboarding"], queryFn: fetchOnboarding });
  const [standalone, setStandalone] = useState(false);
  useEffect(() => { setStandalone(window.matchMedia?.("(display-mode: standalone)").matches ?? false); }, []);
  const next = progress.data
    ? pickNextAction(progress.data.metrics, ob.data?.interests ?? [], { installed: standalone })
    : null;
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
