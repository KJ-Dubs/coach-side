import { createFileRoute } from "@tanstack/react-router";

/** CoachSide AI Assistant stream. The handler verifies the coach's session itself. */
export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAiChat } = await import("@/lib/ai/chat.server");
        try {
          return await handleAiChat(request);
        } catch (e) {
          console.error("[ai] chat route failed", e instanceof Error ? e.message : e);
          return new Response(JSON.stringify({ error: "SERVER_ERROR", message: "CoachSide AI couldn't finish that. Try again." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
