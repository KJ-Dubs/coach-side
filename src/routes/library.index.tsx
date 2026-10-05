import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BubbleButton, Panel, SectionHeader } from "@/components/Bubbles";
import { LibraryFeed } from "@/components/community/LibraryFeed";
import { DrillFeed } from "@/components/drills/DrillFeed";
import { SocialCTA } from "@/components/SocialCTA";
import { useAuth } from "@/lib/auth";
import { CoachesDirectory, MyCoachProfileButton } from "@/components/community/CoachesDirectory";

const searchSchema = z.object({
  content: z.enum(["plays", "drills", "coaches"]).optional(),
});

export const Route = createFileRoute("/library/")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "CoachSide Library — Basketball Plays, Drills and Coaches" },
      {
        name: "description",
        content:
          "Browse animated basketball plays, practice drills and public coach profiles. Discover and follow creators free, with no account needed to browse.",
      },
      { property: "og:title", content: "CoachSide Library — Plays, Drills and Coaches" },
      {
        property: "og:description",
        content: "Discover basketball plays, practice drills and the coaches who publish them. Free to browse.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://coachside.live/og-cover.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://coachside.live/og-cover.png" },
      { rel: "canonical", href: "https://coachside.live/library" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { session } = useAuth();
  const navigate = useNavigate({ from: "/library/" });
  const { content = "plays" } = Route.useSearch();
  const setContent = (next: "plays" | "drills" | "coaches") =>
    navigate({ search: next === "plays" ? {} : { content: next } });
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-2 sm:p-4">
      <SectionHeader
        as="h1"
        title="CoachSide Library"
        subtitle="Discover plays, drills and the coaches who publish them. Free to browse — sign in to save and follow."
      >
        <Link to={session ? "/dashboard" : "/"}>
          <BubbleButton tone="neutral" size="sm">
            {session ? "Go to CoachSide" : "Back to CoachSide"}
          </BubbleButton>
        </Link>
      </SectionHeader>

      <Panel className="flex flex-wrap items-center justify-center gap-2">
        <BubbleButton tone={content === "plays" ? "flame" : "neutral"} onClick={() => setContent("plays")}>
          Plays
        </BubbleButton>
        <BubbleButton tone={content === "drills" ? "flame" : "neutral"} onClick={() => setContent("drills")}>
          Drills
        </BubbleButton>
        <BubbleButton tone={content === "coaches" ? "flame" : "neutral"} onClick={() => setContent("coaches")}>
          Coaches
        </BubbleButton>
        {session ? <span className="basis-full sm:hidden" aria-hidden /> : null}
        {session ? <MyCoachProfileButton source="public" /> : null}
      </Panel>

      {content === "plays" ? <LibraryFeed variant="public" /> : content === "drills" ? <DrillFeed /> : <CoachesDirectory source="public" />}
      <SocialCTA />
    </main>
  );
}
