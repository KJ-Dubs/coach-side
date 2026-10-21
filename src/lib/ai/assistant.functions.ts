/**
 * CoachSide AI Assistant server functions: availability, confirming staged
 * changes, and owner-only diagnostics. Never returns the AI key.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MCP_TOOL_NAMES } from "@/lib/mcp/permissions";
import { PROPOSE_TOOLS } from "./limits";
import type { Db } from "@/lib/mcp/service";

type Rpc = { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> };
async function assertAdmin(supabase: unknown) {
  const { data, error } = await (supabase as Rpc).rpc("is_app_admin");
  if (error || data !== true) throw new Error("CoachSide owners only.");
}

export const getAiAssistantAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readAiConfig, readAssistantEnabled } = await import("./config.server");
    const { loadAccess } = await import("@/lib/mcp/service");
    const db = context.supabase as unknown as Db;
    const config = readAiConfig();
    const [enabled, access] = await Promise.all([
      readAssistantEnabled(db),
      loadAccess(db).catch(() => null),
    ]);
    return {
      configured: config.configured,
      enabled,
      isCoach: !!access?.isCoach,
      available: config.configured && enabled && !!access?.isCoach,
    };
  });

export const resolveAiAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }) => {
    const { confirmInput, resolveAction } = await import("./actions.server");
    const { loadAccess } = await import("@/lib/mcp/service");
    const parsed = confirmInput.parse(data);
    const db = context.supabase as unknown as Db;
    const access = await loadAccess(db);
    if (!access.isCoach) throw new Error("Only coach accounts can make changes.");
    return resolveAction(db, context.userId, parsed);
  });

export type AiDiagnostics = {
  keyConfigured: boolean;
  model: string;
  enabled: boolean;
  endpoint: { ok: boolean; detail: string };
  tools: string[];
  tablesOk: boolean;
  usage24h: { requests: number; tokens: number };
};

export const getAiDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiDiagnostics> => {
    await assertAdmin(context.supabase);
    const { readAiConfig, readAssistantEnabled } = await import("./config.server");
    const db = context.supabase as unknown as Db;
    const config = readAiConfig();
    let endpoint = { ok: false, detail: "AI not configured" };
    if (config.apiKey) {
      try {
        // Model lookup costs no tokens and proves the key + model work.
        const r = await fetch(
          `https://api.openai.com/v1/models/${encodeURIComponent(config.model)}`,
          {
            headers: { Authorization: `Bearer ${config.apiKey}` },
          },
        );
        endpoint = {
          ok: r.ok,
          detail: r.ok
            ? "Reachable · model available"
            : r.status === 401
              ? "Key rejected (401)"
              : r.status === 404
                ? "Model not available (404)"
                : `HTTP ${r.status}`,
        };
      } catch {
        endpoint = { ok: false, detail: "Could not reach the AI service" };
      }
    }
    const tables = await Promise.all(
      ["ai_conversations", "ai_messages", "ai_pending_actions", "ai_usage"].map((t) =>
        db.from(t).select("id", { head: true, count: "exact" }).limit(1),
      ),
    );
    const { data: usage } = await db
      .from("ai_usage")
      .select("total_tokens")
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
      .limit(5000);
    const rows = (usage ?? []) as { total_tokens: number | null }[];
    return {
      keyConfigured: config.configured,
      model: config.model,
      enabled: await readAssistantEnabled(db),
      endpoint,
      tools: [
        ...MCP_TOOL_NAMES.filter((n) => ["list_teams", "get_roster", "list_schedule"].includes(n)),
        ...PROPOSE_TOOLS,
      ],
      tablesOk: tables.every((t) => !t.error),
      usage24h: {
        requests: rows.length,
        tokens: rows.reduce((s, r) => s + (r.total_tokens ?? 0), 0),
      },
    };
  });

export const setAiAssistantEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean }) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const db = context.supabase as unknown as Db;
    const { error } = await db.from("ai_settings").upsert({
      id: true,
      assistant_enabled: data.enabled,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw new Error("Could not update the AI setting.");
    return { enabled: data.enabled };
  });
