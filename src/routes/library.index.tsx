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
      { title: "CoachSide Play & Drill Library — Free Basketball Plays and Drills" },
      {
        name: "description",
        content:
          "Browse animated basketball plays and full practice drills published by coaches: offense, BLOB, SLOB, presses, shooting, defense and more. Free to watch, no account needed.",
      },
      { property: "og:title", content: "CoachSide Play & Drill Library" },
      {
        property: "og:description",
        content: "Animated basketball plays and practice drills published by real coaches. Free to browse.",
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
        subtitle="Animated plays and full practice drills published by coaches. Free to browse — sign in to save."
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
        {session ? <MyCoachProfileButton /> : null}
      </Panel>

      {content === "plays" ? <LibraryFeed variant="public" /> : content === "drills" ? <DrillFeed /> : <CoachesDirectory source="public" />}
      <SocialCTA />
    </main>
  );
}
