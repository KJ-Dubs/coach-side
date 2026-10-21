import { Link, useNavigate } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import aiMark from "@/assets/coachside-ai-mark.png";
import {
  AI_COMING_SOON_BODY,
  AI_COMING_SOON_INCLUDED,
  AI_COMING_SOON_PLAN,
  AI_UPGRADE_BODY,
  AI_UPGRADE_CTA,
  AI_UPGRADE_PRICE,
  AI_UPGRADE_TITLE,
} from "@/lib/aiAccess";
import { ALL_MODULES } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

const ctaBase =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full border px-4 text-sm font-black tracking-wide shadow-lg shadow-black/20 transition-all active:scale-95 disabled:opacity-60";

/**
 * CoachSide Complete upsell for the AI Assistant. Keeps the team in context.
 * Teams without a subscription go straight to Square's hosted checkout, where
 * the coach confirms payment; teams that already pay (or a legacy plan) go to
 * Membership with Complete preselected so the plan change is confirmed there.
 * Nothing here ever charges a card by itself.
 */
export function AiUpgradeContent({
  teamId,
  onNavigate,
  className,
  mode = "upgrade",
  complete = false,
}: {
  teamId: string | null;
  onNavigate?: () => void;
  className?: string;
  /** "coming_soon" while the assistant is not launched yet. */
  mode?: "upgrade" | "coming_soon";
  /** The team already has CoachSide Complete (coming-soon mode only). */
  complete?: boolean;
}) {
  const soon = mode === "coming_soon";
  const team = teamId ?? undefined;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const toMembership = () => {
    onNavigate?.();
    void navigate({ to: "/membership", search: { plan: "complete", team } });
  };

  const upgrade = async () => {
    if (busy) return;
    setProblem(null);
    if (!teamId) return toMembership();
    setBusy(true);
    try {
      const { getTeamBilling, startTeamCheckout } = await import("@/lib/billing.functions");
      const billing = await getTeamBilling({ data: { teamId } });
      if (billing.hasSubscription || billing.provider !== "square") return toMembership();
      if (!billing.checkoutAvailable) {
        setProblem("Checkout is temporarily unavailable. Try again shortly, or open membership options.");
        return;
      }
      const r = await startTeamCheckout({
        data: { teamId, modules: [...ALL_MODULES], origin: window.location.origin },
      });
      if (r.ok) window.location.assign(r.url);
      else setProblem(r.reason);
    } catch {
      setProblem("Checkout couldn't start. Try again, or open membership options.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <img src={aiMark} alt="" width={56} height={56} className="h-14 w-14 object-contain" />
      <h2
        id="coachside-ai-upgrade-title"
        className="rounded-2xl border border-grape/50 bg-grape/15 px-4 py-1.5 text-base font-black leading-tight text-foreground"
      >
        {AI_UPGRADE_TITLE}
      </h2>
      {soon ? (
        <span className="rounded-full border border-flame/60 bg-flame/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-foreground">
          Coming Soon
        </span>
      ) : null}
      <p className="rounded-2xl border border-border/70 bg-surface-2/60 px-3 py-2 text-sm font-semibold leading-snug text-foreground">
        {soon ? AI_COMING_SOON_BODY : AI_UPGRADE_BODY}
      </p>
      <p className="rounded-2xl border border-flame/60 bg-flame/15 px-3 py-1.5 text-xs font-black leading-snug text-foreground">
        {soon ? AI_COMING_SOON_PLAN : AI_UPGRADE_PRICE}
      </p>
      {soon && complete ? (
        <p className="rounded-2xl border border-grape/60 bg-grape/15 px-3 py-2 text-sm font-black leading-snug text-foreground">
          {AI_COMING_SOON_INCLUDED}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="rounded-2xl border border-destructive/60 bg-destructive/15 px-3 py-2 text-xs font-bold text-foreground">
          {problem}
        </p>
      ) : null}
      {soon && complete ? null : (
      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={() => void upgrade()}
          disabled={busy}
          className={cn(ctaBase, "border-flame bg-flame text-accent-foreground hover:bg-flame/90")}
        >
          {busy ? "Opening secure checkout…" : soon ? "Upgrade to Complete" : AI_UPGRADE_CTA}
        </button>
        <Link
          to="/membership"
          search={{ team }}
          onClick={onNavigate}
          className={cn(ctaBase, "border-border bg-surface-2 text-foreground hover:border-grape/70")}
        >
          See membership options
        </Link>
        <p className="rounded-2xl border border-border/60 bg-surface/70 px-3 py-1.5 text-[11px] font-semibold leading-snug text-muted-foreground">
          {soon
            ? "Complete today includes Playbook+, GameDay+ and Team Hub+; the AI Assistant is added when it launches. You'll confirm payment on Square's secure checkout."
            : "You'll confirm payment on Square's secure checkout. Nothing is charged until you do."}
        </p>
      </div>
      )}
    </div>
  );
}

/** Compact floating upgrade panel opened from the basketball button. */
export function AiUpgradePanel({
  open,
  onOpenChange,
  teamId,
  mode = "upgrade",
  complete = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  mode?: "upgrade" | "coming_soon";
  complete?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div
        aria-hidden
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm animate-in fade-in-0 sm:bg-transparent sm:backdrop-blur-none"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal
        aria-labelledby="coachside-ai-upgrade-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") onOpenChange(false);
        }}
        className={cn(
          "fixed z-50 border border-grape/40 bg-background p-4 shadow-2xl shadow-black/60 outline-none animate-in fade-in-0 slide-in-from-bottom-4",
          "inset-x-0 bottom-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]",
          "sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[360px] sm:rounded-3xl sm:pb-4",
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2/70 text-foreground hover:border-grape/60"
        >
          <XIcon className="h-5 w-5" />
        </button>
        <AiUpgradeContent
          teamId={teamId}
          onNavigate={() => onOpenChange(false)}
          className="pt-2"
          mode={mode}
          complete={complete}
        />
      </div>
    </>
  );
}
