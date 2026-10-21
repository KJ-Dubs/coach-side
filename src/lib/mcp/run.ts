import type { JsonValueInput, ToolContext, ToolHandlerResult } from "@lovable.dev/mcp-js";
import { TOOL_PERMISSION, type McpToolName } from "./permissions";
import { beginCall, CoachSideError, type Db } from "./service";
import { supabaseForUser } from "./supabase";
import { executeTool } from "./executor";

type ToolOutcome<T extends JsonValueInput> = { summary: string; data: T };

/**
 * Shared tool wrapper: verified caller only, connection + permission +
 * rate-limit gate, then structured success or a structured error code.
 */
export async function runTool<T extends JsonValueInput>(
  tool: McpToolName,
  ctx: ToolContext,
  fn: (db: Db, userId: string) => Promise<ToolOutcome<T>>,
): Promise<ToolHandlerResult> {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return failure("NOT_CONNECTED", "Sign in to CoachSide to use this tool.");
  try {
    const db = supabaseForUser(ctx);
    await beginCall(db, TOOL_PERMISSION[tool]);
    const { summary, data } = await fn(db, userId);
    return {
      content: [{ type: "text", text: `${summary}\n${JSON.stringify(data)}` }],
      structuredContent: data,
    };
  } catch (e) {
    if (e instanceof CoachSideError) return failure(e.code, e.message);
    console.error(`[mcp] ${tool} failed`, e instanceof Error ? e.message : e);
    return failure("SERVER_ERROR", "CoachSide could not complete this request. Try again.");
  }
}

function failure(code: string, message: string): ToolHandlerResult {
  return {
    isError: true,
    content: [{ type: "text", text: `${code}: ${message}` }],
    structuredContent: { error: { code, message } },
  };
}

/** Runs a shared CoachSide action (see executor.ts) behind the connector gate. */
export function runSharedTool(tool: McpToolName, ctx: ToolContext, args: unknown): Promise<ToolHandlerResult> {
  return runTool(tool, ctx, async (db, userId) => {
    const { summary, data } = await executeTool(tool, db, userId, args);
    return { summary, data: data as JsonValueInput };
  });
}
