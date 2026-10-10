import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardCheck, Folder, MessageCircle } from "lucide-react";
import { BubbleButton, EmptyState, Heading, Panel, Pill } from "@/components/Bubbles";
import { ensureConversation, fetchMessages, fetchMyConversationState, type Announcement, type Assignment, type AssignmentTarget } from "@/lib/locker";
import { pendingPlans } from "@/lib/playerLocker";
import type { TeamEvent } from "@/lib/types";
import { fetchMyNotifications } from "@/lib/notifications";

type Destination = { area: "chat" | "schedule" | "playbook" | "plans"; item?: string; conversation?: string };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function PlayerHub({ teamId, userId, playerId, events, plans, targets, announcements, loading, onOpen }: {
  teamId: string; userId: string | null; playerId: string | null; events: TeamEvent[]; plans: Assignment[]; targets: AssignmentTarget[];
  announcements: Announcement[]; loading: boolean; onOpen: (destination: Destination) => void;
}) {
  const conversation = useQuery({ queryKey: ["conversation", teamId, "team"], queryFn: () => ensureConversation(teamId, "team"), enabled: !!teamId });
  const messages = useQuery({ queryKey: ["messages", conversation.data], queryFn: () => fetchMessages(String(conversation.data)), enabled: !!conversation.data, refetchInterval: 15000 });
  const read = useQuery({ queryKey: ["conversation-read", conversation.data, userId], queryFn: () => fetchMyConversationState(String(conversation.data)), enabled: !!conversation.data });
  const notifications = useQuery({ queryKey: ["player-locker-updates", userId], queryFn: () => fetchMyNotifications(), enabled: !!userId, refetchInterval: 30000 });
  const pending = pendingPlans(plans, targets, userId, playerId);
  const next = [...events].filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= Date.now()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const unread = (messages.data ?? []).filter((m) => !m.deleted_at && m.sender_id !== userId && (!read.data?.last_read_at || m.created_at > read.data.last_read_at));
  const pinned = announcements.filter((a) => a.pinned);
  const updates = (notifications.data ?? []).filter((n) => n.team_id === teamId && !n.read_at && n.related_id && ["event", "play", "playbook_folder", "assignment", "plan"].includes(n.related_type ?? "")).slice(0, 3);
  const latestMessage = unread[unread.length - 1];
  return <div className="flex min-w-0 flex-col gap-3">
    <Panel className="flex flex-col gap-3 border-flame/40 shadow-none">
      <Heading tone="flame">Next</Heading>
      {loading ? <EmptyState>Loading your schedule…</EmptyState> : next ? <>
        <div className="rounded-2xl border border-border/60 bg-surface-2/50 p-3"><p className="text-xl font-black text-foreground">{next.title}</p><p className="mt-2 text-sm font-semibold text-muted-foreground">{when(next.starts_at)}</p>{next.arrival_at ? <p className="mt-1 text-sm font-bold text-foreground">Arrive {when(next.arrival_at)}</p> : null}{next.location ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{next.location}</p> : null}</div>
        <BubbleButton tone="flame" onClick={() => onOpen({ area: "schedule", item: next.id })}>View event</BubbleButton>
      </> : <EmptyState>No upcoming events. Your coach’s next event will appear here.</EmptyState>}
    </Panel>
    <Panel className="flex flex-col gap-3 shadow-none">
      <Heading>Coach Wants You to Review</Heading>
      {loading ? <EmptyState>Loading your plans…</EmptyState> : pending.length ? pending.slice(0, 3).map(({ plan }) => <BubbleButton key={plan.id} tone="neutral" className="min-h-16 justify-between gap-3 whitespace-normal text-left" onClick={() => onOpen({ area: "plans", item: plan.id })}><span className="min-w-0 break-words">{plan.title}</span><span className="shrink-0 text-xs text-muted-foreground">{plan.due_at ? `Due ${new Date(plan.due_at).toLocaleDateString()}` : "Review"}</span></BubbleButton>) : <EmptyState>You’re all caught up. New plans from your coach will appear here.</EmptyState>}
    </Panel>
    {unread.length || pinned.length || updates.length ? <Panel className="flex flex-col gap-2 shadow-none"><Heading tone="flame">New for You</Heading>
      {latestMessage ? <BubbleButton tone="neutral" className="justify-start whitespace-normal text-left" onClick={() => onOpen({ area: "chat", item: latestMessage.id, ...(conversation.data ? { conversation: conversation.data } : {}) })}><MessageCircle className="h-4 w-4 shrink-0"/>{unread.length} unread team message{unread.length === 1 ? "" : "s"}</BubbleButton> : null}
      {updates.map((n) => <BubbleButton key={n.id} tone="neutral" className="justify-start whitespace-normal text-left" onClick={() => onOpen({ area: n.related_type === "event" ? "schedule" : n.related_type === "play" || n.related_type === "playbook_folder" ? "playbook" : "plans", ...(n.related_id ? { item: n.related_id } : {}) })}>{n.title}</BubbleButton>)}
      {pinned.slice(0, 2).map((a) => <BubbleButton key={a.id} tone="neutral" className="justify-start whitespace-normal text-left" onClick={() => onOpen({ area: "chat", item: a.id })}><Pill tone="flame">Pinned</Pill>{a.title}</BubbleButton>)}
    </Panel> : null}
    <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Locker Room areas">{[
      { area: "chat" as const, label: "Team Chat", icon: MessageCircle }, { area: "schedule" as const, label: "Schedule", icon: CalendarDays },
      { area: "playbook" as const, label: "Playbook", icon: Folder }, { area: "plans" as const, label: "Plans", icon: ClipboardCheck },
    ].map(({ area, label, icon: Icon }) => <BubbleButton key={area} tone="neutral" className="min-h-16 gap-2" onClick={() => onOpen({ area })}><Icon className="h-5 w-5 shrink-0"/>{label}</BubbleButton>)}</nav>
  </div>;
}