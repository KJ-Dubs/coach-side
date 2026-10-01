import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { BubbleButton, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { syncMyProgress } from "@/lib/retention.functions";
import { useAuth } from "@/lib/auth";
import { PROGRESS_EVENT } from "@/lib/activity";

export function useMyProgress() {
  const { user } = useAuth();
  const sync = useServerFn(syncMyProgress);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-progress", user?.id],
    queryFn: () => sync(),
    enabled: !!user,
    staleTime: 60_000,
  });
  useEffect(() => {
    const onChange = () => void qc.invalidateQueries({ queryKey: ["my-progress"] });
    window.addEventListener(PROGRESS_EVENT, onChange);
    return () => window.removeEventListener(PROGRESS_EVENT, onChange);
  }, [qc]);
  useEffect(() => {
    if (q.data?.newlyUnlocked.length) {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    // Play of the Day may have just been chosen for today.
    if (q.data) void qc.invalidateQueries({ queryKey: ["play-of-the-day"] });
  }, [q.data, qc]);
  return q;
}

export function ProgressCard() {
  const q = useMyProgress();
  if (!q.data) return null;
  const { unlockedCount, total, items } = q.data;
  const next = ACHIEVEMENTS.find((a) => !items.find((i) => i.key === a.key)?.unlocked);
  const pct = Math.round((unlockedCount / total) * 100);
  return (
    <Link to="/achievements" className="block">
      <Panel className="flex flex-col gap-2 transition-colors hover:border-grape/70">
        <div className="flex items-center justify-between gap-2">
          <Label>Your CoachSide Progress</Label>
          <Pill tone="grape">
            {unlockedCount} / {total} achievements
          </Pill>
        </div>
        <div className="h-3 overflow-hidden rounded-full border border-border bg-surface-2">
          <div className="h-full rounded-full bg-gradient-to-r from-grape to-flame" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {next ? <Note>Next: {next.description}</Note> : <Note>Every achievement unlocked.</Note>}
          <BubbleButton size="sm" tone="neutral" className="ml-auto">
            View all
          </BubbleButton>
        </div>
      </Panel>
    </Link>
  );
}

export function HelpCard() {
  return (
    <Panel className="flex flex-col items-center gap-3 px-4 py-4 text-center">
      <p className="text-sm font-semibold leading-relaxed text-muted-foreground sm:text-base">
        Need help maximizing your CoachSide account?
      </p>
      <Link to="/help">
        <BubbleButton tone="grape">
          CoachSide Help
        </BubbleButton>
      </Link>
    </Panel>
  );
}
