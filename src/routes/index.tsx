import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Landing } from "@/components/marketing/Landing";
import { Panel, Pill } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";
import { consumePendingInvite } from "@/lib/pendingInvite";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoachSide — Basketball Plays, Live Stats & Team Management" },
      {
        name: "description",
        content:
          "Basketball plays, live game stats, team management, schedules, player Locker Room, and coaching tools in one platform.",
      },
      { property: "og:title", content: "CoachSide — Coach better from one place" },
      {
        property: "og:description",
        content:
          "Basketball plays, live game stats, team management, schedules, player Locker Room, and coaching tools in one platform.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://coachside.live/" },
      { property: "og:image", content: "https://coachside.live/og-cover.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://coachside.live/og-cover.png" },
    ],
    links: [{ rel: "canonical", href: "https://coachside.live/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || !session) return;
    const pending = consumePendingInvite();
    if (pending) {
      navigate({ to: "/join/$token", params: { token: pending }, replace: true });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }, [ready, session, navigate]);

  if (!ready || session) {
    return (
      <main className="flex min-h-screen items-start justify-center px-3 py-6">
        <Panel className="p-4">
          <Pill tone="muted">Loading CoachSide…</Pill>
        </Panel>
      </main>
    );
  }

  return <Landing />;
}
