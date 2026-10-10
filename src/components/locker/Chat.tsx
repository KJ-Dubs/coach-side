import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BubbleButton, EmptyState, Note, Pill } from "@/components/Bubbles";
import { notifyProgressChanged } from "@/lib/activity";
import { AttachmentCard, AttachmentPicker } from "@/components/locker/Attachments";
import {
  deleteMessage,
  editMessage,
  fetchMessages,
  markConversationRead,
  sendMessage,
  setMessagePinned,
  toggleReaction,
  TEAM_ROLE_LABEL,
  type DirectoryEntry,
  type NewAttachment,
} from "@/lib/locker";
import { cn } from "@/lib/utils";

const REACTIONS = ["🔥", "💪", "👍", "🏀"];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Chat({
  conversationId,
  teamId,
  directory,
  meId,
  canPost,
  canAttach,
  disabledNote,
  meName,
  meRoleLabel,
  canPin = false,
  simple = false,
  focusId,
}: {
  conversationId: string;
  teamId: string | null;
  directory: DirectoryEntry[];
  meId: string | null;
  canPost: boolean;
  canAttach: boolean;
  disabledNote?: string;
  meName?: string;
  meRoleLabel?: string;
  canPin?: boolean;
  simple?: boolean;
  focusId?: string | undefined;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<NewAttachment[]>([]);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => fetchMessages(conversationId),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!messages.data) return;
    void markConversationRead(conversationId).then(() => qc.invalidateQueries({ queryKey: ["conversation-read", conversationId] })).catch(() => undefined);
  }, [conversationId, messages.data, qc]);

  useEffect(() => {
    if (focusId) document.getElementById(`locker-message-${focusId}`)?.scrollIntoView({ block: "center" });
    else if (!simple) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length, focusId, simple]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["messages", conversationId] });

  const send = useMutation({
    mutationFn: () => sendMessage({ conversationId, body: body.trim(), attachments }),
    onSuccess: async () => {
      notifyProgressChanged();
      setBody("");
      setAttachments([]);
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEdit = useMutation({
    mutationFn: () => { if (!editing) throw new Error("No message selected"); return editMessage(editing.id, editing.body.trim()); },
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const react = useMutation({
    mutationFn: (v: { id: string; emoji: string; mine: boolean }) =>
      toggleReaction(v.id, v.emoji, v.mine),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const pin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => setMessagePinned(v.id, v.pinned),
    onSuccess: () => { notifyProgressChanged(); return invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const who = (userId: string) => directory.find((d) => d.user_id === userId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[58vh] flex-col gap-3 overflow-y-auto rounded-3xl border border-border/70 bg-background/60 p-2 sm:p-3">
        {messages.isLoading ? (
          <EmptyState>Loading messages…</EmptyState>
        ) : (messages.data ?? []).length === 0 ? (
           <EmptyState>{canPost ? "No messages yet. Start the conversation." : "Your coach’s messages will appear here."}</EmptyState>
        ) : (
          [...(messages.data ?? [])].sort((a, b) => {
            if (!!a.pinned_at !== !!b.pinned_at) return a.pinned_at ? -1 : 1;
            return a.created_at.localeCompare(b.created_at);
          }).map((m) => {
            const person = who(m.sender_id);
            const mine = m.sender_id === meId;
            const coach = person?.role === "head_coach" || person?.role === "assistant_coach";
            return (
              <div
                key={m.id}
                id={`locker-message-${m.id}`}
                className={cn("flex w-full rounded-2xl", m.id === focusId && "ring-2 ring-flame", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "flex max-w-[92%] flex-col gap-2 rounded-3xl border p-3 shadow-lg shadow-black/30 sm:max-w-[80%]",
                    coach
                      ? "border-flame/60 bg-flame/15"
                      : "border-grape/50 bg-grape/15",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={coach ? "flame" : "grape"}>
                      {person?.jersey ? `#${person.jersey} ` : ""}
                      {person?.full_name ??
                        person?.player_name ??
                        person?.email ??
                        (mine ? (meName ?? "You") : "Team member")}
                    </Pill>
                    {!simple ? <Pill tone="muted">
                      {person
                        ? TEAM_ROLE_LABEL[person.role]
                        : (mine ? (meRoleLabel ?? "Coach") : "Member")}
                    </Pill> : null}
                    <Pill tone="muted">{fmtTime(m.created_at)}</Pill>
                    {m.pinned_at ? <Pill tone="flame">Pinned</Pill> : null}
                    {m.edited_at && !m.deleted_at ? <Pill tone="muted">Edited</Pill> : null}
                  </div>

                  {m.deleted_at ? (
                    <Note>This message was deleted</Note>
                  ) : editing?.id === m.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editing.body}
                        onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                        className="min-h-20 w-full rounded-2xl border border-input bg-surface-2/80 px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-grape"
                      />
                      <div className="flex gap-2">
                        <BubbleButton size="sm" tone="grape" onClick={() => saveEdit.mutate()}>
                          Save
                        </BubbleButton>
                        <BubbleButton size="sm" tone="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </BubbleButton>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-border/50 bg-background/50 px-3 py-2 text-base font-semibold leading-relaxed text-foreground">
                      {m.body}
                    </p>
                  )}

                  {m.attachments.map((a) => (
                    <AttachmentCard key={a.id} attachment={a} teamId={teamId} />
                  ))}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {REACTIONS.map((emoji) => {
                      const list = m.reactions.filter((r) => r.reaction === emoji);
                      const mineReact = list.some((r) => r.user_id === meId);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={`React ${emoji}`}
                          onClick={() =>
                            react.mutate({ id: m.id, emoji, mine: mineReact })
                          }
                          className={cn(
                             "inline-flex min-h-11 items-center gap-1 rounded-full border px-3 py-1 text-sm font-bold",
                            mineReact
                              ? "border-flame/70 bg-flame/25 text-foreground"
                              : "border-border bg-surface-2/70 text-muted-foreground",
                          )}
                        >
                          {emoji}
                          {list.length ? <span>{list.length}</span> : null}
                        </button>
                      );
                    })}
                    {mine && !m.deleted_at ? (
                      <>
                        <BubbleButton
                          size="sm"
                          tone="ghost"
                          onClick={() => setEditing({ id: m.id, body: m.body })}
                        >
                          Edit
                        </BubbleButton>
                        <BubbleButton size="sm" tone="ghost" onClick={() => remove.mutate(m.id)}>
                          Delete
                        </BubbleButton>
                      </>
                    ) : null}
                    {canPin && !m.deleted_at ? (
                      <BubbleButton size="sm" tone={m.pinned_at ? "flame" : "ghost"} onClick={() => pin.mutate({ id: m.id, pinned: !m.pinned_at })}>
                        {m.pinned_at ? "Unpin" : "Pin"}
                      </BubbleButton>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {canPost ? (
        <div className="flex flex-col gap-2 rounded-3xl border border-border/70 bg-surface/80 p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={simple ? "Write a message…" : "Write a message to the team…"}
            aria-label="Message"
            className="min-h-20 w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-grape"
          />
          {canAttach ? <AttachmentPicker teamId={teamId} value={attachments} onChange={setAttachments} compact /> : null}
          <BubbleButton
            tone="grape"
            size="lg"
            disabled={!body.trim() || send.isPending}
            onClick={() => send.mutate()}
          >
            Send message
          </BubbleButton>
        </div>
      ) : (
        <Note>{disabledNote ?? "Only coaches can post here right now."}</Note>
      )}
    </div>
  );
}
