import { Link } from "@tanstack/react-router";
import { BubbleButton } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";
import { resolveRole, useAccess } from "@/lib/access";

/** Where a play was opened from, so Exit always returns somewhere sensible. */
export type PlaySource = "library" | "playbook" | "lockerroom" | "home" | "share";

export const PLAY_SOURCES: PlaySource[] = ["library", "playbook", "lockerroom", "home", "share"];

/**
 * Sticky escape header shown above every play presenter.
 * Deep links have no history, so destinations are always explicit.
 */
export function PresenterNav({ source }: { source?: PlaySource | undefined }) {
  const { session } = useAuth();
  const { access } = useAccess();
  const role = resolveRole(access);
  const signedIn = !!session;
  const isPlayerOnly = signedIn && role.isPlayerOnly;
  const isCoach = signedIn && !role.isPlayerOnly;

  const resolved: PlaySource =
    source ?? (isPlayerOnly ? "lockerroom" : isCoach ? "playbook" : "library");

  const back = (() => {
    if (resolved === "playbook" && isCoach) return { to: "/plays" as const, label: "Back to My Playbook" };
    if (resolved === "lockerroom" && signedIn)
      return { to: "/lockerroom" as const, label: "Back to Locker Room" };
    if (resolved === "home" && isCoach) return { to: "/dashboard" as const, label: "Back to Home" };
    return { to: "/library" as const, label: "Back to Library" };
  })();

  const home = isCoach
    ? { to: "/dashboard" as const, label: "⌂ Home" }
    : isPlayerOnly
      ? { to: "/lockerroom" as const, label: "⌂ Locker Room" }
      : { to: "/" as const, label: "⌂ CoachSide" };

  return (
    <div className="sticky top-0 z-30 -mx-2 mb-1 border-b border-border/70 bg-background/95 px-2 py-2 backdrop-blur sm:-mx-3 sm:px-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={back.to} className="inline-flex">
          <BubbleButton tone="ghost" size="sm">
            ← {back.label}
          </BubbleButton>
        </Link>
        {back.to === home.to ? null : (
          <Link to={home.to} className="inline-flex" aria-label={home.label}>
            <BubbleButton tone="neutral" size="sm">
              {home.label}
            </BubbleButton>
          </Link>
        )}
      </div>
    </div>
  );
}
