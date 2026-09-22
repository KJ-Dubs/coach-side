import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EnablePushCard } from "@/components/EnablePushCard";
import {
  BubbleButton,
  EmptyState,
  Field,
  Heading,
  Label,
  Note,
  Panel,
  Pill,
  SelectInput,
  StatTile,
  TextInput,
} from "@/components/Bubbles";
import { Chat } from "@/components/locker/Chat";
import { AttachmentCard, AttachmentPicker } from "@/components/locker/Attachments";
import { fetchPlayers, fetchPlays, fetchTeamEvents, logoSignedUrl } from "@/lib/data";
import {
  AUDIENCES,
  createAnnouncement,
  createAssignment,
  createResource,
  deleteAnnouncement,
  deleteAssignment,
  deleteResource,
  ensureConversation,
  ensureDirectConversation,
  fetchAnnouncements,
  fetchAssignments,
  fetchAssignmentTargets,
  fetchReceipts,
  fetchResources,
  fetchTeamDirectory,
  markAnnouncement,
  setAnnouncementPinned,
  setAssignmentStatus,
  TEAM_ROLE_LABEL,
  type Announcement,
  type AssignmentType,
  type NewAttachment,
} from "@/lib/locker";
import { EVENT_TYPE_LABEL } from "@/lib/types";
import { useLocker } from "@/lib/useLocker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lockerroom")({
  head: () => ({
    meta: [
      { title: "Team Hub & Messages — CoachSide" },
      {
        name: "description",
        content:
          "Team announcements, chat, assignments, plays, schedule and resources in one basketball team hub.",
      },
      { property: "og:title", content: "Team Hub & Messages — CoachSide" },
      {
        property: "og:description",
        content: "The CoachSide team hub for announcements, messages, assignments and schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LockerRoomPage,
});

type Tab =
  | "today"
  | "announcements"
  | "chat"
  | "assignments"
  | "plays"
  | "schedule"
  | "resources"
  | "staff"
  | "direct";

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LockerRoomPage() {
  const [teamId, setTeamId] = useState("");
  const locker = useLocker(teamId || null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!teamId && locker.teams.length) setTeamId(locker.teams[0]!.id);
  }, [locker.teams, teamId]);

  const team = locker.teams.find((t) => t.id === teamId) ?? null;
  const [tab, setTab] = useState<Tab>("today");

  const logo = useQuery({
    queryKey: ["team-logo", team?.logo_url],
    queryFn: () => logoSignedUrl(team?.logo_url),
    enabled: !!team?.logo_url,
  });

  const directory = useQuery({
    queryKey: ["team-directory", teamId],
    queryFn: () => fetchTeamDirectory(teamId),
    enabled: !!teamId,
  });

  const announcements = useQuery({
    queryKey: ["announcements", teamId],
    queryFn: () => fetchAnnouncements(teamId),
    enabled: !!teamId,
  });

  const receipts = useQuery({
    queryKey: ["announcement-receipts", teamId, (announcements.data ?? []).length],
    queryFn: () => fetchReceipts((announcements.data ?? []).map((a) => a.id)),
    enabled: !!(announcements.data ?? []).length,
  });

  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchTeamEvents(teamId),
    enabled: !!teamId,
  });

  const assignments = useQuery({
    queryKey: ["assignments", teamId],
    queryFn: () => fetchAssignments(teamId),
    enabled: !!teamId && !locker.isParent,
  });

  const targets = useQuery({
    queryKey: ["assignment-targets", teamId, (assignments.data ?? []).length],
    queryFn: () => fetchAssignmentTargets((assignments.data ?? []).map((a) => a.id)),
    enabled: !!(assignments.data ?? []).length,
  });

  const resources = useQuery({
    queryKey: ["resources", teamId],
    queryFn: () => fetchResources(teamId),
    enabled: !!teamId,
  });

  const plays = useQuery({
    queryKey: ["plays"],
    queryFn: fetchPlays,
    enabled: !!teamId && !locker.isParent,
  });

  const players = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => fetchPlayers(teamId),
    enabled: !!teamId && locker.isCoach,
  });

  const teamConv = useQuery({
    queryKey: ["conversation", teamId, "team"],
    queryFn: () => ensureConversation(teamId, "team"),
    enabled: !!teamId && !locker.isParent,
  });

  const staffConv = useQuery({
    queryKey: ["conversation", teamId, "staff"],
    queryFn: () => ensureConversation(teamId, "staff"),
    enabled: !!teamId && locker.isCoach,
  });

  const now = Date.now();
  const upcoming = (events.data ?? [])
    .filter((e) => new Date(e.starts_at).getTime() >= now - 3600_000)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const nextPractice = upcoming.find((e) => e.event_type === "practice") ?? null;
  const nextGame = upcoming.find((e) => e.event_type === "game") ?? null;

  const myReceipts = (receipts.data ?? []).filter((r) => r.user_id === locker.user?.id);
  const unreadAnnouncements = (announcements.data ?? []).filter(
    (a) => !myReceipts.some((r) => r.announcement_id === a.id && r.viewed_at),
  ).length;

  const myAssignments = (assignments.data ?? []).filter((a) => {
    const list = (targets.data ?? []).filter((t) => t.assignment_id === a.id);
    if (!list.length) return true;
    return list.some(
      (t) => t.user_id === locker.user?.id || (locker.playerId && t.player_id === locker.playerId),
    );
  });
  const openAssignments = myAssignments.filter((a) => {
    const mine = (targets.data ?? []).find(
      (t) =>
        t.assignment_id === a.id &&
        (t.user_id === locker.user?.id || (locker.playerId && t.player_id === locker.playerId)),
    );
    return !mine || mine.status !== "completed";
  }).length;

  const teamPlays = (plays.data ?? []).filter((p) => p.team_id === teamId || p.team_id === null);

  const TABS: { id: Tab; label: string; show: boolean }[] = [
    { id: "today", label: "Today", show: true },
    { id: "announcements", label: "Announcements", show: true },
    { id: "chat", label: "Team Chat", show: !locker.isParent },
    { id: "assignments", label: "Assignments", show: !locker.isParent },
    { id: "plays", label: "Plays", show: !locker.isParent },
    { id: "schedule", label: "Schedule", show: true },
    { id: "resources", label: "Resources", show: true },
    { id: "staff", label: "Staff Chat", show: locker.isCoach },
    { id: "direct", label: "Direct Messages", show: !locker.isParent },
  ];

  if (!locker.loading && !locker.teams.length) {
    return (
      <AppShell title="Locker Room" subtitle="Your team hub">
        <Panel>
          <EmptyState>
            You are not on a team yet. Ask your coach for the team invite link.
          </EmptyState>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Locker Room"
      subtitle="Announcements, messages, assignments and schedule"
      logoUrl={logo.data ?? null}
      wide
    >
      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Team</Label>
        <SelectInput
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="max-w-xs"
          aria-label="Choose team"
        >
          {locker.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.season}
            </option>
          ))}
        </SelectInput>
        {locker.role ? <Pill tone="flame">{TEAM_ROLE_LABEL[locker.role]}</Pill> : null}
        {locker.isCoach ? (
          <Link
            to="/settings"
            className="inline-flex min-h-11 items-center rounded-full border border-grape/60 bg-grape/20 px-4 text-sm font-black text-foreground"
          >
            Invite links &amp; access
          </Link>
        ) : null}
      </Panel>

      <Panel className="mb-3 flex flex-wrap gap-1.5">
        {TABS.filter((t) => t.show).map((t) => (
          <BubbleButton
            key={t.id}
            tone={tab === t.id ? "grape" : "neutral"}
            size="md"
            className="min-h-11"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "announcements" && unreadAnnouncements ? ` · ${unreadAnnouncements}` : ""}
            {t.id === "assignments" && openAssignments ? ` · ${openAssignments}` : ""}
          </BubbleButton>
        ))}
      </Panel>

      {/* ---------------- TODAY ---------------- */}
      {tab === "today" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <EnablePushCard />
          </div>
          <Panel className="flex flex-col gap-3">
            <div className="flex justify-center"><Heading tone="flame" className="text-center">Today</Heading></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label="Unread news"
                value={unreadAnnouncements}
                tone={unreadAnnouncements ? "flame" : "neutral"}
              />
              <StatTile label="Open tasks" value={openAssignments} tone="grape" />
              <StatTile label="Team plays" value={teamPlays.length} />
              <StatTile label="Upcoming" value={upcoming.length} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Next practice</Label>
              {nextPractice ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-grape/50 bg-grape/15 p-3">
                  <Pill tone="grape">Practice</Pill>
                  <span className="text-lg font-black leading-tight text-foreground">{nextPractice.title}</span>
                  <Pill tone="muted">{fmtWhen(nextPractice.starts_at)}</Pill>
                  {nextPractice.location ? <Pill tone="muted">{nextPractice.location}</Pill> : null}
                </div>
              ) : (
                <EmptyState>No practice on the calendar</EmptyState>
              )}
              <Label>Next game</Label>
              {nextGame ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-flame/50 bg-flame/15 p-3">
                  <Pill tone="flame">Game</Pill>
                  <span className="text-lg font-black leading-tight text-foreground">{nextGame.title}</span>
                  <Pill tone="muted">{fmtWhen(nextGame.starts_at)}</Pill>
                  {nextGame.location ? <Pill tone="muted">{nextGame.location}</Pill> : null}
                  {nextGame.arrival_at ? (
                    <Pill tone="muted">Arrive {fmtWhen(nextGame.arrival_at)}</Pill>
                  ) : null}
                </div>
              ) : (
                <EmptyState>No game on the calendar</EmptyState>
              )}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <div className="flex justify-center"><Heading className="text-center">Pinned</Heading></div>
            {(announcements.data ?? []).filter((a) => a.pinned).length ? (
              (announcements.data ?? [])
                .filter((a) => a.pinned)
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-2 rounded-2xl border border-flame/50 bg-flame/10 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="flame">Pinned</Pill>
                      <span className="text-lg font-black leading-tight text-foreground">{a.title}</span>
                    </div>
                    <p className="rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2 text-base font-semibold text-foreground">
                      {a.body}
                    </p>
                  </div>
                ))
            ) : (
              <EmptyState>Nothing pinned right now</EmptyState>
            )}
            <Label>Team</Label>
            <div className="divide-y divide-border/70 rounded-2xl border border-border/70 bg-surface-2/50 px-3">
              {(directory.data ?? []).map((d) => (
                <div key={d.user_id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm font-semibold text-foreground"><span className="min-w-0 truncate">{d.jersey ? `#${d.jersey} ` : ""}{d.full_name ?? d.player_name ?? d.email ?? "Member"}</span><Pill tone={d.role === "player" ? "grape" : "neutral"}>{TEAM_ROLE_LABEL[d.role]}</Pill></div>
              ))}
              {!(directory.data ?? []).length ? (
                <p className="py-3 text-sm font-semibold text-muted-foreground">No players have joined with the invite link yet</p>
              ) : null}
            </div>
          </Panel>
        </div>
      ) : null}

      {/* ---------------- ANNOUNCEMENTS ---------------- */}
      {tab === "announcements" ? (
        <div className="flex flex-col gap-3">
          {locker.isCoach ? (
            <AnnouncementComposer
              teamId={teamId}
              defaultAck={!!team?.require_ack_default}
              onDone={() => void qc.invalidateQueries({ queryKey: ["announcements", teamId] })}
            />
          ) : null}
          {(announcements.data ?? []).length ? (
            (announcements.data ?? []).map((a) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                teamId={teamId}
                isCoach={locker.isCoach}
                meId={locker.user?.id ?? null}
                receipts={(receipts.data ?? []).filter((r) => r.announcement_id === a.id)}
                memberCount={(directory.data ?? []).length}
                onChanged={() => {
                  void qc.invalidateQueries({ queryKey: ["announcements", teamId] });
                  void qc.invalidateQueries({ queryKey: ["announcement-receipts"] });
                }}
              />
            ))
          ) : (
            <Panel>
              <EmptyState>No announcements yet</EmptyState>
            </Panel>
          )}
        </div>
      ) : null}

      {/* ---------------- TEAM CHAT ---------------- */}
      {tab === "chat" ? (
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Heading tone="grape">Team Chat</Heading>
            <Pill tone={team?.allow_player_posting === false ? "muted" : "success"}>
              {team?.allow_player_posting === false ? "Coach posts only" : "Everyone can post"}
            </Pill>
          </div>
          {teamConv.data ? (
            <Chat
              conversationId={teamConv.data}
              teamId={teamId}
              directory={directory.data ?? []}
              meId={locker.user?.id ?? null}
              meName={locker.displayName}
              meRoleLabel={locker.roleLabel}
              canPost={locker.isCoach || (locker.isPlayer && team?.allow_player_posting !== false)}
              canAttach={locker.isCoach}
              disabledNote="Your coach has set team chat to coach announcements only."
            />
          ) : (
            <EmptyState>Opening team chat…</EmptyState>
          )}
        </Panel>
      ) : null}

      {/* ---------------- STAFF CHAT ---------------- */}
      {tab === "staff" && locker.isCoach ? (
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Heading tone="flame">Staff Chat</Heading>
            <Pill tone="muted">Head coach and assistant coaches only</Pill>
          </div>
          {staffConv.data ? (
            <Chat
              conversationId={staffConv.data}
              teamId={teamId}
              directory={directory.data ?? []}
              meId={locker.user?.id ?? null}
              meName={locker.displayName}
              meRoleLabel={locker.roleLabel}
              canPost
              canAttach
            />
          ) : (
            <EmptyState>Opening staff chat…</EmptyState>
          )}
        </Panel>
      ) : null}

      {/* ---------------- DIRECT MESSAGES ---------------- */}
      {tab === "direct" && !locker.isParent ? (
        <DirectMessages
          teamId={teamId}
          directory={directory.data ?? []}
          meId={locker.user?.id ?? null}
          isCoach={locker.isCoach}
        />
      ) : null}

      {/* ---------------- ASSIGNMENTS ---------------- */}
      {tab === "assignments" && !locker.isParent ? (
        <div className="flex flex-col gap-3">
          {locker.isCoach ? (
            <AssignmentComposer
              teamId={teamId}
              players={(players.data ?? []).map((p) => ({
                id: p.id,
                label: `#${p.jersey} ${p.name}`,
              }))}
              plays={teamPlays.map((p) => ({ id: p.id, label: p.name }))}
              events={(events.data ?? []).map((e) => ({
                id: e.id,
                label: `${e.title} · ${fmtWhen(e.starts_at)}`,
              }))}
              onDone={() => void qc.invalidateQueries({ queryKey: ["assignments", teamId] })}
            />
          ) : null}
          {myAssignments.length ? (
            myAssignments.map((a) => {
              const list = (targets.data ?? []).filter((t) => t.assignment_id === a.id);
              const mine = list.find(
                (t) =>
                  t.user_id === locker.user?.id ||
                  (locker.playerId && t.player_id === locker.playerId),
              );
              return (
                <Panel key={a.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="grape">{a.assignment_type.replace("_", " ")}</Pill>
                    <span className="text-xl font-black leading-tight text-foreground">{a.title}</span>
                    {a.due_at ? <Pill tone="flame">Due {fmtWhen(a.due_at)}</Pill> : null}
                    {mine ? <Pill tone="muted">{mine.status.replace("_", " ")}</Pill> : null}
                  </div>
                  {a.instructions ? (
                    <p className="rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2 text-base font-semibold text-foreground">
                      {a.instructions}
                    </p>
                  ) : null}
                  {a.linked_type === "play" && a.linked_id ? (
                    <AttachmentCard
                      attachment={{
                        id: `${a.id}-link`,
                        attachment_type: "play",
                        related_id: a.linked_id,
                        metadata: {},
                      }}
                      teamId={teamId}
                    />
                  ) : null}
                  {a.linked_type === "event" && a.linked_id ? (
                    <AttachmentCard
                      attachment={{
                        id: `${a.id}-link`,
                        attachment_type: "event",
                        related_id: a.linked_id,
                        metadata: {},
                      }}
                      teamId={teamId}
                    />
                  ) : null}

                  {locker.isCoach ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Label>Player status</Label>
                      {list.length ? (
                        list.map((t) => {
                          const p = (players.data ?? []).find((x) => x.id === t.player_id);
                          return (
                            <Pill
                              key={t.id}
                              tone={t.status === "completed" ? "success" : "muted"}
                            >
                              {p ? `#${p.jersey} ${p.name}` : "Player"} ·{" "}
                              {t.status.replace("_", " ")}
                            </Pill>
                          );
                        })
                      ) : (
                        <Pill tone="muted">Whole team</Pill>
                      )}
                      <BubbleButton
                        size="sm"
                        tone="ghost"
                        onClick={async () => {
                          await deleteAssignment(a.id);
                          await qc.invalidateQueries({ queryKey: ["assignments", teamId] });
                        }}
                      >
                        Remove
                      </BubbleButton>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <BubbleButton
                        tone="neutral"
                        onClick={async () => {
                          await setAssignmentStatus({
                            assignmentId: a.id,
                            playerId: locker.playerId,
                            status: "viewed",
                          });
                          await qc.invalidateQueries({ queryKey: ["assignment-targets"] });
                        }}
                      >
                        Mark viewed
                      </BubbleButton>
                      <BubbleButton
                        tone="grape"
                        onClick={async () => {
                          await setAssignmentStatus({
                            assignmentId: a.id,
                            playerId: locker.playerId,
                            status: "completed",
                          });
                          await qc.invalidateQueries({ queryKey: ["assignment-targets"] });
                        }}
                      >
                        Mark completed
                      </BubbleButton>
                    </div>
                  )}
                </Panel>
              );
            })
          ) : (
            <Panel>
              <EmptyState>No assignments right now</EmptyState>
            </Panel>
          )}
        </div>
      ) : null}

      {/* ---------------- PLAYS ---------------- */}
      {tab === "plays" && !locker.isParent ? (
        <Panel className="flex flex-col gap-2">
          <Heading tone="grape">Playbook</Heading>
          {teamPlays.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {teamPlays.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-2xl border border-grape/50 bg-grape/15 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-black leading-tight text-foreground sm:text-xl">{p.name}</span>
                    <Pill tone="muted">{p.category}</Pill>
                  </div>
                  <Link
                    to="/plays/$playId/view"
                    params={{ playId: p.id }}
                    search={{ from: "lockerroom" }}
                    aria-label={`Run play ${p.name}`}
                    className="block"
                  >
                    <BubbleButton tone="flame" className="w-full min-h-12">
                      ▶ Run Play
                    </BubbleButton>
                  </Link>
                </div>
              ))}

            </div>
          ) : (
            <EmptyState>No plays saved for this team yet</EmptyState>
          )}
        </Panel>
      ) : null}

      {/* ---------------- SCHEDULE ---------------- */}
      {tab === "schedule" ? (
        <Panel className="flex flex-col gap-2">
          <Heading tone="flame">Schedule</Heading>
          {upcoming.length ? (
            upcoming.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-3"
              >
                <Pill tone={e.event_type === "game" ? "flame" : "grape"}>
                  {EVENT_TYPE_LABEL[e.event_type] ?? "Event"}
                </Pill>
                <span className="text-lg font-black leading-tight text-foreground">{e.title}</span>
                <Pill tone="muted">{fmtWhen(e.starts_at)}</Pill>
                {e.location ? <Pill tone="muted">{e.location}</Pill> : null}
                {e.opponent ? <Pill tone="neutral">vs {e.opponent}</Pill> : null}
                {e.arrival_at ? <Pill tone="muted">Arrive {fmtWhen(e.arrival_at)}</Pill> : null}
                {e.uniform ? <Pill tone="muted">{e.uniform}</Pill> : null}
              </div>
            ))
          ) : (
            <EmptyState>Nothing scheduled yet</EmptyState>
          )}
        </Panel>
      ) : null}

      {/* ---------------- RESOURCES ---------------- */}
      {tab === "resources" ? (
        <div className="flex flex-col gap-3">
          {locker.isCoach ? (
            <ResourceComposer
              teamId={teamId}
              onDone={() => void qc.invalidateQueries({ queryKey: ["resources", teamId] })}
            />
          ) : null}
          <Panel className="flex flex-col gap-2">
            <Heading>Team resources</Heading>
            {(resources.data ?? []).length ? (
              (resources.data ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="grape">{r.category}</Pill>
                    <span className="text-lg font-black leading-tight text-foreground">{r.title}</span>
                    <Pill tone="muted">
                      {AUDIENCES.find((a) => a.value === r.audience)?.label ?? r.audience}
                    </Pill>
                  </div>
                  {r.body ? (
                    <p className="rounded-2xl border border-border/60 bg-background/50 px-3 py-2 text-base font-semibold text-foreground">
                      {r.body}
                    </p>
                  ) : null}
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 w-fit items-center rounded-full border border-flame/60 bg-flame/20 px-4 text-sm font-black text-foreground"
                    >
                      Open link
                    </a>
                  ) : null}
                  {locker.isCoach ? (
                    <BubbleButton
                      size="sm"
                      tone="ghost"
                      className="w-fit"
                      onClick={async () => {
                        await deleteResource(r.id);
                        await qc.invalidateQueries({ queryKey: ["resources", teamId] });
                      }}
                    >
                      Remove
                    </BubbleButton>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState>No team rules or documents added yet</EmptyState>
            )}
          </Panel>
        </div>
      ) : null}
    </AppShell>
  );
}

/* ---------------- announcements ---------------- */

function AnnouncementComposer({
  teamId,
  defaultAck,
  onDone,
}: {
  teamId: string;
  defaultAck: boolean;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Announcement["audience"]>("everyone");
  const [ack, setAck] = useState(defaultAck);
  const [pinned, setPinned] = useState(false);
  const [attachments, setAttachments] = useState<NewAttachment[]>([]);

  const create = useMutation({
    mutationFn: () =>
      createAnnouncement({
        team_id: teamId,
        audience,
        title: title.trim(),
        body: body.trim(),
        require_acknowledgment: ack,
        pinned,
        attachments,
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      setAttachments([]);
      setPinned(false);
      toast.success("Announcement posted");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="flex flex-col gap-2">
      <Heading tone="flame">New announcement</Heading>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Title">
          <TextInput
            value={title}
            placeholder="Practice moved to 5:00 PM"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Who sees it">
          <SelectInput
            value={audience}
            onChange={(e) => setAudience(e.target.value as Announcement["audience"])}
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label="Message">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-24 w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-3 text-base font-semibold text-foreground outline-none focus:border-grape"
        />
      </Field>
      <AttachmentPicker teamId={teamId} value={attachments} onChange={setAttachments} />
      <div className="flex flex-wrap gap-2">
        <BubbleButton tone={ack ? "flame" : "neutral"} onClick={() => setAck(!ack)}>
          {ack ? "Acknowledgment required" : "Ask for acknowledgment"}
        </BubbleButton>
        <BubbleButton tone={pinned ? "grape" : "neutral"} onClick={() => setPinned(!pinned)}>
          {pinned ? "Pinned to top" : "Pin to top"}
        </BubbleButton>
        <BubbleButton
          tone="grape"
          size="lg"
          disabled={!title.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          Post announcement
        </BubbleButton>
      </div>
    </Panel>
  );
}

function AnnouncementCard({
  announcement: a,
  teamId,
  isCoach,
  meId,
  receipts,
  memberCount,
  onChanged,
}: {
  announcement: Announcement;
  teamId: string;
  isCoach: boolean;
  meId: string | null;
  receipts: { user_id: string; viewed_at: string | null; acknowledged_at: string | null }[];
  memberCount: number;
  onChanged: () => void;
}) {
  const mine = receipts.find((r) => r.user_id === meId) ?? null;

  useEffect(() => {
    if (!meId || mine?.viewed_at) return;
    void markAnnouncement(a.id, { viewed: true })
      .then(onChanged)
      .catch(() => undefined);
    // Viewing the card is what marks it read.
  }, [a.id, meId, mine?.viewed_at]);

  const viewed = receipts.filter((r) => r.viewed_at).length;
  const acked = receipts.filter((r) => r.acknowledged_at).length;

  return (
    <Panel className={cn("flex flex-col gap-2", a.pinned && "border-flame/60")}>
      <div className="flex flex-wrap items-center gap-2">
        {a.pinned ? <Pill tone="flame">Pinned</Pill> : null}
        <span className="text-lg font-black text-foreground">{a.title}</span>
        <Pill tone="muted">
          {AUDIENCES.find((x) => x.value === a.audience)?.label ?? a.audience}
        </Pill>
        <Pill tone="muted">{fmtWhen(a.created_at)}</Pill>
        {a.updated_at !== a.created_at ? <Pill tone="muted">Edited</Pill> : null}
      </div>
      <p className="rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2 text-base font-semibold leading-relaxed text-foreground">
        {a.body}
      </p>
      {a.attachments.map((att) => (
        <AttachmentCard key={att.id} attachment={att} teamId={teamId} />
      ))}

      {a.require_acknowledgment ? (
        mine?.acknowledged_at ? (
          <Pill tone="success">You acknowledged this</Pill>
        ) : (
          <BubbleButton
            tone="flame"
            size="lg"
            className="w-fit"
            onClick={async () => {
              await markAnnouncement(a.id, { acknowledged: true });
              onChanged();
            }}
          >
            Acknowledge
          </BubbleButton>
        )
      ) : null}

      {isCoach ? (
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="muted">
            Read {viewed}
            {memberCount ? ` of ${memberCount}` : ""}
          </Pill>
          {a.require_acknowledgment ? <Pill tone="grape">Acknowledged {acked}</Pill> : null}
          <BubbleButton
            size="sm"
            tone="neutral"
            onClick={async () => {
              await setAnnouncementPinned(a.id, !a.pinned);
              onChanged();
            }}
          >
            {a.pinned ? "Unpin" : "Pin"}
          </BubbleButton>
          <BubbleButton
            size="sm"
            tone="ghost"
            onClick={async () => {
              await deleteAnnouncement(a.id);
              onChanged();
            }}
          >
            Delete
          </BubbleButton>
        </div>
      ) : null}
    </Panel>
  );
}

/* ---------------- assignments ---------------- */

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string }[] = [
  { value: "play", label: "Play to review" },
  { value: "event", label: "Event reminder" },
  { value: "resource", label: "Read team resource" },
  { value: "task", label: "Custom task" },
];

function AssignmentComposer({
  teamId,
  players,
  plays,
  events,
  onDone,
}: {
  teamId: string;
  players: { id: string; label: string }[];
  plays: { id: string; label: string }[];
  events: { id: string; label: string }[];
  onDone: () => void;
}) {
  const [type, setType] = useState<AssignmentType>("play");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [due, setDue] = useState("");
  const [linkedId, setLinkedId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const linkOptions = type === "play" ? plays : type === "event" ? events : [];

  const create = useMutation({
    mutationFn: () =>
      createAssignment({
        team_id: teamId,
        assignment_type: type,
        title: title.trim(),
        instructions: instructions.trim() || null,
        due_at: due ? new Date(due).toISOString() : null,
        linked_type: linkOptions.length && linkedId ? type : null,
        linked_id: linkOptions.length && linkedId ? linkedId : null,
        player_ids: picked,
      }),
    onSuccess: () => {
      setTitle("");
      setInstructions("");
      setDue("");
      setLinkedId("");
      setPicked([]);
      toast.success("Assignment sent");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="flex flex-col gap-2">
      <Heading tone="grape">New assignment</Heading>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Type">
          <SelectInput value={type} onChange={(e) => setType(e.target.value as AssignmentType)}>
            {ASSIGNMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Title">
          <TextInput
            value={title}
            placeholder="Watch Horns Twist before Tuesday"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        {linkOptions.length ? (
          <Field label={type === "play" ? "Play" : "Event"}>
            <SelectInput value={linkedId} onChange={(e) => setLinkedId(e.target.value)}>
              <option value="">None</option>
              {linkOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : null}
        <Field label="Due (optional)">
          <TextInput type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <Field label="Instructions">
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="min-h-20 w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-3 text-base font-semibold text-foreground outline-none focus:border-grape"
        />
      </Field>
      <Label>Who (nobody selected = whole team)</Label>
      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <BubbleButton
            key={p.id}
            size="sm"
            tone={picked.includes(p.id) ? "flame" : "neutral"}
            onClick={() =>
              setPicked((prev) =>
                prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id],
              )
            }
          >
            {p.label}
          </BubbleButton>
        ))}
      </div>
      <BubbleButton
        tone="grape"
        size="lg"
        disabled={!title.trim() || create.isPending}
        onClick={() => create.mutate()}
      >
        Send assignment
      </BubbleButton>
    </Panel>
  );
}

/* ---------------- resources ---------------- */

function ResourceComposer({ teamId, onDone }: { teamId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("document");
  const [audience, setAudience] = useState("everyone");

  const create = useMutation({
    mutationFn: () =>
      createResource({
        team_id: teamId,
        title: title.trim(),
        body: body.trim() || null,
        url: url.trim() || null,
        category,
        audience: audience as "players" | "parents" | "coaches" | "everyone",
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      setUrl("");
      toast.success("Resource added");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="flex flex-col gap-2">
      <Heading tone="grape">Add a resource</Heading>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Title">
          <TextInput
            value={title}
            placeholder="Team rules"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Category">
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="rules">Team rules</option>
            <option value="expectations">Expectations</option>
            <option value="document">Document</option>
            <option value="drill">Drill link</option>
            <option value="play">Play link</option>
          </SelectInput>
        </Field>
        <Field label="Link (optional)">
          <TextInput value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <Field label="Who sees it">
          <SelectInput value={audience} onChange={(e) => setAudience(e.target.value)}>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label="Details">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-20 w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-3 text-base font-semibold text-foreground outline-none focus:border-grape"
        />
      </Field>
      <BubbleButton
        tone="grape"
        size="lg"
        disabled={!title.trim() || create.isPending}
        onClick={() => create.mutate()}
      >
        Add resource
      </BubbleButton>
    </Panel>
  );
}

/* ---------------- direct messages ---------------- */

function DirectMessages({
  teamId,
  directory,
  meId,
  isCoach,
}: {
  teamId: string;
  directory: { user_id: string; full_name: string | null; email: string | null; role: string; jersey: string | null; player_name: string | null }[];
  meId: string | null;
  isCoach: boolean;
}) {
  const [other, setOther] = useState<string>("");
  const people = useMemo(
    () =>
      directory.filter((d) => {
        if (d.user_id === meId) return false;
        if (d.role === "parent") return false;
        return isCoach ? d.role === "player" : d.role !== "player";
      }),
    [directory, meId, isCoach],
  );

  const conv = useQuery({
    queryKey: ["direct", teamId, other],
    queryFn: () => ensureDirectConversation(teamId, other),
    enabled: !!teamId && !!other,
  });

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
      <Panel className="flex flex-col gap-2">
        <Heading>{isCoach ? "Players" : "Coaches"}</Heading>
        {people.length ? (
          people.map((p) => (
            <BubbleButton
              key={p.user_id}
              tone={other === p.user_id ? "grape" : "neutral"}
              className="justify-start"
              onClick={() => setOther(p.user_id)}
            >
              {p.jersey ? `#${p.jersey} ` : ""}
              {p.full_name ?? p.player_name ?? p.email ?? "Team member"}
            </BubbleButton>
          ))
        ) : (
          <EmptyState>No one to message yet</EmptyState>
        )}
      </Panel>
      <Panel className="flex flex-col gap-2">
        {conv.data ? (
          <Chat
            conversationId={conv.data}
            teamId={teamId}
            directory={directory as never}
            meId={meId}
            canPost
            canAttach={isCoach}
          />
        ) : (
          <EmptyState>Pick someone to start a private conversation</EmptyState>
        )}
      </Panel>
    </div>
  );
}
