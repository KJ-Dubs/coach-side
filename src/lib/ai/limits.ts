/**
 * CoachSide AI Assistant limits. Browser-safe: the composer uses them for
 * instant feedback, and the server re-enforces every one of them.
 */
export const AI_LIMITS = {
  maxPromptChars: 4000,
  maxAttachments: 4,
  maxImageBytes: 8 * 1024 * 1024,
  maxPdfBytes: 10 * 1024 * 1024,
  /** Messages (user + assistant) replayed to the model per request. */
  historyMessages: 16,
  /** Model ↔ tool round trips per request. */
  maxSteps: 6,
  requestsPer10Min: 30,
  requestsPerDay: 200,
  maxExtractedEvents: 40,
  maxExtractedPlayers: 50,
  /** Below this the row is flagged for coach review. */
  reviewConfidence: 0.6,
} as const;

export const AI_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AI_FILE_TYPES = [...AI_IMAGE_TYPES, "application/pdf"] as const;
export const AI_ACCEPT = AI_FILE_TYPES.join(",");

export function isAllowedAttachmentType(mediaType: string): boolean {
  return (AI_FILE_TYPES as readonly string[]).includes(mediaType);
}

export function maxBytesFor(mediaType: string): number {
  return mediaType === "application/pdf" ? AI_LIMITS.maxPdfBytes : AI_LIMITS.maxImageBytes;
}

/** Decoded size of a base64 data URL, in bytes. */
export function dataUrlBytes(url: string): number {
  const comma = url.indexOf(",");
  const b64 = comma >= 0 ? url.slice(comma + 1) : url;
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

/** Tool names that stage a change for coach confirmation. */
export const PROPOSE_TOOLS = [
  "propose_schedule_events",
  "propose_schedule_update",
  "propose_players",
  "propose_player_update",
  "propose_team",
] as const;
export type ProposeToolName = (typeof PROPOSE_TOOLS)[number];

export type AiActionKind = "schedule_create" | "schedule_update" | "roster_add" | "player_update" | "team_create";
export type AiActionStatus = "pending" | "confirmed" | "partial" | "failed" | "cancelled";

export const AI_SUGGESTED_PROMPTS = [
  "Add players to my roster",
  "Upload a schedule",
  "What games are coming up?",
  "Build a practice plan",
  "Ask a basketball question",
] as const;
