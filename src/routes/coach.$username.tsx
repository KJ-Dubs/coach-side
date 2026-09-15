import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BubbleButton, EmptyState, Heading, Note, Panel, StatTile } from "@/components/Bubbles";
import { LibraryFeed } from "@/components/community/LibraryFeed";
import { FollowButton } from "@/components/community/FollowButton";
import { fetchCreatorProfile } from "@/lib/community";

export const Route = createFileRoute("/coach/$username")({
  head: () => ({
    meta: [
      { title: "Coach Profile — CoachSide Library" },
      {
        name: "description",
        content: "Published basketball plays from a CoachSide creator, free to watch.",
      },
      { property: "og:title", content: "Coach Profile — CoachSide Library" },
      { property: "og:description", content: "Published basketball plays from this coach." },
      { property: "og:type", content: "profile" },
      { property: "og:image", content: "https://coachside.live/og-cover.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://coachside.live/og-cover.png" },
    ],
  }),
  component: CreatorPage,
});

function CreatorPage() {
  const { username } = Route.useParams();
  const profile = useQuery({
    queryKey: ["creator-profile", username],
    queryFn: () => fetchCreatorProfile(username),
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-2 sm:p-4">
      {profile.isLoading ? <EmptyState>Loading coach…</EmptyState> : null}
      {!profile.isLoading && !profile.data ? (
        <Panel className="flex flex-col items-start gap-2">
          <Note>No public coach profile at this handle.</Note>
          <Link to="/library">
            <BubbleButton tone="grape">Browse the Library</BubbleButton>
          </Link>
        </Panel>
      ) : null}

      {profile.data ? (
        <>
          <Panel className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Heading tone="grape">
                <h1>{profile.data.display_name}</h1>
              </Heading>
              <Note>@{profile.data.username}</Note>
              <div className="ml-auto">
                <FollowButton username={profile.data.username} size="md" />
              </div>
            </div>
            {profile.data.bio ? <Note>{profile.data.bio}</Note> : null}
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Plays" value={profile.data.published_plays} />
              <StatTile label="Hearts" value={profile.data.total_hearts} tone="flame" />
              <StatTile label="Followers" value={profile.data.followers} tone="grape" />
            </div>
          </Panel>
          <LibraryFeed variant="public" creator={profile.data.username} />
        </>
      ) : null}
    </main>
  );
}
