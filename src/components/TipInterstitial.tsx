import { useCallback, useEffect, useRef, useState } from "react";
import mark from "@/assets/coachside-mark.jpg.asset.json";
import {
  COACHSIDE_TIPS,
  TIP_FADE_MS,
  TIP_MAX_MS,
  TIP_MIN_MS,
  TIP_SKIP_AFTER_MS,
  type TipDestination,
} from "@/lib/tips";

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
  const decisionRef = useRef<{ dest: TipDestination; show: boolean } | null>(null);
  const closingRef = useRef(false);
  const fadeTimerRef = useRef<number | null>(null);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setLeaving(true);
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setShow(false);
      fadeTimerRef.current = null;
    }, TIP_FADE_MS);
  }, []);

  useEffect(() => {
    if (decisionRef.current?.dest !== dest) {
      let alreadySeen = false;
      try {
        alreadySeen = sessionStorage.getItem(KEY(dest)) === "1";
        if (!alreadySeen) sessionStorage.setItem(KEY(dest), "1");
      } catch {
        // Storage can be unavailable in private/restricted contexts. The hard
        // timeout still guarantees this one in-memory display cannot trap users.
      }
      decisionRef.current = { dest, show: !alreadySeen };
    }
    if (!decisionRef.current.show) {
      setShow(false);
      return;
    }

    // This effect is intentionally restart-safe. React StrictMode runs effect
    // setup/cleanup twice in development; the second setup must restore every
    // dismissal timer rather than treating its own session marker as a new visit.
    closingRef.current = false;
    setLeaving(false);
    setCanSkip(false);
    setMinDone(false);
    setTip(COACHSIDE_TIPS[Math.floor(Math.random() * COACHSIDE_TIPS.length)]!);
    setShow(true);
    const skipTimer = window.setTimeout(() => setCanSkip(true), TIP_SKIP_AFTER_MS);
    const minimumTimer = window.setTimeout(() => setMinDone(true), TIP_MIN_MS);
    // Begin the fade early enough that even the transition itself completes
    // within the absolute safety window.
    const safetyTimer = window.setTimeout(close, TIP_MAX_MS - TIP_FADE_MS);
    return () => {
      window.clearTimeout(skipTimer);
      window.clearTimeout(minimumTimer);
      window.clearTimeout(safetyTimer);
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [close, dest]);

  useEffect(() => {
    if (show && minDone && ready) close();
  }, [close, show, minDone, ready]);

  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[80] flex items-center justify-center bg-background/95 p-6 backdrop-blur transition-opacity duration-300 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
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
