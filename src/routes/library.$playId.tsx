import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BubbleButton, EmptyState, InfoPanel, Label, Panel, Pill, PrimaryCTA } from "@/components/Bubbles";
import { PlayPresenter } from "@/components/court/PlayPresenter";
import { PresenterNav } from "@/components/court/PresenterNav";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { HeartButton } from "@/components/community/HeartButton";
import { FollowButton } from "@/components/community/FollowButton";
import { useAuth } from "@/lib/auth";
import { resolveRole, useAccess } from "@/lib/access";
import {
  fetchLibraryFeed,
  fetchPublicFrames,
  libraryPlayAsPlay,
} from "@/lib/community";
import { normalizeCategory } from "@/lib/types";

export const Route = createFileRoute("/library/$playId")({
  head: () => ({
    meta: [
      { title: "Published Play — CoachSide Library" },
      {
        name: "description",
        content:
          "Watch an animated basketball play from the CoachSide Library, published by a real coach.",
      },
      { property: "og:title", content: "Published Play — CoachSide Library" },
      { property: "og:description", content: "Watch this animated basketball play free." },
      { property: "og:type", content: "article" },
      { property: "og:image", content: "https://coachside.live/og-cover.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://coachside.live/og-cover.png" },
    ],
  }),
  component: PublicPlayPage,
});

function PublicPlayPage() {
  const { playId } = Route.useParams();
  const { session } = useAuth();
  const { access } = useAccess();
  const isCoach = !!session && !resolveRole(access).isPlayerOnly;

  const feed = useQuery({ queryKey: ["library-feed", null], queryFn: () => fetchLibraryFeed(null) });
  const frames = useQuery({
    queryKey: ["public-play-frames", playId],
    queryFn: () => fetchPublicFrames(playId),
  });
  const play = (feed.data ?? []).find((p) => p.id === playId) ?? null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-2 p-2 sm:p-3">
      <PresenterNav source="library" />
      {feed.isLoading ? <EmptyState>Loading play…</EmptyState> : null}
      {!feed.isLoading && !play ? (
        <Panel className="flex flex-col items-start gap-2">
          <Label>This play is not published</Label>
          <Link to="/library">
            <BubbleButton tone="grape">Browse the Library</BubbleButton>
          </Link>
        </Panel>
      ) : null}

      {play ? (
        <>
          <PlayPresenter
            play={{
              name: play.name,
              category: play.category,
              attack_basket: play.attack_basket,
            }}
            frames={frames.data}
            loading={frames.isLoading}
          />
          <Panel className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral">{normalizeCategory(play.category)}</Pill>
            {play.creator_username ? (
              <Link to="/coach/$username" params={{ username: play.creator_username }}>
                <Pill tone="grape">by {play.author_label}</Pill>
              </Link>
            ) : (
              <Pill tone="muted">by {play.author_label}</Pill>
            )}
            <HeartButton play={play} />
            {play.creator_username ? <FollowButton username={play.creator_username} /> : null}
            {isCoach ? (
              <div className="ml-auto">
                <AddToPlaybook play={libraryPlayAsPlay(play)} compact />
              </div>
            ) : null}
          </Panel>
          {!session ? (
            <Panel className="flex flex-col items-center gap-3">
              <InfoPanel>Create a free coach account to heart plays and save them to your playbook.</InfoPanel>
              <PrimaryCTA><Link to="/auth" search={{ mode: "signup" }}>
                <BubbleButton tone="grape">Create Coach Account</BubbleButton>
              </Link></PrimaryCTA>
            </Panel>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
