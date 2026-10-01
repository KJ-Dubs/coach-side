import { createFileRoute } from "@tanstack/react-router";
import { Lock, Medal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { useMyProgress } from "@/components/ProgressCard";
import { ACHIEVEMENTS, CATEGORIES, METRIC_SOURCES } from "@/lib/achievements";
import { useIsAppAdmin } from "@/lib/useIsAppAdmin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "CoachSide Progress — Achievements" },
      { name: "description", content: "Track the CoachSide features you've mastered and discover what to try next." },
      { property: "og:title", content: "CoachSide Progress — Achievements" },
      { property: "og:description", content: "Coach milestones across plays, teams, games, drills and practice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const q = useMyProgress();
  const data = q.data;
  const { isAdmin } = useIsAppAdmin();
  return (
    <AppShell title="CoachSide Progress" subtitle="Achievements from what you actually do in CoachSide" backTo="/dashboard" backLabel="Home">
      {!data ? (
        <EmptyState>{q.isError ? "Could not load progress" : "Loading your progress…"}</EmptyState>
      ) : (
        <>
          <Panel className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <Pill tone="grape">
              {data.unlockedCount} / {data.total} unlocked
            </Pill>
          </Panel>
          {CATEGORIES.map((cat) => (
            <Panel key={cat} className="mb-3 flex flex-col gap-3">
              <Label>{cat}</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => {
                  const p = data.items.find((i) => i.key === a.key)!;
                  const pct = Math.min(100, Math.round((p.value / a.target) * 100));
                  return (
                    <a
                      key={a.key}
                      href={a.link}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                        p.unlocked ? "border-flame/60 bg-flame/10" : "border-border bg-surface-2/60 hover:border-grape/60",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                          p.unlocked ? "border-flame bg-flame/25 text-flame" : "border-border bg-surface text-muted-foreground",
                        )}
                      >
                        {p.unlocked ? <Medal className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm font-black text-foreground">{a.name}</span>
                        <Note>{a.description}</Note>
                        {isAdmin ? (
                          <Pill tone="muted" className="max-w-full whitespace-normal text-left text-[10px]">
                            QA · {a.metric} = {p.value} · {METRIC_SOURCES[a.metric] ?? "NO SOURCE"}
                          </Pill>
                        ) : null}
                        {a.target > 1 && !p.unlocked ? (
                          <span className="flex items-center gap-2">
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                              <span className="block h-full bg-grape" style={{ width: `${pct}%` }} />
                            </span>
                            <Pill tone="muted">
                              {Math.min(p.value, a.target)}/{a.target}
                            </Pill>
                          </span>
                        ) : null}
                      </span>
                    </a>
                  );
                })}
              </div>
            </Panel>
          ))}
        </>
      )}
    </AppShell>
  );
}
