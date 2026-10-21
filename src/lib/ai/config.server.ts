/**
 * CoachSide AI Assistant server configuration — the ONE place the provider,
 * model and request options live. Server-only: never import from components.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError } from "ai";
import type { Db } from "@/lib/coachside/service";

/** Cost-conscious multimodal model with image/PDF input and tool calling. Override with OPENAI_MODEL. */
export const DEFAULT_AI_MODEL = "gpt-5-mini";

export function readAiConfig() {
  const apiKey = process.env["OPENAI_API_KEY"]?.trim() || null;
  const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_AI_MODEL;
  return { apiKey, model, configured: !!apiKey };
}

const isReasoningModel = (model: string) => /^(gpt-5|o\d)/i.test(model);

/** Build the OpenAI Responses model for one request. */
export function createAiModel(apiKey: string, model: string) {
  const openai = createOpenAI({ apiKey });
  return openai.responses(model);
}

/** Provider options for every assistant call (stateless: nothing stored at OpenAI). */
export function aiProviderOptions(model: string) {
  return {
    openai: isReasoningModel(model)
      ? {
          store: false,
          reasoningEffort: "low" as const,
          include: ["reasoning.encrypted_content" as const],
        }
      : { store: false },
  };
}

/**
 * Global on/off switch (Launch QA). No row yet means on. Coaches cannot read
 * the settings row directly; a narrow database function exposes only the flag.
 */
export async function readAssistantEnabled(db: Db): Promise<boolean> {
  const { data, error } = await db.rpc("ai_assistant_enabled");
  if (error) return true;
  return data !== false;
}

/** Plain-language message for any provider failure. Never includes keys or stack traces. */
export function friendlyAiError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "Stopped.";
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (status === 401)
    return "CoachSide AI isn't set up correctly right now. An admin needs to check the AI key.";
  if (status === 403) return "The AI service refused this request.";
  if (status === 404)
    return "The configured AI model isn't available. An admin needs to check the AI settings.";
  if (status === 429) return "CoachSide AI is busy right now. Wait a minute and try again.";
  if (status === 400 && /verif/i.test(text))
    return "The AI provider needs account verification for this model. An admin needs to check the AI settings.";
  if (status === 400)
    return "CoachSide AI couldn't process that request. Try rephrasing, or use a smaller or clearer image.";
  if (status && status >= 500) return "The AI service had a problem. Try again in a moment.";
  if (/timeout|timed out|fetch failed|network/i.test(text))
    return "Couldn't reach the AI service. Check your connection and try again.";
  return "CoachSide AI couldn't finish that. Try again.";
}
