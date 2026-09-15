import { createFileRoute, Link } from "@tanstack/react-router";
import { BubbleButton, SectionHeader } from "@/components/Bubbles";
import { LibraryFeed } from "@/components/community/LibraryFeed";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/library/")({
  head: () => ({
    meta: [
      { title: "CoachSide Play Library — Free Basketball Plays" },
      {
        name: "description",
        content:
          "Browse animated basketball plays published by coaches: offense, BLOB, SLOB, presses and press breaks. Free to watch, no account needed.",
      },
      { property: "og:title", content: "CoachSide Play Library — Free Basketball Plays" },
      {
        property: "og:description",
        content: "Animated basketball plays published by real coaches. Watch any play free.",
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
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-2 sm:p-4">
      <SectionHeader as="h1" title="CoachSide Play Library" subtitle="Animated plays published by coaches. Watch free — sign in to heart and save.">
        <Link to={session ? "/dashboard" : "/"}>
          <BubbleButton tone="neutral" size="sm">
            {session ? "Go to CoachSide" : "Back to CoachSide"}
          </BubbleButton>
        </Link>
      </SectionHeader>
      <LibraryFeed variant="public" />
    </main>
  );
}
