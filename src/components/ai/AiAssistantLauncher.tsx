import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import aiMark from "@/assets/coachside-ai-mark.png";
import { resolveRole, useAccess } from "@/lib/access";
import { onOpenAiAssistant, useAiAvailability } from "@/lib/aiAssistant";
import { cn } from "@/lib/utils";

const AiAssistantPanel = lazy(() => import("./AiAssistantPanel"));

export type FabMode = "normal" | "edge" | "hidden";

/**
 * Where the floating button may sit. Live tracking and the whiteboard keep
 * every pixel for the court; court-first editors get a slim edge tab so the
 * controls under the court stay clear.
 */
export function fabModeFor(pathname: string): FabMode {
  if (pathname.startsWith("/game/") || pathname.startsWith("/board")) return "hidden";
  if (
    pathname.startsWith("/plays/new") ||
    /^\/plays\/[^/]+\/?$/.test(pathname) ||
    pathname.startsWith("/drills/new") ||
    pathname.startsWith("/film/")
  )
    return "edge";
  return "normal";
}

/**
 * Coach-only floating CoachSide AI button plus the assistant panel. Mounted
 * once for the signed-in area so the chat survives page changes and
 * minimizing.
 */
export function AiAssistantLauncher() {
  const { access, loading } = useAccess();
  const role = resolveRole(access);
  const isCoach = !loading && role.isCoach && !role.isPlayerOnly;
  if (!isCoach) return null;
  return <CoachAiLauncher />;
}

function CoachAiLauncher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const availability = useAiAvailability();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(
    () =>
      onOpenAiAssistant((p) => {
        setPrompt(p);
        setMounted(true);
        setOpen(true);
      }),
    [],
  );

  // Hand focus back to the basketball after minimizing.
  useEffect(() => {
    if (wasOpen.current && !open) fabRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  const mode = fabModeFor(pathname);
  const available = !!availability.data?.available;

  return (
    <>
      {!open && mode !== "hidden" ? (
        <button
          ref={fabRef}
          type="button"
          aria-label="Open CoachSide AI Assistant"
          title="CoachSide AI Assistant"
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
          className={cn(
            "fixed z-40 inline-flex items-center justify-center border-2 border-grape/70 bg-surface/95 shadow-lg shadow-grape/30 ring-4 ring-grape/15 backdrop-blur transition-transform focus-visible:outline-none focus-visible:ring-grape active:scale-95",
            mode === "normal"
              ? "bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] h-14 w-14 rounded-full hover:scale-105"
              : // Slim tab tucked against the right edge, clear of the court controls.
                "right-0 top-[38%] h-12 w-9 rounded-l-2xl border-r-0 pl-1 opacity-90 hover:w-11 hover:opacity-100",
          )}
        >
          <img
            src={aiMark}
            alt=""
            width={40}
            height={40}
            className={cn("object-contain", mode === "normal" ? "h-10 w-10" : "h-7 w-7")}
          />
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
