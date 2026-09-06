import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Panel, Pill } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — CourtSide Coach" },
      {
        name: "description",
        content: "Coach sign-in and account creation for CourtSide Coach basketball stats and plays.",
      },
      { property: "og:title", content: "Sign In — CourtSide Coach" },
      { property: "og:description", content: "Coach sign-in for CourtSide Coach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const recovering =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  useEffect(() => {
    if (ready && session && !recovering) navigate({ to: "/dashboard", replace: true });
  }, [ready, session, navigate, recovering]);

  return (
    <main className="flex min-h-screen items-center justify-center px-3 py-6">
      {!ready || (session && !recovering) ? (
        <Panel className="p-4">
          <Pill tone="muted">Loading…</Pill>
        </Panel>
      ) : (
        <AuthCard
          initialMode={recovering ? "reset" : "signin"}
          onDone={() => navigate({ to: "/dashboard", replace: true })}
        />
      )}
    </main>
  );
}
