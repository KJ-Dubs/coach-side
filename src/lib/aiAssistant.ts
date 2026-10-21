import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiAssistantAvailability } from "@/lib/ai/assistant.functions";

export const AI_AVAILABILITY_KEY = ["ai-assistant-availability"] as const;

const OPEN_EVENT = "coachside:open-ai-assistant";

/** Open the native CoachSide AI Assistant from anywhere in the coach app. */
export function openAiAssistant(prompt?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { prompt: prompt ?? null } }));
}

export function onOpenAiAssistant(fn: (prompt: string | null) => void) {
  const handler = (e: Event) => fn(((e as CustomEvent).detail?.prompt as string | null) ?? null);
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}

/** Server decides: AI key configured, global switch on, and a coach account. */
export function useAiAvailability(enabled = true) {
  const fetchAvailability = useServerFn(getAiAssistantAvailability);
  return useQuery({
    queryKey: AI_AVAILABILITY_KEY,
    queryFn: () => fetchAvailability(),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
