import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BubbleButton, EmptyState, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { HeartButton } from "@/components/community/HeartButton";
import { PlayThumb } from "@/components/community/PlayThumb";
import { useAuth } from "@/lib/auth";
import { resolveRole, useAccess } from "@/lib/access";
import {
  fetchIsAppAdmin,
  fetchLibraryFeed,
  libraryPlayAsPlay,
  LIBRARY_SORTS,
  setPlayOfTheDay,
  sortLibrary,
  type LibraryPlay,
  type LibrarySort,
} from "@/lib/community";
import { PLAY_CATEGORIES, normalizeCategory } from "@/lib/types";

/**
 * The CoachSide Library feed. Renders for signed-out visitors (public browse)
 * and inside the coach Playbook, where adding a play keeps the coach here.
 */
export function LibraryFeed({
  variant = "app",
  creator,
}: {
  variant?: "app" | "public";
  creator?: string;
}) {
  const { user } = useAuth();
  const { access } = useAccess();
  const isCoach = !!user && !resolveRole(access).isPlayerOnly;
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<LibrarySort>("featured");

  const feed = useQuery({
    queryKey: ["library-feed", creator ?? null],
    queryFn: () => fetchLibraryFeed(creator ?? null),
  });
  const admin = useQuery({ queryKey: ["is-app-admin"], queryFn: fetchIsAppAdmin, enabled: isCoach });

  const shown = useMemo(() => {
    const list = (feed.data ?? []).filter(
      (p) => category === "All" || normalizeCategory(p.category) === category,
    );
    return sortLibrary(list, sort);
  }, [feed.data, category, sort]);

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Sort</Label>
          {LIBRARY_SORTS.map((s) => (
            <BubbleButton
              key={s.key}
              size="sm"
              tone={sort === s.key ? "flame" : "neutral"}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </BubbleButton>
          ))}
          <Pill tone="muted" className="ml-auto">
            {shown.length} {shown.length === 1 ? "play" : "plays"}
          </Pill>
        </div>
        <Note>{LIBRARY_SORTS.find((s) => s.key === sort)?.hint}</Note>
        <div className="flex flex-wrap items-center gap-2">
          <Label>Category</Label>
          {["All", ...PLAY_CATEGORIES].map((c) => (
            <BubbleButton
              key={c}
              size="sm"
              tone={category === c ? "grape" : "neutral"}
              onClick={() => setCategory(c)}
            >
              {c}
            </BubbleButton>
          ))}
        </div>
      </Panel>

      {feed.isLoading ? <EmptyState>Loading the library…</EmptyState> : null}
      {!feed.isLoading && !shown.length ? (
        <EmptyState>No published plays here yet</EmptyState>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <LibraryCard
            key={p.id}
            play={p}
            variant={variant}
            isCoach={isCoach}
            isAdmin={!!admin.data}
          />
        ))}
      </div>
    </div>
  );
}

function LibraryCard({
  play,
  variant,
  isCoach,
  isAdmin,
}: {
  play: LibraryPlay;
  variant: "app" | "public";
  isCoach: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const feature = useMutation({
    mutationFn: () => setPlayOfTheDay(play.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["library-feed"] });
      void qc.invalidateQueries({ queryKey: ["play-of-the-day"] });
      toast.success(`${play.name} is now the Play of the Day`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runLink =
    variant === "app" ? (
      <Link
        to="/plays/$playId/view"
        params={{ playId: play.id }}
        search={{}}
        className="block w-full"
        aria-label={`Run play ${play.name}`}
      >
        <BubbleButton tone="flame" size="lg" className="min-h-14 w-full">
          ▶ Run Play
        </BubbleButton>
      </Link>
    ) : (
      <Link
        to="/library/$playId"
        params={{ playId: play.id }}
        className="block w-full"
        aria-label={`Run play ${play.name}`}
      >
        <BubbleButton tone="flame" size="lg" className="min-h-14 w-full">
          ▶ Run Play
        </BubbleButton>
      </Link>
    );

  return (
    <Panel className="flex flex-col gap-3">
      <Link
        to="/library/$playId"
        params={{ playId: play.id }}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
        aria-label={`Open ${play.name}`}
      >
        <PlayThumb playId={play.id} attackBasket={play.attack_basket} />
      </Link>

      <span className="rounded-2xl border border-grape/60 bg-grape/20 px-3 py-2 text-xl font-black leading-tight text-foreground">
        {play.name}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="neutral">{normalizeCategory(play.category)}</Pill>
        {play.featured ? <Pill tone="flame">Play of the Day</Pill> : null}
        {play.creator_username ? (
          <Link to="/coach/$username" params={{ username: play.creator_username }}>
            <Pill tone="grape">by {play.author_label}</Pill>
          </Link>
        ) : (
          <Pill tone="muted">by {play.author_label}</Pill>
        )}
        <HeartButton play={play} />
      </div>

      {runLink}

      {isCoach ? <AddToPlaybook play={libraryPlayAsPlay(play)} compact /> : null}

      {isAdmin && !play.featured ? (
        <BubbleButton size="sm" tone="grape" disabled={feature.isPending} onClick={() => feature.mutate()}>
          ★ Make Play of the Day
        </BubbleButton>
      ) : null}
    </Panel>
  );
}
