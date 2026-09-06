import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Panel, Pill } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoachSide — Basketball Live Stats & Playbook" },
      {
        name: "description",
        content:
          "Sign in to CoachSide: tap-the-court live stats, season player and team stats, and a frame-by-frame play designer for your basketball program.",
      },
      { property: "og:title", content: "CoachSide — Basketball Live Stats & Playbook" },
      {
        property: "og:description",
        content: "Live stats from the court, season stats and a play designer for basketball coaches.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && session) navigate({ to: "/dashboard", replace: true });
  }, [ready, session, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center px-3 py-6">
      {!ready || session ? (
        <Panel className="p-4">
          <Pill tone="muted">Loading CoachSide…</Pill>
        </Panel>
      ) : (
        <AuthCard onDone={() => navigate({ to: "/dashboard", replace: true })} />
      )}
    </main>
  );
}
