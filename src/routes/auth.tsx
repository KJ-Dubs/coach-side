import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "@/components/AuthCard";
import { SignInShowcase } from "@/components/SignInShowcase";
import { Panel, Pill } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";

type AuthSearch = { mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch =>
    search["mode"] === "signup" ? { mode: "signup" } : search["mode"] === "signin" ? { mode: "signin" } : {},
  head: () => ({
    meta: [
      { title: "Sign In — CoachSide" },
      {
        name: "description",
        content: "Coach sign-in and account creation for CoachSide basketball stats and plays.",
      },
      { property: "og:title", content: "Sign In — CoachSide" },
      { property: "og:description", content: "Coach sign-in for CoachSide." },
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
  const { mode } = Route.useSearch();
  const recovering =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  useEffect(() => {
    if (ready && session && !recovering) navigate({ to: "/dashboard", replace: true });
  }, [ready, session, navigate, recovering]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-4 px-3 py-6">
      {!ready || (session && !recovering) ? (
        <Panel className="p-4">
          <Pill tone="muted">Loading…</Pill>
        </Panel>
      ) : (
        <>
          <AuthCard
            initialMode={recovering ? "reset" : mode === "signup" ? "signup" : "signin"}
            onDone={() => navigate({ to: "/dashboard", replace: true })}
          />
          <SignInShowcase />
        </>
      )}
    </main>
  );
}
