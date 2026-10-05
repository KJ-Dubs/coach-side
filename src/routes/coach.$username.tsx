import { createFileRoute, Link, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { BubbleButton, EmptyState, Heading, Note, Panel, StatTile } from "@/components/Bubbles";
import { LibraryFeed } from "@/components/community/LibraryFeed";
import { FollowButton } from "@/components/community/FollowButton";
import { fetchCreatorProfile, fetchMyPublicProfile } from "@/lib/community";
import { useAuth } from "@/lib/auth";

const searchSchema = z.object({
  from: z.enum(["app-coaches", "public-coaches", "app-plays", "public-plays"]).optional(),
});

export const Route = createFileRoute("/coach/$username")({
  validateSearch: (search) => searchSchema.parse(search),
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
  const { from } = Route.useSearch();
  const { user } = useAuth();
  const canGoBack = useCanGoBack();
  const router = useRouter();
  const navigate = useNavigate();
  const profile = useQuery({
    queryKey: ["creator-profile", username],
    queryFn: () => fetchCreatorProfile(username),
  });
  const mine = useQuery({
    queryKey: ["my-public-profile"],
    queryFn: fetchMyPublicProfile,
    enabled: !!user,
  });
  const isSelf = mine.data?.username?.toLowerCase() === username.toLowerCase();
  const back = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    if (from === "app-plays") {
      void navigate({ to: "/plays", search: { tab: "library", content: "plays" } });
      return;
    }
    if (from === "public-plays") {
      void navigate({ to: "/library", search: {} });
      return;
    }
    if (from === "public-coaches") {
      void navigate({ to: "/library", search: { content: "coaches" } });
      return;
    }
    if (user) {
      void navigate({ to: "/plays", search: { tab: "library", content: "coaches" } });
      return;
    }
    void navigate({ to: "/library", search: { content: "coaches" } });
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-2 sm:p-4">
      <div className="flex justify-start">
        <BubbleButton size="sm" tone="ghost" onClick={back}>← {canGoBack ? "Back" : "Coach Directory"}</BubbleButton>
      </div>
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
          <Panel className="flex flex-col items-center gap-3 text-center">
            <div className="flex flex-col items-center gap-2">
              <Heading tone="grape">
                <h1>{profile.data.display_name}</h1>
              </Heading>
              <Note>@{profile.data.username}</Note>
              {isSelf ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Note>This is your public profile</Note>
                  <Link to="/settings" hash="public-coach-profile">
                    <BubbleButton size="sm" tone="neutral">Edit Profile</BubbleButton>
                  </Link>
                </div>
              ) : (
                <FollowButton username={profile.data.username} size="md" />
              )}
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
