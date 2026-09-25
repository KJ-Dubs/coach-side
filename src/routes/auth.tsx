import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "@/components/AuthCard";
import { SignInShowcase } from "@/components/SignInShowcase";
import { Panel, Pill } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";
import { consumePendingInvite } from "@/lib/pendingInvite";
import { trackActivity } from "@/lib/activity";

type AuthSearch = { mode?: "signin" | "signup"; next?: string };

/** Only same-origin in-app paths may be used as a post-sign-in destination. */
function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const next = safeNext(search["next"]);
    return {
      ...(search["mode"] === "signup"
        ? { mode: "signup" as const }
        : search["mode"] === "signin"
          ? { mode: "signin" as const }
          : {}),
      ...(next ? { next } : {}),
    };
  },
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
  const { mode, next } = Route.useSearch();
  const recovering =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  /** Returns the visitor to where they started (e.g. a shared play), if safe. */
  const goHome = () => {
    if (next) {
      navigate({ to: next, replace: true } as never);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    if (!ready || !session || recovering) return;
    // Owner analytics only: a sign-in happened. Deduped per user for 30 min
    // so repeat auth-page visits / double auth-state callbacks log once.
    try {
      const key = `coachside.signedin.${session.user.id}`;
      const last = Number(localStorage.getItem(key) || 0);
      if (Date.now() - last > 30 * 60 * 1000) {
        localStorage.setItem(key, String(Date.now()));
        void trackActivity("signed_in");
      }
    } catch {
      /* never block sign-in */
    }
    // A player who started from a team invite always resumes that invite.
    const pending = consumePendingInvite();
    if (pending) {
      navigate({ to: "/join/$token", params: { token: pending }, replace: true });
      return;
    }
    goHome();
  }, [ready, session, navigate, recovering]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onDone={() => goHome()}
          />
          <SignInShowcase />
        </>
      )}
    </main>
  );
}
