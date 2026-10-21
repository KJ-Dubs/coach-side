import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import aiMark from "@/assets/coachside-ai-mark.png";
import { AI_UPGRADE_BODY, AI_UPGRADE_PRICE, AI_UPGRADE_TITLE } from "@/lib/aiAccess";
import { cn } from "@/lib/utils";

const ctaBase =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full border px-4 text-sm font-black tracking-wide shadow-lg shadow-black/20 transition-all active:scale-95";

/** CoachSide Complete upsell for the AI Assistant. Keeps the team in the link. */
export function AiUpgradeContent({
  teamId,
  onNavigate,
  className,
}: {
  teamId: string | null;
  onNavigate?: () => void;
  className?: string;
}) {
  const team = teamId ?? undefined;
  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <img src={aiMark} alt="" width={56} height={56} className="h-14 w-14 object-contain" />
      <h2
        id="coachside-ai-upgrade-title"
        className="rounded-2xl border border-grape/50 bg-grape/15 px-4 py-1.5 text-base font-black leading-tight text-foreground"
      >
        {AI_UPGRADE_TITLE}
      </h2>
      <p className="rounded-2xl border border-border/70 bg-surface-2/60 px-3 py-2 text-sm font-semibold leading-snug text-foreground">
        {AI_UPGRADE_BODY}
      </p>
      <p className="rounded-full border border-flame/60 bg-flame/15 px-3 py-1.5 text-xs font-black text-foreground">
        {AI_UPGRADE_PRICE}
      </p>
      <div className="flex w-full flex-col gap-2">
        <Link
          to="/membership"
          search={{ plan: "complete", team }}
          onClick={onNavigate}
          className={cn(ctaBase, "border-flame bg-flame text-accent-foreground hover:bg-flame/90")}
        >
          Upgrade to Complete
        </Link>
        <Link
          to="/membership"
          search={{ team }}
          onClick={onNavigate}
          className={cn(ctaBase, "border-border bg-surface-2 text-foreground hover:border-grape/70")}
        >
          See membership options
        </Link>
      </div>
    </div>
  );
}

/** Compact floating upgrade panel opened from the basketball button. */
export function AiUpgradePanel({
  open,
  onOpenChange,
  teamId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
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
        <AiUpgradeContent teamId={teamId} onNavigate={() => onOpenChange(false)} className="pt-2" />
      </div>
    </>
  );
}
