/**
 * CoachSide AI Assistant streaming handler. Server-only.
 * Every request: verify session → feature flag + key → coach check → limits
 * → own conversation → bounded history → model with CoachSide tools.
 */
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { listTeams, loadAccess, type Db } from "@/lib/mcp/service";
import { safeTimeZone } from "@/lib/mcp/time";
import { authenticateRequest } from "./auth.server";
import { aiProviderOptions, createAiModel, friendlyAiError, readAiConfig, readAssistantEnabled } from "./config.server";
import { buildSystemPrompt } from "./prompt";
import { buildAssistantTools } from "./tools.server";
import { AI_LIMITS, dataUrlBytes, isAllowedAttachmentType, maxBytesFor } from "./limits";

const fail = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: code, message }), { status, headers: { "content-type": "application/json" } });

const textPart = z.object({ type: z.literal("text"), text: z.string() });
const filePart = z.object({
  type: z.literal("file"),
  mediaType: z.string().max(100),
  url: z.string(),
  filename: z.string().max(200).optional(),
});
const bodySchema = z.object({
  conversationId: z.string().uuid(),
  teamId: z.string().uuid().nullable().optional(),
  timezone: z.string().max(64).optional(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal("user"),
    parts: z.array(z.union([textPart, filePart])).min(1).max(AI_LIMITS.maxAttachments + 2),
  }),
});

type StoredPart = Record<string, unknown> & { type: string };

/** Uploaded files are never stored: keep only a small marker for the transcript. */
function storableUserParts(parts: z.infer<typeof bodySchema>["message"]["parts"]): StoredPart[] {
  return parts.map((p) =>
    p.type === "file" ? { type: "data-attachment", data: { filename: p.filename ?? "upload", mediaType: p.mediaType } } : p,
  );
}

/** Reasoning is replayed only within one request; never stored. */
function storableAssistantParts(parts: UIMessage["parts"]): StoredPart[] {
  return (parts as StoredPart[]).filter((p) => p.type !== "reasoning");
}

const textOf = (parts: StoredPart[]) =>
  parts
    .filter((p) => p.type === "text")
    .map((p) => String(p["text"] ?? ""))
    .join("\n")
    .slice(0, 4000);

async function loadHistory(db: Db, conversationId: string): Promise<UIMessage[]> {
  const { data } = await db
    .from("ai_messages")
    .select("ui_id,role,parts,created_at")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(AI_LIMITS.historyMessages);
  const rows = ((data ?? []) as { ui_id: string; role: "user" | "assistant"; parts: StoredPart[] }[]).reverse();
  while (rows.length && rows[0]!.role !== "user") rows.shift();

  // Tell the model what happened to anything it staged earlier.
  const ids = new Set<string>();
  for (const r of rows) for (const p of r.parts) {
    const out = p["output"] as { action_id?: string } | undefined;
    if (p.type.startsWith("tool-propose_") && out?.action_id) ids.add(out.action_id);
  }
  const statuses = new Map<string, { status: string; summary: string | null }>();
  if (ids.size) {
    const { data: acts } = await db.from("ai_pending_actions").select("id,status,result").in("id", [...ids]);
    for (const a of (acts ?? []) as { id: string; status: string; result: { summary?: string } | null }[]) {
      statuses.set(a.id, { status: a.status, summary: a.result?.summary ?? null });
    }
  }
  return rows.map((r) => ({
    id: r.ui_id,
    role: r.role,
    parts: r.parts.map((p) => {
      const out = p["output"] as { action_id?: string } | undefined;
      const s = out?.action_id ? statuses.get(out.action_id) : undefined;
      return s ? { ...p, output: { ...out, status: s.status === "pending" ? "awaiting_coach_confirmation" : s.status, result: s.summary } } : p;
    }),
  })) as UIMessage[];
}

export async function handleAiChat(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth) return fail(401, "UNAUTHORIZED", "Sign in to CoachSide to use the AI Assistant.");
  const { db, userId } = auth;

  const config = readAiConfig();
  if (!config.apiKey) return fail(503, "AI_NOT_CONFIGURED", "CoachSide AI isn't available yet.");
  if (!(await readAssistantEnabled(db))) return fail(503, "AI_DISABLED", "CoachSide AI is turned off right now.");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return fail(400, "INVALID_REQUEST", "That message couldn't be sent. Try again.");
  }

  const access = await loadAccess(db).catch(() => null);
  if (!access?.isCoach) return fail(403, "COACH_ONLY", "The CoachSide AI Assistant is for coach accounts.");

  // Prompt and attachment guards.
  const text = body.message.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
  if (text.length > AI_LIMITS.maxPromptChars) return fail(413, "PROMPT_TOO_LONG", `Keep messages under ${AI_LIMITS.maxPromptChars} characters.`);
  const files = body.message.parts.filter((p): p is z.infer<typeof filePart> => p.type === "file");
  if (files.length > AI_LIMITS.maxAttachments) return fail(413, "TOO_MANY_FILES", `Attach up to ${AI_LIMITS.maxAttachments} files at a time.`);
  for (const f of files) {
    if (!isAllowedAttachmentType(f.mediaType) || !f.url.startsWith(`data:${f.mediaType};base64,`)) {
      return fail(415, "UNSUPPORTED_FILE", "Only JPG, PNG, WebP images or PDF files can be attached.");
    }
    if (dataUrlBytes(f.url) > maxBytesFor(f.mediaType)) {
      return fail(413, "FILE_TOO_LARGE", `That file is too large. Images up to ${AI_LIMITS.maxImageBytes / 1048576} MB, PDFs up to ${AI_LIMITS.maxPdfBytes / 1048576} MB.`);
    }
  }
  if (!text.trim() && !files.length) return fail(400, "EMPTY", "Type a message or attach a file.");

  // Per-user rate limits.
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [recent, daily] = await Promise.all([
    db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since(10 * 60_000)),
    db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since(86_400_000)),
  ]);
  if ((recent.count ?? 0) >= AI_LIMITS.requestsPer10Min || (daily.count ?? 0) >= AI_LIMITS.requestsPerDay) {
    return fail(429, "RATE_LIMITED", "You've sent a lot of AI requests. Take a short break and try again.");
  }

  // Conversation must belong to this coach (row security hides anyone else's).
  const teams = (await listTeams(db).catch(() => ({ teams: [] }))).teams;
  const teamId = body.teamId && teams.some((t) => t.id === body.teamId) ? body.teamId : null;
  const { data: convo } = await db.from("ai_conversations").select("id").eq("id", body.conversationId).maybeSingle();
  if (!convo) {
    const { error } = await db
      .from("ai_conversations")
      .insert({ id: body.conversationId, user_id: userId, team_id: teamId, title: text.slice(0, 80) || "Upload" });
    if (error) return fail(403, "CONVERSATION_UNAVAILABLE", "Start a new chat and try again.");
  }

  const history = await loadHistory(db, body.conversationId);
  const userParts = storableUserParts(body.message.parts);
  const { error: saveErr } = await db.from("ai_messages").insert({
    conversation_id: body.conversationId,
    user_id: userId,
    ui_id: body.message.id,
    role: "user",
    content: textOf(userParts),
    parts: userParts,
    metadata: { attachments: files.length, team_id: teamId },
  });
  if (saveErr && !/duplicate/i.test(saveErr.message)) console.error("[ai] could not save user message", saveErr.message);

  const messages = [...history, body.message as unknown as UIMessage];
  const tools = buildAssistantTools({ db, userId, conversationId: body.conversationId });
  const requestType = files.some((f) => f.mediaType === "application/pdf") ? "file" : files.length ? "image" : "text";
  const logUsage = async (usage: { inputTokens?: number | undefined; outputTokens?: number | undefined; totalTokens?: number | undefined } | null, meta: Record<string, unknown>) => {
    try {
      await db.from("ai_usage").insert({
        user_id: userId,
        model: config.model,
        request_type: requestType,
        input_tokens: usage?.inputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
        total_tokens: usage?.totalTokens ?? null,
        metadata: meta,
      });
    } catch {
      /* usage logging never blocks the coach */
    }
  };

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });
  } catch (e) {
    console.error("[ai] history conversion failed", e instanceof Error ? e.message : e);
    modelMessages = await convertToModelMessages([body.message as unknown as UIMessage]);
  }

  const result = streamText({
    model: createAiModel(config.apiKey, config.model),
    instructions: buildSystemPrompt({
      now: new Date(),
      timezone: safeTimeZone(body.timezone),
      teams: teams.map((t) => ({ id: t.id, name: t.name, season: t.season, level: t.level, timezone: t.timezone })),
      currentTeamId: teamId,
    }),
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(AI_LIMITS.maxSteps),
    providerOptions: aiProviderOptions(config.model),
    abortSignal: request.signal,
    onEnd: (event) => {
      const e = event as unknown as { totalUsage?: Parameters<typeof logUsage>[0]; steps?: unknown[]; finishReason?: string };
      void logUsage(e.totalUsage ?? null, { steps: e.steps?.length ?? null, finish: e.finishReason ?? null, conversation_id: body.conversationId });
    },
    onError: ({ error }) => {
      console.error("[ai] model error", error instanceof Error ? error.message : error);
      void logUsage(null, { error: true, conversation_id: body.conversationId });
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: false,
    onError: (error) => friendlyAiError(error),
    onEnd: async (event) => {
      const responseMessage = (event as unknown as { responseMessage?: UIMessage }).responseMessage;
      if (!responseMessage) return;
      const parts = storableAssistantParts(responseMessage.parts);
      if (!parts.length) return;
      const { error } = await db.from("ai_messages").insert({
        conversation_id: body.conversationId,
        user_id: userId,
        ui_id: responseMessage.id,
        role: "assistant",
        content: textOf(parts),
        parts,
        metadata: { model: config.model },
      });
      if (error) console.error("[ai] could not save assistant message", error.message);
      await db.from("ai_conversations").update({ updated_at: new Date().toISOString(), team_id: teamId }).eq("id", body.conversationId);
    },
  });
}
