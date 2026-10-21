import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import aiMark from "@/assets/coachside-ai-mark.png";
import { AiUpgradePanel } from "@/components/ai/AiUpgradeCard";
import { resolveRole, useAccess } from "@/lib/access";
import { fabModeFor } from "@/lib/ai/fabPlacement";
import { onOpenAiAssistant, useAiAvailability } from "@/lib/aiAssistant";
import { useCurrentTeam } from "@/lib/teamContext";
import { cn } from "@/lib/utils";

const AiAssistantPanel = lazy(() => import("./AiAssistantPanel"));

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
  const { teamId: currentTeamId } = useCurrentTeam();
  const [open, setOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // The server decides which teams are on CoachSide Complete. With none, the
  // basketball stays visible but opens the Complete upgrade instead of a chat.
  const entitledTeamIds = useMemo(() => availability.data?.entitledTeamIds ?? [], [availability.data]);
  const locked = !!availability.data && entitledTeamIds.length === 0;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const launch = () => {
    if (lockedRef.current) {
      setUpsellOpen(true);
      return;
    }
    setMounted(true);
    setOpen(true);
  };

  useEffect(
    () =>
      onOpenAiAssistant((p) => {
        if (lockedRef.current) {
          setUpsellOpen(true);
          return;
        }
        setPrompt(p);
        setMounted(true);
        setOpen(true);
      }),
    [],
  );

  // Hand focus back to the basketball after minimizing.
  const anyOpen = open || upsellOpen;
  useEffect(() => {
    if (wasOpen.current && !anyOpen) fabRef.current?.focus({ preventScroll: true });
    wasOpen.current = anyOpen;
  }, [anyOpen]);

  const mode = fabModeFor(pathname);
  const available = !!availability.data?.available;

  // Entering live tracking or the whiteboard tucks the chat away (it keeps
  // its state) so it can never cover the court.
  useEffect(() => {
    if (mode === "hidden") {
      setOpen(false);
      setUpsellOpen(false);
    }
  }, [mode]);

  // Leaving for Membership (or anywhere) closes the upsell.
  useEffect(() => {
    setUpsellOpen(false);
  }, [pathname]);

  return (
    <>
      {!anyOpen && mode !== "hidden" ? (
        <button
          ref={fabRef}
          type="button"
          aria-label="Open CoachSide AI Assistant"
          title="CoachSide AI Assistant"
          onClick={launch}
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
            ready={!!availability.data}
            available={available}
            entitledTeamIds={entitledTeamIds}
            initialPrompt={prompt}
            onPromptUsed={() => setPrompt(null)}
          />
        </Suspense>
      ) : null}
      <AiUpgradePanel open={upsellOpen} onOpenChange={setUpsellOpen} teamId={currentTeamId} />
    </>
  );
}
