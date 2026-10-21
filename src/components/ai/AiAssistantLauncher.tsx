import { lazy, Suspense, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import aiMark from "@/assets/coachside-ai-mark.png";
import { onOpenAiAssistant, useAiAvailability } from "@/lib/aiAssistant";
import { cn } from "@/lib/utils";

const AiAssistantPanel = lazy(() => import("./AiAssistantPanel"));

/** Court-first editors where a floating button would cover controls. */
function hideFab(pathname: string) {
  return (
    pathname.startsWith("/game/") ||
    pathname.startsWith("/board") ||
    pathname.startsWith("/plays/new") ||
    /^\/plays\/[^/]+\/?$/.test(pathname) ||
    pathname.startsWith("/drills/new") ||
    pathname.startsWith("/film/")
  );
}

/** Coach-only floating CoachSide AI button plus the assistant panel. */
export function AiAssistantLauncher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const availability = useAiAvailability();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(
    () =>
      onOpenAiAssistant((p) => {
        setPrompt(p);
        setMounted(true);
        setOpen(true);
      }),
    [],
  );

  const available = !!availability.data?.available;
  const showFab = available && !open && !hideFab(pathname);

  return (
    <>
      {showFab ? (
        <button
          type="button"
          aria-label="Open CoachSide AI Assistant"
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
          className={cn(
            "fixed right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-grape/70 bg-surface/95 shadow-xl shadow-black/50 backdrop-blur transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape",
            "bottom-[max(1rem,env(safe-area-inset-bottom))]",
          )}
        >
          <img src={aiMark} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
        </button>
      ) : null}
      {mounted ? (
        <Suspense fallback={null}>
          <AiAssistantPanel
            open={open}
            onOpenChange={setOpen}
            available={available}
            configured={availability.data?.configured ?? false}
            initialPrompt={prompt}
            onPromptUsed={() => setPrompt(null)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
