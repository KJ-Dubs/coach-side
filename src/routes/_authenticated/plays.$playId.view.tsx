import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Panel, Pill } from "@/components/Bubbles";
import { PlayPresenter } from "@/components/court/PlayPresenter";
import { fetchFrames, fetchPlay, fetchPlayAssignments, fetchPlays } from "@/lib/data";
import { normalizeCategory } from "@/lib/types";
import { useAccess } from "@/lib/access";

const searchSchema = z.object({
  category: z.string().optional(),
  team: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/plays/$playId/view")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Present Play — CoachSide" },
      {
        name: "description",
        content: "Present a basketball play with animated sequences, playback speed and step controls.",
      },
      { property: "og:title", content: "Present Play — CoachSide" },
      { property: "og:description", content: "Animated play presentation." },
    ],
  }),
  component: PlayViewPage,
});

export function PlaySlideshow({ playId }: { playId: string }) {
  const play = useQuery({ queryKey: ["play", playId], queryFn: () => fetchPlay(playId) });
  const frames = useQuery({ queryKey: ["frames", playId], queryFn: () => fetchFrames(playId) });

  return (
    <PlayPresenter
      play={play.data}
      frames={frames.data ?? []}
      loading={play.isLoading || frames.isLoading}
    />
  );
}

/**
 * Ordered list of plays for the context the coach came from, so Previous /
 * Next walk the same sequence the Playbook showed. Falls back to every
 * visible play (category, then name) when no context is supplied.
 */
function usePlaybookSequence(category: string | undefined, team: string | undefined) {
  const plays = useQuery({ queryKey: ["plays"], queryFn: fetchPlays });
  const assignments = useQuery({
    queryKey: ["play-assignments"],
    queryFn: fetchPlayAssignments,
    enabled: !!team,
  });

  return useMemo(() => {
    const list = plays.data ?? [];
    const teamsByPlay = new Map<string, string[]>();
    for (const p of list) teamsByPlay.set(p.id, p.team_id ? [p.team_id] : []);
    for (const a of assignments.data ?? []) {
      const ids = teamsByPlay.get(a.play_id) ?? [];
      if (!ids.includes(a.team_id)) ids.push(a.team_id);
      teamsByPlay.set(a.play_id, ids);
    }
    const filtered = list.filter((p) => {
      if (team && !(teamsByPlay.get(p.id) ?? []).includes(team)) return false;
      if (category && normalizeCategory(p.category) !== category) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (!category) {
        const c = normalizeCategory(a.category).localeCompare(normalizeCategory(b.category));
        if (c !== 0) return c;
      }
      return a.name.localeCompare(b.name);
    });
  }, [plays.data, assignments.data, category, team]);
}

function PlayViewPage() {
  const { playId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { access } = useAccess();
  const sequence = usePlaybookSequence(search.category, search.team);

  const index = sequence.findIndex((p) => p.id === playId);
  const prev = index > 0 ? sequence[index - 1] : undefined;
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : undefined;

  const goTo = (id: string) =>
    navigate({ to: "/plays/$playId/view", params: { playId: id }, search, replace: true });

  const backTo = access.isCoach ? "/plays" : "/lockerroom";

  return (
    <AppShell
      wide
      title="Play Slideshow"
      subtitle="Frame by frame"
      actions={
        <>
          <Link to={backTo} search={access.isCoach ? search : {}}>
            <BubbleButton size="sm" tone="ghost">
              ← Back to {access.isCoach ? "Playbook" : "Locker Room"}
            </BubbleButton>
          </Link>
          {access.isCoach ? (
            <Link to="/plays/$playId" params={{ playId }}>
              <BubbleButton size="sm" tone="grape">
                Edit Play
              </BubbleButton>
            </Link>
          ) : null}
        </>
      }
    >

      <div className="flex flex-col gap-2">
        {sequence.length > 1 ? (
          <Panel className="flex flex-wrap items-center gap-2">
            <BubbleButton
              tone="neutral"
              disabled={!prev}
              aria-label="Previous play"
              onClick={() => prev && goTo(prev.id)}
            >
              ◀ Previous Play
            </BubbleButton>
            <Pill tone="muted">
              {index >= 0 ? index + 1 : 1} of {sequence.length}
              {search.category ? ` · ${search.category}` : ""}
            </Pill>
            <BubbleButton
              tone="grape"
              className="ml-auto"
              disabled={!next}
              aria-label="Next play"
              onClick={() => next && goTo(next.id)}
            >
              Next Play ▶
            </BubbleButton>
          </Panel>
        ) : null}

        <PlaySlideshow key={playId} playId={playId} />

        <Panel className="flex flex-wrap items-center justify-center gap-2">
          <Link to="/plays" search={search}>
            <BubbleButton tone="ghost">✕ Exit to Playbook</BubbleButton>
          </Link>
        </Panel>
      </div>
    </AppShell>
  );
}
