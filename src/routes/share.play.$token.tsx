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
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SharedPlayView token={Route.useParams().token} />,
});
