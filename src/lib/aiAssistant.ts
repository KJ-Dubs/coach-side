import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAiAssistantAvailability } from "@/lib/ai/assistant.functions";

/** Settings anchor for the external ChatGPT connector section. */
export const AI_ASSISTANT_ANCHOR = "chatgpt-integration";

export const AI_ASSISTANT_STATUS_KEY = ["ai-assistant-status"] as const;
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

/** Whether the signed-in coach has at least one active external ChatGPT connection. */
export function useAiAssistantStatus(enabled = true) {
  return useQuery({
    queryKey: AI_ASSISTANT_STATUS_KEY,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("mcp_connections")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null);
      if (error) throw error;
      return { activeCount: count ?? 0 };
    },
  });
}
