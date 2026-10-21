import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ChevronDownIcon,
  FileTextIcon,
  ImageIcon,
  MinusIcon,
  PaperclipIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import aiMark from "@/assets/coachside-ai-mark.png";
import { InfoPanel, Pill } from "@/components/Bubbles";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { AiActionCard } from "@/components/ai/AiActionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { AI_ACCEPT, AI_LIMITS, AI_SUGGESTED_PROMPTS } from "@/lib/ai/limits";
import { useCurrentTeam } from "@/lib/teamContext";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READ_TOOL_TITLES: Record<string, string> = {
  list_teams: "Checked your teams",
  get_roster: "Checked the roster",
  list_schedule: "Checked the schedule",
};

async function loadConversation(conversationId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("ui_id,role,parts,created_at")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.ui_id,
    role: r.role as "user" | "assistant",
    parts: r.parts as UIMessage["parts"],
  }));
}

function friendlyError(error: Error | undefined): string | null {
  if (!error) return null;
  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    /* plain text */
  }
  if (/failed to fetch|network/i.test(error.message))
    return "Couldn't reach CoachSide. Check your connection and try again.";
  return error.message && error.message.length < 240
    ? error.message
    : "CoachSide AI couldn't finish that. Try again.";
}

export default function AiAssistantPanel({
  open,
  onOpenChange,
  available,
  configured,
  initialPrompt,
  onPromptUsed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  available: boolean;
  configured: boolean;
  initialPrompt: string | null;
  onPromptUsed: () => void;
}) {
  const { user } = useAuth();
  const { access } = useAccess();
  const current = useCurrentTeam();
  const coachTeams = useMemo(
    () => current.teams.filter((t) => access.coachTeamIds.includes(t.id)),
    [current.teams, access.coachTeamIds],
  );
  const [teamId, setTeamId] = useState<string | null>(null);
  useEffect(() => {
    if (teamId && coachTeams.some((t) => t.id === teamId)) return;
    const preferred = coachTeams.find((t) => t.id === current.teamId) ?? coachTeams[0] ?? null;
    setTeamId(preferred?.id ?? null);
  }, [coachTeams, current.teamId, teamId]);
  const team = coachTeams.find((t) => t.id === teamId) ?? null;

  // Only a pointer to the coach's own conversation lives on the device; the
  // messages load from the database under row security.
  const storageKey = user ? `coachside.ai.conversation.${user.id}` : null;
  const [conversationId, setConversationId] = useState<string | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    let id: string | null = null;
    try {
      id = window.localStorage.getItem(storageKey);
    } catch {
      /* private mode */
    }
    if (!id || !UUID.test(id)) {
      id = crypto.randomUUID();
      try {
        window.localStorage.setItem(storageKey, id);
      } catch {
        /* private mode */
      }
    }
    setConversationId(id);
  }, [storageKey]);

  const history = useQuery({
    queryKey: ["ai-messages", conversationId],
    queryFn: () => loadConversation(conversationId!),
    enabled: !!conversationId && available,
    staleTime: Infinity,
  });

  const qc = useQueryClient();
  const startNewChat = () => {
    const id = crypto.randomUUID();
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, id);
      } catch {
        /* private mode */
      }
    }
    qc.setQueryData(["ai-messages", id], []);
    setConversationId(id);
  };
  const resetChat = async () => {
    if (!conversationId) return;
    if (
      !window.confirm(
        "Clear this conversation? Your teams, rosters and schedules stay as they are.",
      )
    )
      return;
    await supabase.from("ai_conversations").delete().eq("id", conversationId);
    qc.removeQueries({ queryKey: ["ai-messages", conversationId] });
    startNewChat();
  };

  // The panel stays mounted while minimized so the conversation, a reply that
  // is still streaming, and a half-typed message all survive. Minimizing only
  // hides it.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const phone = window.matchMedia("(max-width: 639px)").matches;
    const prevOverflow = document.body.style.overflow;
    if (phone) document.body.style.overflow = "hidden";
    // Keep the phone keyboard closed until the coach taps the box.
    if (!window.matchMedia("(pointer: coarse)").matches) {
      window.setTimeout(() => {
        const box = panelRef.current?.querySelector<HTMLTextAreaElement>("[data-ai-composer] textarea");
        (box ?? panelRef.current)?.focus();
      }, 30);
    } else {
      panelRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      {open ? (
        <div
          aria-hidden
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm animate-in fade-in-0 sm:hidden"
        />
      ) : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={false}
        aria-labelledby="coachside-ai-title"
        aria-describedby="coachside-ai-subtitle"
        tabIndex={-1}
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onOpenChange(false);
          }
        }}
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-background shadow-2xl shadow-black/60 outline-none",
          // Phone: near-fullscreen sheet rising from the bottom.
          "inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))] rounded-t-3xl border-t border-border/70",
          // Tablet/desktop: compact floating panel in the bottom-right corner.
          "sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:h-[min(720px,calc(100dvh-2rem))] sm:w-[420px] sm:rounded-3xl sm:border sm:border-grape/40",
          "animate-in fade-in-0 slide-in-from-bottom-4",
          !open && "hidden",
        )}
      >
        <header className="flex flex-col gap-1.5 border-b border-border/70 bg-surface/90 px-3 pb-2 pt-2.5">
          <div className="flex items-center gap-2">
            <img
              src={aiMark}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <h2 id="coachside-ai-title" className="text-sm font-black leading-tight text-foreground">
                CoachSide AI Assistant
              </h2>
              <p id="coachside-ai-subtitle" className="text-[11px] font-semibold leading-snug text-muted-foreground">
                Ask about your team, roster, schedule, plays, stats, or basketball.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Minimize CoachSide AI Assistant"
              title="Minimize"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2/70 text-foreground hover:border-grape/60"
            >
              <ChevronDownIcon className="h-5 w-5 sm:hidden" />
              <MinusIcon className="hidden h-5 w-5 sm:block" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {coachTeams.length > 1 ? (
              <label className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-grape/50 bg-grape/15 pl-3 pr-1 text-xs font-black text-foreground">
                Using:
                <select
                  value={teamId ?? ""}
                  onChange={(e) => setTeamId(e.target.value)}
                  aria-label="Team the assistant should use"
                  className="min-h-8 max-w-[160px] truncate rounded-full border-none bg-transparent pr-1 text-xs font-black text-foreground outline-none"
                >
                  {coachTeams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-popover text-foreground">
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Pill tone="grape">{team ? `Using: ${team.name}` : "No team yet"}</Pill>
            )}
            <div className="ml-auto flex gap-1.5">
              <button
                type="button"
                onClick={startNewChat}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface-2/70 px-3 text-xs font-black text-foreground hover:border-grape/60"
              >
                <PlusIcon className="h-3.5 w-3.5" /> New chat
              </button>
              <button
                type="button"
                onClick={() => void resetChat()}
                aria-label="Clear this conversation"
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface-2/70 px-3 text-xs font-black text-muted-foreground hover:border-destructive/60"
              >
                <RotateCcwIcon className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          </div>
        </header>

        {!available ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
            <img src={aiMark} alt="" width={64} height={64} className="h-16 w-16 object-contain opacity-80" />
            <InfoPanel tone="grape" className="text-center">
              {configured
                ? "CoachSide AI is turned off right now. Check back soon."
                : "CoachSide AI is still being set up. Check back soon."}
            </InfoPanel>
          </div>
        ) : !conversationId || history.isLoading ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <Pill tone="muted">Loading your conversation…</Pill>
          </div>
        ) : (
          <PromptInputProvider key={conversationId}>
            <ChatWindow
              conversationId={conversationId}
              initialMessages={history.data ?? []}
              teamId={teamId}
              initialPrompt={initialPrompt}
              onPromptUsed={onPromptUsed}
            />
          </PromptInputProvider>
        )}
      </div>
    </>
  );
}

function ChatWindow({
  conversationId,
  initialMessages,
  teamId,
  initialPrompt,
  onPromptUsed,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  teamId: string | null;
  initialPrompt: string | null;
  onPromptUsed: () => void;
}) {
  const teamRef = useRef(teamId);
  teamRef.current = teamId;
  const controller = usePromptInputController();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: {
              conversationId,
              teamId: teamRef.current,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              message: messages[messages.length - 1],
            },
          };
        },
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  const sentInitial = useRef(false);
  useEffect(() => {
    if (!initialPrompt || sentInitial.current) return;
    sentInitial.current = true;
    onPromptUsed();
    void sendMessage({ text: initialPrompt });
  }, [initialPrompt, onPromptUsed, sendMessage]);

  const focusBox = () =>
    document.querySelector<HTMLTextAreaElement>("[data-ai-composer] textarea")?.focus();
  useEffect(() => {
    if (status === "ready" && !window.matchMedia("(pointer: coarse)").matches) focusBox();
  }, [status]);

  const suggest = (label: (typeof AI_SUGGESTED_PROMPTS)[number]) => {
    if (label === "What games are coming up?") {
      void sendMessage({ text: "What games do we have coming up?" });
      return;
    }
    if (label === "Upload a schedule") {
      controller.textInput.setInput("Add these games to my calendar.");
      controller.attachments.openFileDialog();
      return;
    }
    const text =
      label === "Add players to my roster"
        ? "Add these players: "
        : label === "Build a practice plan"
          ? "Build a 90-minute practice plan for "
          : "How should I teach closeouts?";
    controller.textInput.setInput(text);
    window.setTimeout(focusBox, 30);
  };

  const errorText = friendlyError(error);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 px-3 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <img
                src={aiMark}
                alt=""
                width={72}
                height={72}
                className="h-[72px] w-[72px] object-contain"
              />
              <InfoPanel tone="grape" className="text-center">
                Ask for roster changes, schedule updates, upcoming games, or coaching help. Snap a
                photo of a schedule or roster and I'll set it up for you to review.
              </InfoPanel>
              <div className="flex flex-wrap justify-center gap-1.5">
                {AI_SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => suggest(p)}
                    className="min-h-11 rounded-full border border-grape/50 bg-grape/10 px-3 text-xs font-black text-foreground hover:bg-grape/25"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}
          {status === "submitted" ? (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          ) : null}
          {errorText ? (
            <InfoPanel tone="danger" className="flex flex-wrap items-center justify-between gap-2">
              <span>{errorText}</span>
              <button
                type="button"
                onClick={clearError}
                className="min-h-9 rounded-full border border-border bg-surface-2/70 px-3 text-xs font-black text-foreground"
              >
                Dismiss
              </button>
            </InfoPanel>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div
        data-ai-composer
        className="border-t border-border/70 bg-surface/90 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <PromptInput
          accept={AI_ACCEPT}
          multiple
          maxFiles={AI_LIMITS.maxAttachments}
          maxFileSize={AI_LIMITS.maxPdfBytes}
          onError={(e) =>
            toast.error(
              e.code === "max_file_size"
                ? "That file is too large (images up to 8 MB, PDFs up to 10 MB)."
                : e.code === "accept"
                  ? "Only JPG, PNG, WebP images or PDF files."
                  : `Attach up to ${AI_LIMITS.maxAttachments} files.`,
            )
          }
          onSubmit={async ({ text, files }) => {
            if (busy) return;
            const trimmed = text.trim();
            if (!trimmed && !files.length) return;
            if (trimmed.length > AI_LIMITS.maxPromptChars) {
              toast.error(`Keep messages under ${AI_LIMITS.maxPromptChars} characters.`);
              return;
            }
            const big = files.find(
              (f) =>
                f.mediaType !== "application/pdf" &&
                (f.url.length * 3) / 4 > AI_LIMITS.maxImageBytes,
            );
            if (big) {
              toast.error("Images can be up to 8 MB.");
              return;
            }
            clearError();
            await sendMessage({
              text: trimmed || (files.length ? "Please read this upload." : ""),
              files,
            });
          }}
          className="rounded-2xl border border-border/70 bg-surface-2/70"
        >
          <PromptInputHeader className="empty:hidden">
            <ComposerAttachments />
          </PromptInputHeader>
          <PromptInputTextarea placeholder="Ask CoachSide AI…" className="min-h-12 text-base" />
          <PromptInputFooter className="justify-between">
            <PromptInputTools>
              <PromptInputButton
                aria-label="Attach a photo or PDF"
                onClick={() => controller.attachments.openFileDialog()}
                className="h-11 w-11"
              >
                <PaperclipIcon className="h-5 w-5" />
              </PromptInputButton>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={() => void stop()} className="h-11 w-11" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function ComposerAttachments() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return (
    <div className="flex w-full flex-wrap gap-1.5 p-1">
      {attachments.files.map((f) => (
        <span
          key={f.id}
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-grape/50 bg-grape/15 pl-1 pr-1 text-xs font-bold text-foreground"
        >
          {f.mediaType?.startsWith("image/") ? (
            <img src={f.url} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <FileTextIcon className="ml-1.5 h-4 w-4" />
          )}
          <span className="max-w-[140px] truncate">{f.filename ?? "Upload"}</span>
          <button
            type="button"
            aria-label={`Remove ${f.filename ?? "attachment"}`}
            onClick={() => attachments.remove(f.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-background/60"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

type AnyPart = { type: string; [k: string]: unknown };

function ChatMessage({ message }: { message: UIMessage }) {
  const parts = message.parts as unknown as AnyPart[];
  if (message.role === "user") {
    const text = parts
      .filter((p) => p.type === "text")
      .map((p) => String(p["text"] ?? ""))
      .join("\n");
    const files = parts.filter((p) => p.type === "file" || p.type === "data-attachment");
    return (
      <Message from="user">
        <MessageContent className="rounded-2xl bg-primary px-3 py-2 text-primary-foreground">
          {files.length ? (
            <div className="mb-1 flex flex-wrap gap-1">
              {files.map((f, i) => {
                const meta = (f.type === "file" ? f : (f["data"] as AnyPart | undefined)) ?? f;
                const isImage = String(meta["mediaType"] ?? "").startsWith("image/");
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-background/20 px-2 py-0.5 text-xs font-bold"
                  >
                    {isImage ? (
                      <ImageIcon className="h-3 w-3" />
                    ) : (
                      <FileTextIcon className="h-3 w-3" />
                    )}
                    {String(meta["filename"] ?? "Upload")}
                  </span>
                );
              })}
            </div>
          ) : null}
          {text ? <p className="whitespace-pre-wrap text-sm font-semibold">{text}</p> : null}
        </MessageContent>
      </Message>
    );
  }
  return (
    <Message from="assistant">
      <MessageContent className="w-full gap-2 bg-transparent p-0 text-foreground">
        {parts.map((p, i) => {
          if (p.type === "text")
            return <MessageResponse key={i}>{String(p["text"] ?? "")}</MessageResponse>;
          if (p.type.startsWith("tool-propose_")) {
            const out = p["output"] as
              { action_id?: string; error?: { message: string } } | undefined;
            if (p["state"] === "output-available" && out?.action_id)
              return <AiActionCard key={i} actionId={out.action_id} />;
            if (p["state"] === "output-available" && out?.error) {
              return (
                <InfoPanel key={i} tone="danger" className="text-sm">
                  {out.error.message}
                </InfoPanel>
              );
            }
            return (
              <Pill key={i} tone="muted">
                Preparing a preview…
              </Pill>
            );
          }
          if (p.type.startsWith("tool-")) {
            const name = p.type.slice(5);
            const part = p as unknown as ToolPart;
            return (
              <Tool
                key={i}
                defaultOpen={false}
                className="mb-0 rounded-2xl border-border/70 bg-surface-2/40"
              >
                <ToolHeader
                  type={part.type as never}
                  state={part.state}
                  title={READ_TOOL_TITLES[name] ?? "Checked CoachSide"}
                />
                <ToolContent>
                  <ToolInput input={part.input} />
                  <ToolOutput output={part.output} errorText={part.errorText} />
                </ToolContent>
              </Tool>
            );
          }
          return null;
        })}
      </MessageContent>
    </Message>
  );
}
