import { Link } from "@tanstack/react-router";
import { Lock, X } from "lucide-react";
import { COMPLETE_NAME, COMPLETE_PRICE, MODULES } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

/** Small lock tag shown on GameDay+ stat toggles for free teams. */
export function GameDayLockTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-flame/60 bg-flame/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground",
        className,
      )}
    >
      <Lock className="h-3 w-3" aria-hidden /> {MODULES.gameday_plus.name}
    </span>
  );
}

/**
 * Contextual upgrade prompt shown right where a free coach tried to turn on a
 * paid stat category. Never enables the stat; Score only keeps working.
 */
export function GameDayUpgradeInline({
  feature,
  teamId,
  onClose,
}: {
  feature: string;
  teamId: string | null;
  onClose: () => void;
}) {
  const gd = MODULES.gameday_plus;
  const search = teamId ? { team: teamId } : {};
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-flame/60 bg-flame/10 p-3 bubble-pop">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 rounded-2xl bg-background/50 px-3 py-2 text-xs font-bold leading-relaxed text-foreground">
          {feature} is part of {gd.name}: tap-the-court location tracking, individual player stats and shot
          charts. Score only stays free — you can start this game right now without it.
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close upgrade message"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/membership"
          search={search}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-flame bg-flame px-4 text-xs font-black text-accent-foreground"
        >
          Unlock {gd.name} — ${gd.price}/month
        </Link>
        <Link
          to="/membership"
          search={{ ...search, plan: "complete" }}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-grape bg-grape/20 px-4 text-xs font-black text-foreground"
        >
          Get Complete — ${COMPLETE_PRICE}/month
        </Link>
      </div>
      <span className="rounded-full bg-background/40 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        {COMPLETE_NAME} includes {gd.name}, Playbook+ and Team Hub+.
      </span>
    </div>
  );
}
