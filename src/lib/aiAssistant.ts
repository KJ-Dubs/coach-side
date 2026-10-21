import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Settings anchor for the CoachSide AI Assistant section. */
export const AI_ASSISTANT_ANCHOR = "chatgpt-integration";

export const AI_ASSISTANT_STATUS_KEY = ["ai-assistant-status"] as const;

/** Whether the signed-in coach has at least one active connected chat app. */
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
