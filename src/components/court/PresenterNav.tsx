import { Link, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { BubbleButton } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";
import { resolveRole, useAccess } from "@/lib/access";

/** Where a play was opened from, so Exit always returns somewhere sensible. */
export type PlaySource = "library" | "playbook" | "lockerroom" | "home" | "share";

export const PLAY_SOURCES: PlaySource[] = ["library", "playbook", "lockerroom", "home", "share"];

export type PresenterReturnContext = {
  category?: string;
  team?: string;
  folder?: string;
  tab?: "mine" | "library";
  content?: "plays" | "drills";
};

export function PresenterBackButton({
  source,
  context,
  bottom = false,
}: {
  source?: PlaySource | undefined;
  context?: PresenterReturnContext | undefined;
  bottom?: boolean | undefined;
}) {
  const { session } = useAuth();
  const { access } = useAccess();
  const role = resolveRole(access);
  const signedIn = !!session;
  const isPlayerOnly = signedIn && role.isPlayerOnly;
  const isCoach = signedIn && !role.isPlayerOnly;
  const resolved: PlaySource = source ?? (isPlayerOnly ? "lockerroom" : isCoach ? "playbook" : "library");
  const canGoBack = useCanGoBack();
  const router = useRouter();
  const navigate = useNavigate();

  const fallbackLabel = resolved === "playbook"
    ? "Back to Playbook"
    : resolved === "lockerroom"
      ? "Back to Locker Room"
      : resolved === "home"
        ? "Back to Home"
        : "Back to Library";

  const goBack = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    if (resolved === "playbook" && isCoach) {
      void navigate({
        to: "/plays",
        search: {
          tab: context?.tab ?? "mine",
          ...(context?.category ? { category: context.category } : {}),
          ...(context?.team ? { team: context.team } : {}),
          ...(context?.folder ? { folder: context.folder } : {}),
          ...(context?.content ? { content: context.content } : {}),
        },
      });
      return;
    }
    if (resolved === "lockerroom" && signedIn) {
      void navigate({
        to: "/lockerroom",
        search: {
          area: "playbook",
          ...(context?.team ? { team: context.team } : {}),
          ...(context?.folder ? { folder: context.folder } : {}),
        },
      });
      return;
    }
    if (resolved === "home" && isCoach) {
      void navigate({ to: "/dashboard" });
      return;
    }
    if (resolved === "library" && isCoach && context?.tab === "library") {
      void navigate({ to: "/plays", search: { tab: "library", content: context.content ?? "plays" } });
      return;
    }
    void navigate({ to: "/library" });
  };

  return (
    <BubbleButton tone="ghost" size={bottom ? undefined : "sm"} onClick={goBack}>
      {bottom ? "✕ " : "← "}{canGoBack ? "Back" : fallbackLabel}
    </BubbleButton>
  );
}

/**
 * Sticky escape header shown above every play presenter.
 * Deep links have no history, so destinations are always explicit.
 */
export function PresenterNav({ source, context }: { source?: PlaySource | undefined; context?: PresenterReturnContext | undefined }) {
  const { session } = useAuth();
  const { access } = useAccess();
  const role = resolveRole(access);
  const signedIn = !!session;
  const isPlayerOnly = signedIn && role.isPlayerOnly;
  const isCoach = signedIn && !role.isPlayerOnly;

  const resolved: PlaySource =
    source ?? (isPlayerOnly ? "lockerroom" : isCoach ? "playbook" : "library");

  const home = isCoach
    ? { to: "/dashboard" as const, label: "⌂ Home" }
    : isPlayerOnly
      ? { to: "/lockerroom" as const, label: "⌂ Locker Room" }
      : { to: "/" as const, label: "⌂ CoachSide" };

  return (
    <div className="sticky top-0 z-30 -mx-2 mb-1 border-b border-border/70 bg-background/95 px-2 py-2 backdrop-blur sm:-mx-3 sm:px-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PresenterBackButton source={resolved} context={context} />
        {(resolved === "home" && isCoach) || (resolved === "lockerroom" && isPlayerOnly) ? null : (
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
