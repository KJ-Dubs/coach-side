import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { BubbleButton, Panel, Pill } from "@/components/Bubbles";
import { isIos, isStandalone } from "@/lib/pwa";
import mark from "@/assets/coachside-mark.jpg.asset.json";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "coachside.install.dismissed";

/** Chromium install prompt + iOS instructions, hidden once the app is installed. */
export function useInstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
    setDismissed(true);
  };

  // Show only where it can actually lead somewhere: a native prompt or iOS steps.
  const canShow = !installed && (!!prompt || ios);
  return { canShow, hasPrompt: !!prompt, ios, installed, dismissed, install, dismiss };
}

/** Big, presentation-friendly install card for the coach dashboard. */
export function InstallAppCard() {
  const { canShow, hasPrompt, ios, dismissed, install, dismiss } = useInstallApp();
  if (!canShow || dismissed) return null;

  return (
    <Panel className="mb-3 flex flex-col gap-3 border-2 border-flame/60 bg-flame/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-2/80 px-3 py-2">
          <img src={mark.url} alt="" aria-hidden className="h-8 w-8 rounded-xl object-cover" />
          <span className="text-xl font-black text-foreground sm:text-2xl">Install CoachSide</span>
        </span>
        <Pill tone="flame">Courtside ready</Pill>
      </div>
      <p className="rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2 text-sm font-semibold leading-relaxed text-muted-foreground">
        Add CoachSide to this device's home screen and it opens full screen with no browser bars —
        perfect for the tablet you keep on the bench.
      </p>

      {hasPrompt ? (
        <div className="flex flex-wrap gap-2">
          <BubbleButton tone="flame" size="lg" className="min-h-12" onClick={() => void install()}>
            <Download className="mr-2 inline h-5 w-5" /> Install CoachSide
          </BubbleButton>
          <BubbleButton tone="ghost" size="lg" className="min-h-12" onClick={dismiss}>
            Not now
          </BubbleButton>
        </div>
      ) : ios ? (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-3">
              <Share className="h-5 w-5 text-flame" aria-hidden />
              <Pill tone="neutral">1. Tap Share in Safari</Pill>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-3">
              <SquarePlus className="h-5 w-5 text-grape-bright" aria-hidden />
              <Pill tone="neutral">2. Tap Add to Home Screen</Pill>
            </div>
          </div>
          <BubbleButton tone="ghost" size="lg" className="min-h-12 w-fit" onClick={dismiss}>
            Got it
          </BubbleButton>
        </div>
      ) : null}
    </Panel>
  );
}

/** Compact install CTA for the public landing page. */
export function InstallAppPill() {
  const { canShow, hasPrompt, ios, dismissed, install } = useInstallApp();
  if (!canShow || dismissed) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasPrompt ? (
        <BubbleButton tone="ghost" size="md" onClick={() => void install()}>
          <Download className="mr-2 inline h-4 w-4" /> Install the CoachSide app
        </BubbleButton>
      ) : ios ? (
        <Pill tone="muted">Install on iPad: Share → Add to Home Screen</Pill>
      ) : null}
    </div>
  );
}
