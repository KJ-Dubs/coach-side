import { createFileRoute } from "@tanstack/react-router";
import { SharedPlayView } from "@/components/court/SharedPlayView";

export const Route = createFileRoute("/share/play/$token")({
  head: () => ({
    meta: [
      { title: "Shared Play — CoachSide" },
      {
        name: "description",
        content: "Watch a basketball play animate sequence by sequence, shared by your coach.",
      },
      { property: "og:title", content: "Shared Play — CoachSide" },
      { property: "og:description", content: "Watch the full animated play." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://coachside.live/og-cover.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://coachside.live/og-cover.png" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <SharedPlayView token={Route.useParams().token} />,
});
