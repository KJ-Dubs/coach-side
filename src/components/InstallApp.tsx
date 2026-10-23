/**
 * Install CoachSide to the home screen.
 *
 * One captured `beforeinstallprompt` and one shared snooze serve every install
 * surface (onboarding step, Home banner, header badge, public landing), so
 * "Later" in one place quiets the others for ~24 hours and never forever.
 * Never rendered on Live Game or the court-first editors.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, MoreVertical, Share, SquarePlus } from "lucide-react";
import { BubbleButton, Panel, Pill } from "@/components/Bubbles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trackActivity, trackActivityOnce, trackActivityPerSession } from "@/lib/activity";
import { isIos, isStandalone } from "@/lib/pwa";
import {
  INSTALLED_KEY,
  LEGACY_DISMISS_KEY,
  SNOOZE_KEY,
  installPlatform,
  shouldShowInstall,
  snoozeUntil,
  type InstallPlatform,
} from "@/lib/installPrompt";
import { cn } from "@/lib/utils";
import mark from "@/assets/coachside-mark.jpg.asset.json";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallSurface = "onboarding" | "dashboard" | "header" | "landing" | "push_card";

/* ---------------- shared store (browser only) ---------------- */

type Snapshot = {
  ready: boolean;
  prompt: InstallPromptEvent | null;
  installed: boolean;
  standalone: boolean;
  ios: boolean;
  android: boolean;
  snoozedUntil: number | null;
};

const SERVER_SNAPSHOT: Snapshot = {
  ready: false,
  prompt: null,
  installed: true,
  standalone: false,
  ios: false,
  android: false,
  snoozedUntil: null,
};

let snap: Snapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function emit(patch: Partial<Snapshot>) {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

function readNumber(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    /* private mode */
  }
  trackActivityOnce("pwa_installed", "device");
}

/** Starts listening for the native install prompt. Call from an effect, as early as possible. */
export function startInstallCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  let flagged = false;
  try {
    localStorage.removeItem(LEGACY_DISMISS_KEY);
    flagged = localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    /* private mode */
  }
  const standalone = isStandalone();
  if (standalone) markInstalled();
  const ua = navigator.userAgent;
  emit({
    ready: true,
    standalone,
    installed: standalone || flagged,
    ios: isIos(),
    android: /Android/i.test(ua),
    snoozedUntil: readNumber(SNOOZE_KEY),
  });
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    // Chrome only offers the prompt when the app is not installed.
    emit({ prompt: e as InstallPromptEvent, installed: standalone });
  });
  window.addEventListener("appinstalled", () => {
    markInstalled();
    emit({ installed: true, prompt: null });
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/* ---------------- hook ---------------- */

export function useInstallApp() {
  const s = useSyncExternalStore(subscribe, () => snap, () => SERVER_SNAPSHOT);
  useEffect(() => startInstallCapture(), []);
  const platform: InstallPlatform = installPlatform({ hasPrompt: !!s.prompt, ios: s.ios, android: s.android });
  const now = Date.now();

  /** Opens the native prompt when available. Returns false when the coach must follow manual steps. */
  const install = async (surface: InstallSurface): Promise<boolean> => {
    void trackActivity("install_clicked", { metadata: { surface, platform } });
    const p = snap.prompt;
    if (!p) return false;
    await p.prompt();
    const choice = await p.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    emit({ prompt: null });
    if (choice.outcome === "accepted") {
      markInstalled();
      emit({ installed: true });
    }
    return true;
  };

  /** "Later": hides install prompts for ~24 hours on this device. */
  const snooze = (surface: InstallSurface) => {
    const until = snoozeUntil(Date.now());
    try {
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {
      /* private mode: snoozed for this page only */
    }
    emit({ snoozedUntil: until });
    void trackActivity("install_dismissed", { metadata: { surface, platform } });
  };

  return {
    ready: s.ready,
    platform,
    hasPrompt: !!s.prompt,
    ios: s.ios,
    installed: s.installed,
    standalone: s.standalone,
    /** Visible on nag surfaces (respects snooze). */
    canShow: s.ready && shouldShowInstall({ installed: s.installed, platform, snoozedUntil: s.snoozedUntil, now }),
    /** Visible on onboarding's own step (ignores snooze). */
    canShowStep: s.ready && shouldShowInstall({ installed: s.installed, platform, snoozedUntil: null, now, ignoreSnooze: true }),
    install,
    snooze,
  };
}

/** Records that an install prompt was actually on screen (once per session per surface). */
function useShownEvent(visible: boolean, surface: InstallSurface, platform: InstallPlatform) {
  useEffect(() => {
    if (visible) trackActivityPerSession("install_prompt_shown", surface, { metadata: { surface, platform } });
  }, [visible, surface, platform]);
}

/* ---------------- visuals ---------------- */

/** Big numbered steps. Built to look like instructions to follow, not an info card. */
export function InstallSteps({ platform, large = true }: { platform: InstallPlatform; large?: boolean }) {
  const steps =
    platform === "android"
      ? [
          { icon: MoreVertical, text: "Tap the ⋮ menu", tone: "text-flame" },
          { icon: SquarePlus, text: "Tap Install app", tone: "text-grape-bright" },
        ]
      : [
          { icon: Share, text: "Tap Share", tone: "text-flame" },
          { icon: SquarePlus, text: "Add to Home Screen", tone: "text-grape-bright" },
        ];
  return (
    <ol className="grid w-full gap-2 sm:grid-cols-2" aria-label="How to install CoachSide">
      {steps.map((st, i) => {
        const Icon = st.icon;
        return (
          <li
            key={st.text}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 border-flame/50 bg-surface-2/90 text-left",
              large ? "p-4" : "p-3",
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-flame font-black text-primary-foreground",
                large ? "h-10 w-10 text-xl" : "h-8 w-8 text-base",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-2xl border border-border bg-background/70",
                large ? "h-14 w-14" : "h-10 w-10",
              )}
            >
              <Icon className={cn(st.tone, large ? "h-8 w-8" : "h-6 w-6")} aria-hidden />
            </span>
            <span className={cn("font-black text-foreground", large ? "text-lg" : "text-base")}>{st.text}</span>
          </li>
        );
      })}
    </ol>
  );
}

function platformNote(platform: InstallPlatform) {
  if (platform === "ios") return "Use Safari. The Share button is at the bottom (iPhone) or top (iPad) of the screen.";
  if (platform === "android") return "In Chrome, the ⋮ menu is at the top right.";
  return null;
}

/** Onboarding step. Never blocks: "I'll do this later" always continues. */
export function InstallStepPanel({ onContinue }: { onContinue: () => void }) {
  const app = useInstallApp();
  const [busy, setBusy] = useState(false);
  const visible = app.ready && !app.installed && app.platform !== "none";
  useShownEvent(visible, "onboarding", app.platform);

  if (!app.ready) return null;

  if (app.installed) {
    return (
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-grape text-primary-foreground">
          <Check className="h-9 w-9" aria-hidden />
        </span>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">CoachSide is on your home screen</h1>
        <p className="max-w-sm text-base text-muted-foreground">
          {app.standalone
            ? "You're in the app. Next, turn on notifications so you never miss your team."
            : "Open CoachSide from your home screen any time — it opens full screen, one tap away."}
        </p>
        <BubbleButton tone="grape" size="lg" className="w-full max-w-xs justify-center" onClick={onContinue}>
          Continue
        </BubbleButton>
      </div>
    );
  }

  const note = platformNote(app.platform);
  return (
    <div className="flex flex-col items-center gap-4 pt-2 text-center">
      <img src={mark.url} alt="" aria-hidden className="h-20 w-20 rounded-2xl object-cover shadow-lg" />
      <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Put CoachSide on your home screen</h1>
      <p className="max-w-sm text-base text-muted-foreground">
        CoachSide works best like an app. Install it once so your team, plays, schedule, and notifications are one tap away.
      </p>

      {app.platform === "prompt" ? (
        <BubbleButton
          tone="flame"
          size="lg"
          className="min-h-14 w-full max-w-xs justify-center text-lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await app.install("onboarding");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download className="h-6 w-6" aria-hidden /> Install CoachSide
        </BubbleButton>
      ) : app.platform === "ios" || app.platform === "android" ? (
        <div className="flex w-full flex-col gap-2 rounded-3xl border-2 border-flame/60 bg-flame/10 p-3">
          <InstallSteps platform={app.platform} />
          {note ? <p className="rounded-xl bg-background/50 px-3 py-2 text-sm font-semibold text-muted-foreground">{note}</p> : null}
          {app.platform === "ios" ? (
            <p className="rounded-xl bg-background/50 px-3 py-2 text-sm font-semibold text-foreground">
              Then open CoachSide from your home screen and sign in — setup picks up where you left off.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="max-w-sm rounded-2xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted-foreground">
          Open CoachSide on your phone or tablet to add it to your home screen.
        </p>
      )}

      <BubbleButton
        tone="ghost"
        className="justify-center"
        onClick={() => {
          if (visible) app.snooze("onboarding");
          onContinue();
        }}
      >
        {visible ? "I'll do this later" : "Continue"}
      </BubbleButton>
    </div>
  );
}

/** High-priority Home banner for coaches who have not installed yet. */
export function InstallBanner() {
  const app = useInstallApp();
  const [showSteps, setShowSteps] = useState(false);
  useShownEvent(app.canShow, "dashboard", app.platform);
  if (!app.canShow) return null;

  return (
    <Panel className="flex flex-col gap-3 border-2 border-flame/60 bg-flame/10">
      <div className="flex items-center gap-3">
        <img src={mark.url} alt="" aria-hidden className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
        <div className="min-w-0 rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2">
          <h2 className="text-lg font-black leading-tight text-foreground sm:text-xl">Install CoachSide</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            Get back to your team in one tap and enable CoachSide notifications.
          </p>
        </div>
      </div>
      {showSteps && app.platform !== "prompt" ? <InstallSteps platform={app.platform} large={false} /> : null}
      <div className="flex flex-wrap gap-2">
        <BubbleButton
          tone="flame"
          size="lg"
          className="min-h-12 flex-1 justify-center sm:flex-none"
          onClick={async () => {
            const opened = await app.install("dashboard");
            if (!opened) setShowSteps(true);
          }}
        >
          <Download className="h-5 w-5" aria-hidden /> Install CoachSide
        </BubbleButton>
        <BubbleButton tone="ghost" size="lg" className="min-h-12" onClick={() => app.snooze("dashboard")}>
          Later
        </BubbleButton>
      </div>
    </Panel>
  );
}

/** Small header badge on normal coach pages. Inline in the header — never floats over a court. */
export function InstallHeaderBadge() {
  const app = useInstallApp();
  const [open, setOpen] = useState(false);
  useShownEvent(app.canShow, "header", app.platform);
  if (!app.canShow) return null;

  if (app.platform === "prompt") {
    return (
      <BubbleButton size="sm" tone="flame" onClick={() => void app.install("header")} aria-label="Install CoachSide">
        <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Install app</span>
      </BubbleButton>
    );
  }
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void trackActivity("install_clicked", { metadata: { surface: "header", platform: app.platform } });
      }}
    >
      <PopoverTrigger asChild>
        <BubbleButton size="sm" tone="flame" aria-label="Install CoachSide">
          <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Install app</span>
        </BubbleButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-2 rounded-2xl border-border bg-popover p-3">
        <span className="rounded-xl bg-surface-2 px-3 py-2 text-sm font-black text-foreground">Install CoachSide</span>
        <InstallSteps platform={app.platform} large={false} />
        <BubbleButton
          size="sm"
          tone="ghost"
          onClick={() => {
            app.snooze("header");
            setOpen(false);
          }}
        >
          Later
        </BubbleButton>
      </PopoverContent>
    </Popover>
  );
}

/** Public landing CTA: visible, but secondary to Start Free / Explore Plays. */
export function InstallAppPill() {
  const app = useInstallApp();
  const [showSteps, setShowSteps] = useState(false);
  if (!app.ready || app.installed || app.platform === "none") return null;

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-2">
      <BubbleButton
        tone="neutral"
        size="lg"
        className="min-h-12 w-full justify-center border-2 border-flame/50 sm:w-auto"
        onClick={async () => {
          const opened = await app.install("landing");
          if (!opened) setShowSteps((v) => !v);
        }}
      >
        <Download className="h-5 w-5 text-flame" aria-hidden /> Install CoachSide App
      </BubbleButton>
      {showSteps && app.platform !== "prompt" ? (
        <div className="flex w-full flex-col gap-2 rounded-3xl border border-flame/50 bg-flame/10 p-2">
          <InstallSteps platform={app.platform} large={false} />
          {platformNote(app.platform) ? <Pill tone="muted" className="self-center">{platformNote(app.platform)}</Pill> : null}
        </div>
      ) : null}
    </div>
  );
}
