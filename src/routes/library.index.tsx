import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BubbleButton, Panel, SectionHeader } from "@/components/Bubbles";
import { LibraryFeed } from "@/components/community/LibraryFeed";
import { DrillFeed } from "@/components/drills/DrillFeed";
import { SocialCTA } from "@/components/SocialCTA";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/library/")({
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
  const [tab, setTab] = useState<"plays" | "drills">("plays");
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
        <BubbleButton tone={tab === "plays" ? "flame" : "neutral"} onClick={() => setTab("plays")}>
          Plays
        </BubbleButton>
        <BubbleButton tone={tab === "drills" ? "flame" : "neutral"} onClick={() => setTab("drills")}>
          Drills
        </BubbleButton>
      </Panel>

      {tab === "plays" ? <LibraryFeed variant="public" /> : <DrillFeed />}
      <SocialCTA />
    </main>
  );
}
