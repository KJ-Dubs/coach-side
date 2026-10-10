import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardCheck, Folder, MessageCircle, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { PlayerHub } from "@/components/locker/PlayerHub";
import { PlayThumb } from "@/components/community/PlayThumb";
import { personalPlans } from "@/lib/playerLocker";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, Field, Heading, Label, Panel, Pill, SelectInput, TextInput } from "@/components/Bubbles";
import { notifyProgressChanged } from "@/lib/activity";
import { Chat } from "@/components/locker/Chat";
import { AttachmentCard, AttachmentPicker } from "@/components/locker/Attachments";
import { MonthCalendar, dayKey, type MonthDot } from "@/components/MonthCalendar";
import { GoogleCalendarPanel } from "@/components/GoogleCalendarPanel";
import {
  createPlaybookFolder, deletePlaybookFolder, fetchPlaybookFolders, fetchPlayFolderMemberships,
  deleteTeamEvent, fetchPlayers, fetchTeamEvents, fetchTeamPlays, logoSignedUrl, renamePlaybookFolder,
  setPlayFolderMembership,
} from "@/lib/data";
import {
  createAssignment, deleteAssignment, ensureConversation, ensureDirectConversation,
  ensurePlayerCoachesConversation, fetchAnnouncements, fetchAssignments, fetchAssignmentTargets,
  fetchTeamDirectory, setAssignmentStatus, TEAM_ROLE_LABEL, type NewAttachment,
} from "@/lib/locker";
import { EVENT_TYPE_LABEL, type TeamEvent } from "@/lib/types";
import { useLocker } from "@/lib/useLocker";
import { EventForm } from "./calendar";

type Area = "chat" | "schedule" | "playbook" | "plans";

export const Route = createFileRoute("/_authenticated/lockerroom")({
  validateSearch: (s: Record<string, unknown>): { area?: Area; item?: string; folder?: string; team?: string; conversation?: string } => {
    const parsed: { area?: Area; item?: string; folder?: string; team?: string; conversation?: string } = {};
    if ((["chat", "schedule", "playbook", "plans"] as string[]).includes(String(s["area"]))) parsed.area = s["area"] as Area;
    if (typeof s["item"] === "string") parsed.item = s["item"];
    if (typeof s["folder"] === "string") parsed.folder = s["folder"];
    if (typeof s["conversation"] === "string") parsed.conversation = s["conversation"];
    if (typeof s["team"] === "string") parsed.team = s["team"];
    return parsed;
  },
  head: () => ({ meta: [
    { title: "Locker Room Team Hub — CoachSide" },
    { name: "description", content: "Team Chat, Schedule, Playbook and Plans for your basketball team." },
    { property: "og:title", content: "Locker Room Team Hub — CoachSide" },
    { property: "og:description", content: "Your team’s messages, schedule, plays and plans in one hub." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LockerRoomPage,
});

const fmtWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function LockerRoomPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [teamId, setTeamId] = useState(search.team ?? "");
  const locker = useLocker(teamId || null);
  useEffect(() => { if (search.team && locker.teams.some((t) => t.id === search.team)) setTeamId(search.team); else if (locker.teams.length && !locker.teams.some((t) => t.id === teamId)) setTeamId(locker.teams[0]?.id ?? ""); }, [locker.teams, teamId, search.team]);
  const team = locker.teams.find((t) => t.id === teamId) ?? null;
  const area = search.area;

  const directory = useQuery({ queryKey: ["team-directory", teamId], queryFn: () => fetchTeamDirectory(teamId), enabled: !!teamId });
  const events = useQuery({ queryKey: ["team-events", teamId], queryFn: () => fetchTeamEvents(teamId), enabled: !!teamId });
  const plays = useQuery({ queryKey: ["team-plays", teamId], queryFn: () => fetchTeamPlays(teamId), enabled: !!teamId && !locker.isParent });
  const assignments = useQuery({ queryKey: ["assignments", teamId], queryFn: () => fetchAssignments(teamId), enabled: !!teamId && !locker.isParent });
  const targets = useQuery({ queryKey: ["assignment-targets", teamId, assignments.data?.length], queryFn: () => fetchAssignmentTargets((assignments.data ?? []).map((a) => a.id)), enabled: !!assignments.data?.length });
  const announcements = useQuery({ queryKey: ["announcements", teamId], queryFn: () => fetchAnnouncements(teamId), enabled: !!teamId && !locker.isParent });
  const logo = useQuery({ queryKey: ["team-logo", team?.logo_url], queryFn: () => logoSignedUrl(team?.logo_url), enabled: !!team?.logo_url });
  const upcoming = (events.data ?? []).filter((e) => new Date(e.starts_at).getTime() >= Date.now() - 3600000);
  const openPlans = (assignments.data ?? []).filter((a) => !(targets.data ?? []).some((t) => t.assignment_id === a.id && (t.user_id === locker.user?.id || t.player_id === locker.playerId) && t.status === "completed")).length;

  useEffect(() => { if (!search.item) return; const timer = setTimeout(() => document.getElementById(`locker-item-${search.item}`)?.scrollIntoView({ block: "center" }), 100); return () => clearTimeout(timer); }, [search.item, search.area, assignments.data, events.data, plays.data, announcements.data]);

  if (locker.loading || (!teamId && locker.teams.length > 0)) return <AppShell title="Locker Room"><Panel><EmptyState>Opening your team…</EmptyState></Panel></AppShell>;
  if (!locker.loading && !locker.teams.length) return <AppShell title="Locker Room" subtitle="Your team hub"><Panel><EmptyState>You are not on a team yet. Ask your coach for the team invite link.</EmptyState></Panel></AppShell>;
  if (locker.isParent) return <AppShell title="Locker Room" subtitle="Family access"><Panel><EmptyState>Private team chat, Playbook and Plans are available to coaches and players. Use your team’s parent link for Stats and Schedule.</EmptyState></Panel></AppShell>;

  const go = (next?: Area) => navigate({ to: "/lockerroom", search: next ? { area: next, team: teamId } : { team: teamId } });
  return <AppShell title="Locker Room" subtitle={area ? ({ chat: "Team Chat", schedule: "Schedule", playbook: "Playbook", plans: "Plans" }[area]) : "Your team hub"} logoUrl={logo.data ?? null} wide>
    {!locker.isPlayer || locker.teams.length > 1 ? <Panel className="mb-3 flex flex-wrap items-center gap-2">
      <Label>Team</Label><SelectInput value={teamId} onChange={(e) => { const next = e.target.value; setTeamId(next); void navigate({ to: "/lockerroom", search: { ...(search.area ? { area: search.area } : {}), ...(search.item ? { item: search.item } : {}), ...(search.folder ? { folder: search.folder } : {}), team: next } }); }} className="max-w-xs">{locker.teams.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.season}</option>)}</SelectInput>
      {locker.isCoach && locker.role ? <Pill tone="flame">{TEAM_ROLE_LABEL[locker.role]}</Pill> : null}
      {locker.isCoach ? <Link to="/settings" className="inline-flex min-h-11 items-center rounded-full border border-grape/60 bg-grape/20 px-4 text-sm font-black text-foreground">Invite links &amp; access</Link> : null}
    </Panel> : null}
    {area ? <BubbleButton tone="ghost" className="mb-3" onClick={() => go()}>← Back to Locker Room</BubbleButton> : null}
    {!area && locker.isPlayer ? <PlayerHub teamId={teamId} userId={locker.user?.id ?? null} playerId={locker.playerId} events={events.data ?? []} plans={assignments.data ?? []} targets={targets.data ?? []} announcements={announcements.data ?? []} loading={events.isPending || assignments.isPending || (Boolean(assignments.data?.length) && targets.isPending)} onOpen={(destination) => { void navigate({ to: "/lockerroom", search: { ...destination, team: teamId } }); }} /> : null}
    {!area && !locker.isPlayer ? <Hub events={upcoming} plays={plays.data?.length ?? 0} plans={openPlans} pinned={announcements.data?.filter((a) => a.pinned).length ?? 0} onOpen={go} /> : null}
    {area === "chat" ? <ChatArea key={teamId} focusId={search.item} conversationId={search.conversation} teamId={teamId} locker={locker} directory={directory.data ?? []} announcements={announcements.data ?? []} allowPlayerPosting={team?.allow_player_posting !== false} /> : null}
    {area === "schedule" && team ? <ScheduleArea key={`${teamId}-${search.item ?? ""}`} teamId={teamId} team={team} events={events.data ?? []} isCoach={locker.isCoach} focusId={search.item} /> : null}
    {area === "playbook" ? <PlaybookArea key={`${teamId}-${search.folder ?? ""}`} focusId={search.item} teamId={teamId} plays={plays.data ?? []} isCoach={locker.isCoach} initialFolder={search.folder} /> : null}
    {area === "plans" ? <PlansArea key={teamId} teamId={teamId} assignments={assignments.data ?? []} targets={targets.data ?? []} players={directory.data ?? []} isCoach={locker.isCoach} userId={locker.user?.id ?? null} playerId={locker.playerId} focusId={search.item} onChanged={() => { void qc.invalidateQueries({ queryKey: ["assignments", teamId] }); void qc.invalidateQueries({ queryKey: ["assignment-targets", teamId] }); }} /> : null}
  </AppShell>;
}

function Hub({ events, plays, plans, pinned, onOpen }: { events: TeamEvent[]; plays: number; plans: number; pinned: number; onOpen: (a: Area) => void }) {
  const cards = [
    { id: "chat" as const, icon: MessageCircle, title: "Team Chat", detail: pinned ? `${pinned} pinned update${pinned === 1 ? "" : "s"}` : "Messages from your team", tone: "border-grape/60 bg-grape/15" },
    { id: "schedule" as const, icon: CalendarDays, title: "Schedule", detail: events[0] ? `${events[0].title} · ${fmtWhen(events[0].starts_at)}` : "No upcoming events", tone: "border-flame/60 bg-flame/15" },
    { id: "playbook" as const, icon: Folder, title: "Playbook", detail: `${plays} team play${plays === 1 ? "" : "s"}`, tone: "border-grape/60 bg-surface-2/80" },
    { id: "plans" as const, icon: ClipboardCheck, title: "Plans", detail: `${plans} open plan${plans === 1 ? "" : "s"}`, tone: "border-flame/60 bg-surface-2/80" },
  ];
  return <div className="grid gap-3 sm:grid-cols-2">{cards.map(({ id, icon: Icon, title, detail, tone }) => <button key={id} type="button" onClick={() => onOpen(id)} className={`flex min-h-40 flex-col items-start justify-between rounded-2xl border p-5 text-left transition-transform hover:-translate-y-0.5 ${tone}`}><Icon className="h-8 w-8 text-foreground"/><span className="rounded-2xl border border-border/70 bg-background/60 px-3 py-2 text-2xl font-black text-foreground">{title}</span><span className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-sm font-bold text-muted-foreground">{detail}</span></button>)}</div>;
}

function ChatArea({ teamId, locker, directory, announcements, allowPlayerPosting, focusId, conversationId }: { focusId?: string; conversationId?: string; teamId: string; locker: ReturnType<typeof useLocker>; directory: Awaited<ReturnType<typeof fetchTeamDirectory>>; announcements: Awaited<ReturnType<typeof fetchAnnouncements>>; allowPlayerPosting: boolean }) {
  const [sub, setSub] = useState<"team" | "messages">(conversationId ? "messages" : "team");
  const [other, setOther] = useState("");
  const teamConv = useQuery({ queryKey: ["conversation", teamId, "team"], queryFn: () => ensureConversation(teamId, "team"), enabled: !!teamId });
  const staffConv = useQuery({ queryKey: ["conversation", teamId, "staff"], queryFn: () => ensureConversation(teamId, "staff"), enabled: !!teamId && locker.isCoach });
  const playerCoachConv = useQuery({ queryKey: ["player-coaches", teamId, locker.playerId], queryFn: () => ensurePlayerCoachesConversation(teamId, String(locker.playerId)), enabled: !!teamId && locker.isPlayer && !!locker.playerId });
  const direct = useQuery({ queryKey: ["direct", teamId, other], queryFn: () => ensureDirectConversation(teamId, other), enabled: locker.isCoach && !!other });
  useEffect(() => { if (conversationId) setSub(conversationId === teamConv.data ? "team" : "messages"); }, [conversationId, teamConv.data]);
  const players = directory.filter((d) => d.role === "player" && d.user_id !== locker.user?.id);
  return <div className="flex flex-col gap-3">
    <Panel className="flex flex-wrap gap-2"><BubbleButton tone={sub === "team" ? "grape" : "neutral"} onClick={() => setSub("team")}>Team Chat</BubbleButton><BubbleButton tone={sub === "messages" ? "flame" : "neutral"} onClick={() => setSub("messages")}>{locker.isCoach ? "Messages" : "Message Coaches"}</BubbleButton></Panel>
    {sub === "team" ? <>
      {announcements.filter((a) => a.pinned).length ? <Panel className="flex flex-col gap-2"><div className="flex gap-2"><Pill tone="flame">{locker.isPlayer ? "Pinned updates" : "Legacy announcements"}</Pill><Pill tone="muted">Pinned</Pill></div>{announcements.filter((a) => a.pinned).map((a) => <div key={a.id} id={`locker-item-${a.id}`} className="rounded-2xl border border-flame/50 bg-flame/10 p-3"><span className="font-black text-foreground">{a.title}</span><p className="mt-1 rounded-xl bg-background/50 p-2 font-semibold text-foreground">{a.body}</p></div>)}</Panel> : null}
      <Panel><div className="mb-3 flex flex-wrap gap-2"><Heading tone="grape">Team Chat</Heading>{locker.isCoach ? <Pill tone={allowPlayerPosting ? "success" : "muted"}>{allowPlayerPosting ? "Everyone can post" : "Coach posts only"}</Pill> : null}</div>{teamConv.data ? <Chat focusId={focusId} simple={locker.isPlayer} conversationId={teamConv.data} teamId={teamId} directory={directory} meId={locker.user?.id ?? null} meName={locker.displayName} meRoleLabel={locker.roleLabel} canPost={locker.isCoach || locker.isPlayer && allowPlayerPosting} canAttach={locker.isCoach} canPin={locker.isCoach} /> : <EmptyState>Opening team chat…</EmptyState>}</Panel>
    </> : locker.isCoach ? <div className="grid gap-3 lg:grid-cols-[260px_1fr]"><Panel className="flex flex-col gap-2"><Heading>Conversations</Heading><BubbleButton tone={other === "staff" ? "flame" : "neutral"} onClick={() => setOther("staff")}><Users className="h-4 w-4"/> Coaching Staff</BubbleButton>{players.map((p) => <BubbleButton key={p.user_id} tone={other === p.user_id ? "grape" : "neutral"} className="justify-start" onClick={() => setOther(p.user_id)}>{p.jersey ? `#${p.jersey} ` : ""}{p.full_name ?? p.player_name ?? "Player"}</BubbleButton>)}</Panel><Panel>{(other === "staff" ? staffConv.data : direct.data) ? <Chat focusId={focusId} simple={locker.isPlayer} conversationId={String(other === "staff" ? staffConv.data : direct.data)} teamId={teamId} directory={directory} meId={locker.user?.id ?? null} canPost canAttach meName={locker.displayName} meRoleLabel={locker.roleLabel}/> : <EmptyState>Select a conversation</EmptyState>}</Panel></div> : <Panel>{playerCoachConv.data ? <Chat focusId={focusId} simple={locker.isPlayer} conversationId={playerCoachConv.data} teamId={teamId} directory={directory} meId={locker.user?.id ?? null} canPost canAttach={false} meName={locker.displayName} meRoleLabel={locker.roleLabel}/> : <EmptyState>{playerCoachConv.isError ? "Could not open your coach conversation." : "Opening your coaching staff conversation…"}{playerCoachConv.isError ? <BubbleButton tone="neutral" onClick={() => { void playerCoachConv.refetch(); }}>Try again</BubbleButton> : null}</EmptyState>}</Panel>}
  </div>;
}

function ScheduleArea({ teamId, team, events, isCoach, focusId }: { teamId: string; team: ReturnType<typeof useLocker>["teams"][number]; events: TeamEvent[]; isCoach: boolean; focusId?: string | undefined }) {
  const qc = useQueryClient(); const [sub, setSub] = useState<"upcoming" | "calendar">("upcoming"); const [editing, setEditing] = useState<TeamEvent | null>(null); const [open, setOpen] = useState(false); const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1)); const [day, setDay] = useState(dayKey(new Date()));
  const upcoming = events.filter((e) => (e.id === focusId || new Date(e.ends_at ?? e.starts_at).getTime() >= Date.now()));
  const marks = useMemo(() => { const map = new Map<string, MonthDot[]>(); for (const e of events) map.set(dayKey(e.starts_at), [...(map.get(dayKey(e.starts_at)) ?? []), e.event_type === "game" ? "flame" : e.event_type === "practice" ? "grape" : "neutral"]); return map; }, [events]);
  const shown = (sub === "calendar" ? events.filter((e) => dayKey(e.starts_at) === day) : upcoming).sort((a, b) => a.id === focusId ? -1 : b.id === focusId ? 1 : a.starts_at.localeCompare(b.starts_at));
  const refresh = async () => qc.invalidateQueries({ queryKey: ["team-events", teamId] });
  return <div className="flex flex-col gap-3"><Panel className="flex flex-wrap items-center justify-center gap-2"><BubbleButton tone={sub === "upcoming" ? "grape" : "neutral"} onClick={() => setSub("upcoming")}>Upcoming</BubbleButton><BubbleButton tone={sub === "calendar" ? "flame" : "neutral"} onClick={() => setSub("calendar")}>Calendar</BubbleButton>{isCoach ? <BubbleButton tone="flame" onClick={() => { setEditing(null); setOpen((v) => !v); }}><Plus className="h-4 w-4"/> Add Event</BubbleButton> : null}</Panel>
    {isCoach ? <GoogleCalendarPanel teamId={teamId} teamName={team.name} canManage /> : null}
    {open ? <EventForm key={editing?.id ?? "new"} teamId={teamId} defaults={{ homeGym: team.home_gym ?? null, practiceSpot: team.default_practice_location ?? null, arrivalOffset: team.default_arrival_offset_minutes ?? 60, practiceReminder: team.default_practice_reminder_minutes ?? 60, gameReminder: team.default_game_reminder_minutes ?? 60 }} editing={editing} onDone={async () => { setOpen(false); setEditing(null); await refresh(); }} /> : null}
    {sub === "calendar" ? <MonthCalendar month={month} onMonthChange={setMonth} marks={marks} selected={day} onSelect={setDay}/> : null}
    <Panel className="flex flex-col gap-2">{shown.length ? shown.map((e) => <div key={e.id} className={`flex flex-wrap items-center gap-2 rounded-2xl border p-3 ${e.id === focusId ? "ring-2 ring-flame" : ""} ${e.event_type === "game" ? "border-flame/50 bg-flame/10" : "border-grape/50 bg-grape/10"}`}><Pill tone={e.event_type === "game" ? "flame" : "grape"}>{EVENT_TYPE_LABEL[e.event_type] ?? "Event"}</Pill><span className="text-lg font-black text-foreground">{e.title}</span><Pill tone="muted">{fmtWhen(e.starts_at)}</Pill>{e.ends_at ? <Pill tone="muted">Ends {fmtWhen(e.ends_at)}</Pill> : null}{e.arrival_at ? <Pill tone="muted">Arrive {fmtWhen(e.arrival_at)}</Pill> : null}{e.location ? <Pill tone="muted">{e.location}</Pill> : null}{e.uniform ? <Pill tone="muted">{e.uniform} uniforms</Pill> : null}{e.notes ? <p className="w-full rounded-xl border border-border/60 bg-background/50 p-2 font-semibold text-foreground">{e.notes}</p> : null}{e.source === "google" && isCoach ? <Pill tone="flame">Google · read only</Pill> : isCoach ? <div className="ml-auto flex gap-2"><BubbleButton size="sm" tone="neutral" onClick={() => { setEditing(e); setOpen(true); }}>Edit</BubbleButton><BubbleButton size="sm" tone="ghost" onClick={async () => { await deleteTeamEvent(e.id); await refresh(); toast.success("Event removed"); }}>Remove</BubbleButton></div> : null}</div>) : <EmptyState>Your coach hasn’t added an event for this view yet.</EmptyState>}</Panel>
  </div>;
}

function PlaybookArea({ teamId, plays, isCoach, initialFolder, focusId }: { focusId?: string; teamId: string; plays: Awaited<ReturnType<typeof fetchTeamPlays>>; isCoach: boolean; initialFolder?: string | undefined }) {
  const qc = useQueryClient(); const [sub, setSub] = useState<"all" | "folders">(initialFolder || !isCoach ? "folders" : "all"); const [folder, setFolder] = useState(initialFolder ?? ""); const [name, setName] = useState("");
  const folders = useQuery({ queryKey: ["playbook-folders", teamId], queryFn: () => fetchPlaybookFolders(teamId), enabled: !!teamId });
  const memberships = useQuery({ queryKey: ["play-folder-memberships", teamId], queryFn: () => fetchPlayFolderMemberships(teamId), enabled: !!teamId });
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["playbook-folders", teamId] }); await qc.invalidateQueries({ queryKey: ["play-folder-memberships", teamId] }); };
  const membership = useMutation({
    mutationFn: ({ playId, folderId, included }: { playId: string; folderId: string; included: boolean }) => setPlayFolderMembership(playId, teamId, folderId, included),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const shownFolders = (folders.data ?? []).filter((f) => isCoach || f.visibility !== "coaches_only");
  const visible = sub === "folders" && folder ? plays.filter((p) => shownFolders.some((f) => f.id === folder) && memberships.data?.some((m) => m.folder_id === folder && m.play_id === p.id)) : plays;
  return <div className="flex flex-col gap-3"><Panel className="flex flex-wrap gap-2"><BubbleButton tone={sub === "all" ? "grape" : "neutral"} onClick={() => setSub("all")}>All Plays</BubbleButton><BubbleButton tone={sub === "folders" ? "flame" : "neutral"} onClick={() => setSub("folders")}>Folders</BubbleButton></Panel>
    {sub === "folders" ? <Panel className="flex flex-col gap-2"><div className="flex flex-wrap gap-2"><BubbleButton tone={!folder ? "grape" : "neutral"} onClick={() => setFolder("")}>All folders</BubbleButton>{shownFolders.map((f) => <BubbleButton key={f.id} tone={folder === f.id ? "flame" : "neutral"} onClick={() => setFolder(f.id)}>📁 {f.name}{f.visibility === "coaches_only" ? " · Coaches only" : ""}</BubbleButton>)}</div>{isCoach ? <div className="flex gap-2"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="New folder name"/><BubbleButton tone="grape" disabled={!name.trim()} onClick={async () => { await createPlaybookFolder(teamId, name); setName(""); await refresh(); }}>Create</BubbleButton>{folder ? <><BubbleButton tone="neutral" onClick={async () => { const next = prompt("Folder name", folders.data?.find((f) => f.id === folder)?.name); if (next?.trim()) { await renamePlaybookFolder(folder, next); await refresh(); } }}>Rename</BubbleButton><BubbleButton tone="ghost" onClick={async () => { await deletePlaybookFolder(folder); setFolder(""); await refresh(); }}>Delete</BubbleButton></> : null}</div> : null}</Panel> : null}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((p) => <Panel key={p.id} id={`locker-item-${p.id}`} className={`flex min-w-0 flex-col gap-2 ${p.id === focusId ? "ring-2 ring-flame" : ""}`}>{!isCoach ? <PlayThumb playId={p.id} attackBasket={p.attack_basket} category={p.category} authenticated /> : null}<div className="flex flex-wrap gap-2"><span className="rounded-2xl border border-border/60 bg-background/50 px-3 py-2 text-lg font-black text-foreground">{p.name}</span><Pill tone="muted">{p.category}</Pill>{isCoach && p.team_id !== teamId ? <Pill tone="grape">From CoachSide Library</Pill> : null}</div><Link to="/plays/$playId/view" params={{ playId: p.id }} search={{ from: "lockerroom", team: teamId, ...(folder ? { folder } : {}) }}><BubbleButton tone="flame" className="w-full">▶ Run Play</BubbleButton></Link>{sub === "folders" && isCoach ? <div className="flex flex-wrap gap-1">{(folders.data ?? []).map((f) => { const checked = !!memberships.data?.some((m) => m.folder_id === f.id && m.play_id === p.id); return <BubbleButton key={f.id} size="sm" tone={checked ? "grape" : "neutral"} disabled={membership.isPending} onClick={() => membership.mutate({ playId: p.id, folderId: f.id, included: !checked })}>{checked ? "✓ " : "+ "}{f.name}</BubbleButton>; })}</div> : null}</Panel>)}</div>
    {!visible.length ? <Panel><EmptyState>Your coach hasn’t shared any plays in this view yet.</EmptyState></Panel> : null}
  </div>;
}

function PlansArea({ teamId, assignments, targets, players, isCoach, userId, playerId, focusId, onChanged }: { teamId: string; assignments: Awaited<ReturnType<typeof fetchAssignments>>; targets: Awaited<ReturnType<typeof fetchAssignmentTargets>>; players: Awaited<ReturnType<typeof fetchTeamDirectory>>; isCoach: boolean; userId: string | null; playerId: string | null; focusId?: string | undefined; onChanged: () => void }) {
  const [tab, setTab] = useState<"todo" | "completed">("todo");
  useEffect(() => { if (focusId) setTab(targets.some((t) => t.assignment_id === focusId && (t.user_id === userId || t.player_id === playerId) && t.status === "completed") ? "completed" : "todo"); }, [focusId, targets, userId, playerId]);
  const [compose, setCompose] = useState(false); const [title, setTitle] = useState(""); const [instructions, setInstructions] = useState(""); const [due, setDue] = useState(""); const [picked, setPicked] = useState<string[]>([]); const [attachments, setAttachments] = useState<NewAttachment[]>([]);
  const create = useMutation({ mutationFn: () => createAssignment({ team_id: teamId, assignment_type: "task", title, instructions: instructions || null, due_at: due ? new Date(due).toISOString() : null, linked_type: null, linked_id: null, player_ids: picked, attachments }), onSuccess: () => { setTitle(""); setInstructions(""); setDue(""); setPicked([]); setAttachments([]); setCompose(false); toast.success("Plan sent"); notifyProgressChanged(); onChanged(); }, onError: (e: Error) => toast.error(e.message) });
  const relevant = (isCoach ? assignments : personalPlans(assignments, targets, userId, playerId).filter(({ mine }) => tab === "completed" ? mine?.status === "completed" : mine?.status !== "completed").map(({ plan }) => plan)).sort((a, b) => a.id === focusId ? -1 : b.id === focusId ? 1 : (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") || b.created_at.localeCompare(a.created_at));
  return <div className="flex flex-col gap-3">{!isCoach ? <Panel className="flex justify-center gap-2"><BubbleButton tone={tab === "todo" ? "grape" : "neutral"} onClick={() => setTab("todo")}>To Do</BubbleButton><BubbleButton tone={tab === "completed" ? "flame" : "neutral"} onClick={() => setTab("completed")}>Completed</BubbleButton></Panel> : null}{isCoach ? <div className="flex justify-center"><BubbleButton tone="flame" size="lg" onClick={() => setCompose((v) => !v)}><Plus className="h-4 w-4"/> New Plan</BubbleButton></div> : null}
    {compose ? <Panel className="flex flex-col gap-3"><Heading tone="grape">New Plan</Heading><div className="grid gap-2 sm:grid-cols-2"><Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Review the press break"/></Field><Field label="Due (optional)"><TextInput type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)}/></Field></div><Field label="Instructions"><textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-24 w-full rounded-2xl border border-input bg-surface-2/70 p-3 font-semibold text-foreground"/></Field><AttachmentPicker teamId={teamId} value={attachments} onChange={setAttachments}/><Label>Players · none selected means whole team</Label><div className="flex flex-wrap gap-2">{players.filter((p) => p.role === "player" && p.player_id).map((p) => <BubbleButton key={p.player_id} size="sm" tone={picked.includes(String(p.player_id)) ? "flame" : "neutral"} onClick={() => setPicked((v) => v.includes(String(p.player_id)) ? v.filter((x) => x !== p.player_id) : [...v, String(p.player_id)])}>{p.jersey ? `#${p.jersey} ` : ""}{p.player_name ?? p.full_name ?? "Player"}</BubbleButton>)}</div><BubbleButton tone="grape" size="lg" disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>Send Plan</BubbleButton></Panel> : null}
    {relevant.map((a) => { const list = targets.filter((t) => t.assignment_id === a.id); const mine = list.find((t) => t.user_id === userId || t.player_id === playerId); return <Panel key={a.id} id={`locker-item-${a.id}`} className={`flex flex-col gap-2 ${a.id === focusId ? "border-flame/70" : ""}`}><div className="flex flex-wrap gap-2"><Pill tone="grape">Plan</Pill><span className="rounded-2xl border border-border/60 bg-background/50 px-3 py-2 text-xl font-black text-foreground">{a.title}</span>{a.due_at ? <Pill tone="flame">Due {fmtWhen(a.due_at)}</Pill> : null}</div>{a.instructions ? <p className="rounded-2xl border border-border/60 bg-surface-2/70 p-3 font-semibold text-foreground">{a.instructions}</p> : null}{a.linked_type && a.linked_id ? <AttachmentCard attachment={{ id: `${a.id}-legacy`, attachment_type: a.linked_type as NewAttachment["attachment_type"], related_id: a.linked_id, metadata: {} }} teamId={teamId}/> : null}{a.attachments.map((att) => <AttachmentCard key={att.id} attachment={att} teamId={teamId}/>)}{isCoach ? <div className="flex flex-wrap gap-2"><Label>Player status</Label>{players.filter((p) => p.role === "player").map((p) => { const t = list.find((x) => x.player_id === p.player_id || x.user_id === p.user_id); return <Pill key={p.user_id} tone={t?.status === "completed" ? "success" : "muted"}>{p.jersey ? `#${p.jersey} ` : ""}{p.player_name ?? p.full_name ?? "Player"} · {t?.status?.replace("_", " ") ?? "not viewed"}{t?.completed_at ? ` · ${fmtWhen(t.completed_at)}` : ""}</Pill>; })}<BubbleButton size="sm" tone="ghost" onClick={async () => { await deleteAssignment(a.id); onChanged(); }}>Remove</BubbleButton></div> : <div className="flex flex-wrap gap-2"><Pill tone={mine?.status === "completed" ? "success" : "muted"}>{mine?.status === "completed" ? "Completed" : "To do"}{mine?.completed_at ? ` · ${fmtWhen(mine.completed_at)}` : ""}</Pill>{mine?.status !== "completed" ? <BubbleButton tone="grape" onClick={async () => { try { await setAssignmentStatus({ assignmentId: a.id, playerId, status: "completed" }); toast.success("Plan completed"); onChanged(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not complete this plan"); } }}>✓ Mark complete</BubbleButton> : null}</div>}</Panel>; })}
    {!relevant.length ? <Panel><EmptyState>{isCoach ? "No plans right now" : tab === "completed" ? "Completed plans will stay here." : "You’re all caught up. New plans from your coach will appear here."}</EmptyState></Panel> : null}
  </div>;
}