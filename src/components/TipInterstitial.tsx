import { useEffect, useState } from "react";
import mark from "@/assets/coachside-mark.jpg.asset.json";
import { COACHSIDE_TIPS, TIP_MIN_MS, TIP_SKIP_AFTER_MS, type TipDestination } from "@/lib/tips";

const KEY = (d: TipDestination) => `coachside.tip.seen.${d}`;

/**
 * Short CoachSide Tip overlay. Shows at most once per destination per browser
 * session, stays while `ready` is false, and never appears on game screens.
 */
export function TipInterstitial({ dest, ready = true }: { dest: TipDestination; ready?: boolean }) {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [tip, setTip] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY(dest))) return;
      sessionStorage.setItem(KEY(dest), "1");
    } catch {
      return;
    }
    setTip(COACHSIDE_TIPS[Math.floor(Math.random() * COACHSIDE_TIPS.length)]!);
    setShow(true);
    const a = window.setTimeout(() => setCanSkip(true), TIP_SKIP_AFTER_MS);
    const b = window.setTimeout(() => setMinDone(true), TIP_MIN_MS);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [dest]);

  useEffect(() => {
    if (show && minDone && ready) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, minDone, ready]);

  function close() {
    setLeaving(true);
    window.setTimeout(() => setShow(false), 280);
  }

  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[80] flex items-center justify-center bg-background/95 p-6 backdrop-blur transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-border/70 bg-surface/90 p-6 text-center shadow-2xl shadow-black/40">
        <div className="relative h-20 w-20">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-grape/20 border-t-flame" />
          <img src={mark.url} alt="CoachSide" className="absolute inset-2 h-16 w-16 rounded-full object-cover" />
        </div>
        <span className="rounded-full border border-grape/60 bg-grape/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-foreground">
          CoachSide Tip
        </span>
        <p className="rounded-2xl border border-border bg-surface-2/80 px-4 py-3 text-base font-bold leading-snug text-foreground">
          {tip}
        </p>
        <button
          type="button"
          onClick={close}
          disabled={!canSkip}
          className={`rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground transition-opacity ${canSkip ? "opacity-100" : "opacity-0"}`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
