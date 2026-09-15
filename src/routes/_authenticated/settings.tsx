import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LockerAccessPanel } from "@/components/locker/AccessPanel";
import { AppShell } from "@/components/AppShell";
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
  TextInput,
} from "@/components/Bubbles";
import {
  createInvite,
  fetchInvites,
  fetchOrgMembers,
  fetchTeams,
  inviteUrl,
  logoSignedUrl,
  revokeInvite,
  updateOrg,
  updateProfile,
  updateTeam,
  lockerCalendarUrl,
  uploadTeamLogo,
} from "@/lib/data";
import { useMe } from "@/lib/useMe";
import { ROLE_LABEL, type CoachInvite, type CoachRole, type Team } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CoachSide" },
      {
        name: "description",
        content:
          "Account, team information, logo, game defaults and assistant-coach access for your CoachSide program.",
      },
      { property: "og:title", content: "Settings — CoachSide" },
      {
        property: "og:description",
        content: "Team info, game defaults and coach access in one place.",
      },
    ],
  }),
  component: SettingsPage,
});

const PERIOD_PRESETS = [6, 7, 8, 10, 12, 16, 18, 20];
const OT_PRESETS = [2, 3, 4, 5];

function SettingsPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams, enabled: !!me.user });
  const [teamId, setTeamId] = useState<string>("");

  useEffect(() => {
    if (!teamId && teams.data?.length) setTeamId(teams.data[0]!.id);
  }, [teams.data, teamId]);

  const team = teams.data?.find((t) => t.id === teamId) ?? null;

  return (
    <AppShell title="Settings" subtitle="Account, team, game defaults and coach access">
      <div className="grid gap-3 lg:grid-cols-2">
        <AccountCard
          email={me.user?.email ?? me.profile?.email ?? ""}
          fullName={me.profile?.full_name ?? ""}
          orgName={me.org?.name ?? ""}
          orgId={me.org?.id ?? null}
          isHeadCoach={me.isHeadCoach}
          role={me.role}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["profile"] });
            void queryClient.invalidateQueries({ queryKey: ["org"] });
          }}
        />

        <Panel className="flex flex-col gap-3">
          <div className="flex justify-center"><Heading tone="flame" className="text-center">Team information</Heading></div>
          <div className="flex flex-wrap items-center gap-2">
            <Label>Team</Label>
            {teams.data?.map((t) => (
              <BubbleButton
                key={t.id}
                size="sm"
                tone={t.id === teamId ? "grape" : "neutral"}
                onClick={() => setTeamId(t.id)}
              >
                {t.name}
              </BubbleButton>
            ))}
            {teams.isLoading ? <Pill tone="muted">Loading…</Pill> : null}
            {!teams.isLoading && !teams.data?.length ? (
              <Link to="/roster">
                <BubbleButton size="sm" tone="flame">
                  + Add a team in Rosters
                </BubbleButton>
              </Link>
            ) : null}
          </div>
          {team ? (
            <TeamCard
              key={team.id}
              team={team}
              onSaved={() => void queryClient.invalidateQueries({ queryKey: ["teams"] })}
            />
          ) : (
            <EmptyState>Pick a team to edit its details</EmptyState>
          )}
        </Panel>

        {team ? <LockerAccessPanel key={`access-${team.id}`} team={team} /> : null}

        {team ? (
          <GameDefaultsCard
            key={`defaults-${team.id}`}
            team={team}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["teams"] })}
          />
        ) : null}

        {team ? (
          <CalendarDefaultsCard
            key={`cal-${team.id}`}
            team={team}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["teams"] })}
          />
        ) : null}

        <CoachAccessCard
          orgId={me.org?.id ?? null}
          orgName={me.org?.name ?? "your program"}
          isHeadCoach={me.isHeadCoach}
          myUserId={me.user?.id ?? null}
          teams={teams.data ?? []}
        />
      </div>
    </AppShell>
  );
}

/* ---------------- account ---------------- */

function AccountCard({
  email,
  fullName,
  orgName,
  orgId,
  isHeadCoach,
  role,
  onSaved,
}: {
  email: string;
  fullName: string;
  orgName: string;
  orgId: string | null;
  isHeadCoach: boolean;
  role: CoachRole | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(fullName);
  const [program, setProgram] = useState(orgName);
  useEffect(() => setName(fullName), [fullName]);
  useEffect(() => setProgram(orgName), [orgName]);

  const save = useMutation({
    mutationFn: async () => {
      await updateProfile({ full_name: name.trim() || null });
      if (isHeadCoach && orgId && program.trim() && program.trim() !== orgName) {
        await updateOrg(orgId, { name: program.trim() });
      }
    },
    onSuccess: () => {
      onSaved();
      toast.success("Account saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-2 text-center">
        <Heading className="text-center">Personal / Account</Heading>
        {role ? <Pill tone={role === "head_coach" ? "flame" : "grape"}>{ROLE_LABEL[role]}</Pill> : null}
      </div>
      <Field label="Email">
        <TextInput value={email} disabled readOnly />
      </Field>
      <Field label="Coach name">
        <TextInput
          placeholder="e.g. Coach Rivera"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Program / school">
        <TextInput
          placeholder="e.g. Home School Basketball"
          value={program}
          disabled={!isHeadCoach || !orgId}
          onChange={(e) => setProgram(e.target.value)}
        />
      </Field>
      {!isHeadCoach ? (
        <Note>Only the head coach can rename the program.</Note>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <BubbleButton tone="grape" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save account"}
        </BubbleButton>
        <Link to="/profile">
          <BubbleButton tone="ghost">View profile</BubbleButton>
        </Link>
      </div>
    </Panel>
  );
}

/* ---------------- team ---------------- */

function TeamCard({ team, onSaved }: { team: Team; onSaved: () => void }) {
  const [name, setName] = useState(team.name);
  const [season, setSeason] = useState(team.season);
  const [headCoach, setHeadCoach] = useState(team.head_coach_name ?? "");
  const [assistants, setAssistants] = useState(team.assistant_coaches ?? "");
  const [logo, setLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void logoSignedUrl(team.logo_url).then((url) => {
      if (alive) setLogo(url);
    });
    return () => {
      alive = false;
    };
  }, [team.logo_url]);

  const save = useMutation({
    mutationFn: () =>
      updateTeam(team.id, {
        name: name.trim() || team.name,
        season: season.trim() || team.season,
        head_coach_name: headCoach.trim() || null,
        assistant_coaches: assistants.trim() || null,
      }),
    onSuccess: () => {
      onSaved();
      toast.success("Team saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Logo must be under 3 MB");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadTeamLogo(team.id, file);
      setLogo(await logoSignedUrl(path));
      onSaved();
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = useMutation({
    mutationFn: () => updateTeam(team.id, { logo_url: null }),
    onSuccess: () => {
      setLogo(null);
      onSaved();
      toast.success("Logo removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center">
        <h3 className="text-xl font-black leading-tight text-foreground sm:text-2xl">{team.name}</h3>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{team.season}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2/80">
          {logo ? (
            <img src={logo} alt={`${team.name} logo`} className="h-full w-full object-contain" />
          ) : (
            <Pill tone="muted">No logo</Pill>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label>Team logo</Label>
          <div className="flex flex-wrap gap-2">
            <BubbleButton
              size="sm"
              tone="flame"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : logo ? "Replace logo" : "Upload logo"}
            </BubbleButton>
            {logo ? (
              <BubbleButton
                size="sm"
                tone="ghost"
                disabled={removeLogo.isPending}
                onClick={() => removeLogo.mutate()}
              >
                Remove
              </BubbleButton>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Team name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Season">
          <TextInput
            placeholder="2025-26"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
        </Field>
        <Field label="Head coach name">
          <TextInput
            placeholder="Head coach"
            value={headCoach}
            onChange={(e) => setHeadCoach(e.target.value)}
          />
        </Field>
        <Field label="Assistant coach(es)">
          <TextInput
            placeholder="Comma-separated names"
            value={assistants}
            onChange={(e) => setAssistants(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <BubbleButton tone="grape" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save team"}
        </BubbleButton>
        <Link to="/roster" search={{ team: team.id }}>
          <BubbleButton tone="ghost">Open roster</BubbleButton>
        </Link>
      </div>
    </div>
  );
}

/* ---------------- calendar defaults ---------------- */

function CalendarDefaultsCard({ team, onSaved }: { team: Team; onSaved: () => void }) {
  const [homeGym, setHomeGym] = useState(team.home_gym ?? "");
  const [practiceSpot, setPracticeSpot] = useState(team.default_practice_location ?? "");
  const [arrival, setArrival] = useState<number>(team.default_arrival_offset_minutes ?? 60);
  const [gameRem, setGameRem] = useState<number>(team.default_game_reminder_minutes ?? 60);
  const [practiceRem, setPracticeRem] = useState<number>(
    team.default_practice_reminder_minutes ?? 60,
  );
  const [tz, setTz] = useState(
    team.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/Los_Angeles",
  );

  const save = useMutation({
    mutationFn: () =>
      updateTeam(team.id, {
        home_gym: homeGym.trim() || null,
        default_practice_location: practiceSpot.trim() || null,
        default_arrival_offset_minutes: arrival,
        default_game_reminder_minutes: gameRem,
        default_practice_reminder_minutes: practiceRem,
        timezone: tz,
      }),
    onSuccess: () => {
      onSaved();
      toast.success("Calendar defaults saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const feed = team.locker_token ? lockerCalendarUrl(team.locker_token) : "";

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-2 text-center">
        <Heading tone="grape" className="text-center">Calendar</Heading>
        <Pill tone="muted" className="text-sm font-black">{team.name}</Pill>
      </div>
      <Note>These pre-fill new practices and games on the team calendar.</Note>
      <Field label="Home gym">
        <TextInput value={homeGym} placeholder="School Main Gym" onChange={(e) => setHomeGym(e.target.value)} />
      </Field>
      <Field label="Default practice location">
        <TextInput value={practiceSpot} placeholder="Main Gym" onChange={(e) => setPracticeSpot(e.target.value)} />
      </Field>
      <Field label="Arrival before tip-off">
        <div className="flex flex-wrap gap-2">
          {[45, 60, 75, 90].map((m) => (
            <BubbleButton key={m} size="sm" tone={arrival === m ? "flame" : "neutral"} onClick={() => setArrival(m)}>
              {m} min
            </BubbleButton>
          ))}
        </div>
      </Field>
      <Field label="Default game reminder">
        <div className="flex flex-wrap gap-2">
          {[30, 60, 120].map((m) => (
            <BubbleButton key={m} size="sm" tone={gameRem === m ? "flame" : "neutral"} onClick={() => setGameRem(m)}>
              {m >= 60 ? `${m / 60} hr before` : `${m} min before`}
            </BubbleButton>
          ))}
        </div>
      </Field>
      <Field label="Default practice reminder">
        <div className="flex flex-wrap gap-2">
          {[30, 60, 120].map((m) => (
            <BubbleButton key={m} size="sm" tone={practiceRem === m ? "grape" : "neutral"} onClick={() => setPracticeRem(m)}>
              {m >= 60 ? `${m / 60} hr before` : `${m} min before`}
            </BubbleButton>
          ))}
        </div>
      </Field>
      <Field label="Timezone">
        <TextInput value={tz} onChange={(e) => setTz(e.target.value)} />
      </Field>
      <Field label="Share with players, families and other calendars">
        <div className="flex flex-wrap gap-2">
          {team.locker_enabled && feed ? (
            <>
              <BubbleButton
                size="sm"
                tone="grape"
                onClick={() => {
                  void navigator.clipboard?.writeText(feed);
                  toast.success("Calendar link copied");
                }}
              >
                Copy calendar link
              </BubbleButton>
              <a
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed.replace(/^https?:/, "webcal:"))}`}
                target="_blank"
                rel="noreferrer"
              >
                <BubbleButton size="sm" tone="flame">Add to Google Calendar</BubbleButton>
              </a>
            </>
          ) : (
            <Pill tone="muted">Turn on the subscribe link from the Calendar page</Pill>
          )}
        </div>
      </Field>
      <div className="flex justify-center"><BubbleButton tone="flame" disabled={save.isPending} onClick={() => save.mutate()}>
        Save calendar defaults
      </BubbleButton></div>
    </Panel>
  );
}

/* ---------------- game defaults ---------------- */

function GameDefaultsCard({ team, onSaved }: { team: Team; onSaved: () => void }) {
  const [periods, setPeriods] = useState<number>(team.default_periods ?? 4);
  const [minutes, setMinutes] = useState<number>(team.default_period_minutes ?? 8);
  const [customMin, setCustomMin] = useState<string>("");
  const [ot, setOt] = useState<number>(team.default_overtime_minutes ?? 4);

  const usingCustom = !PERIOD_PRESETS.includes(minutes);

  const save = useMutation({
    mutationFn: () =>
      updateTeam(team.id, {
        default_periods: periods,
        default_period_minutes: minutes,
        default_overtime_minutes: ot,
      }),
    onSuccess: () => {
      onSaved();
      toast.success("Game defaults saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-2 text-center">
        <Heading tone="neutral" className="text-center">Basketball game defaults</Heading>
        <Pill tone="muted" className="text-sm font-black">{team.name}</Pill>
      </div>
      <Note>These pre-fill the Start a Game setup. You can still change them per game.</Note>
      <Field label="Period structure">
        <div className="flex flex-wrap gap-2">
          {[4, 2].map((p) => (
            <BubbleButton
              key={p}
              size="sm"
              tone={periods === p ? "flame" : "neutral"}
              onClick={() => setPeriods(p)}
            >
              {p === 4 ? "4 Quarters" : "2 Halves"}
            </BubbleButton>
          ))}
        </div>
      </Field>
      <Field label="Period length">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_PRESETS.map((m) => (
            <BubbleButton
              key={m}
              size="sm"
              tone={minutes === m ? "grape" : "neutral"}
              onClick={() => {
                setMinutes(m);
                setCustomMin("");
              }}
            >
              {m} min
            </BubbleButton>
          ))}
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface-2/70 px-3 py-1">
            <Label className="px-0">Custom</Label>
            <input
              inputMode="numeric"
              className="w-14 rounded-full border border-input bg-surface px-2 py-1 text-center text-sm font-bold text-foreground outline-none focus:border-grape"
              placeholder={usingCustom ? String(minutes) : "—"}
              value={customMin}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setCustomMin(v);
                const n = Number(v);
                if (n >= 1 && n <= 30) setMinutes(n);
              }}
            />
          </div>
        </div>
      </Field>
      <Field label="Overtime length">
        <div className="flex flex-wrap gap-2">
          {OT_PRESETS.map((m) => (
            <BubbleButton
              key={m}
              size="sm"
              tone={ot === m ? "flame" : "neutral"}
              onClick={() => setOt(m)}
            >
              {m} min
            </BubbleButton>
          ))}
        </div>
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <BubbleButton tone="grape" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save defaults"}
        </BubbleButton>
        <Pill tone="muted">
          {periods === 4 ? "4" : "2"} × {minutes} min · OT {ot} min
        </Pill>
      </div>
    </Panel>
  );
}

/* ---------------- coach access ---------------- */

function CoachAccessCard({
  orgId,
  orgName,
  isHeadCoach,
  myUserId,
  teams,
}: {
  orgId: string | null;
  orgName: string;
  isHeadCoach: boolean;
  myUserId: string | null;
  teams: Team[];
}) {
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => fetchOrgMembers(orgId as string),
    enabled: !!orgId,
  });
  const invites = useQuery({
    queryKey: ["invites", orgId],
    queryFn: () => fetchInvites(orgId as string),
    enabled: !!orgId,
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CoachRole>("assistant_coach");
  const [inviteTeam, setInviteTeam] = useState<string>("");

  const invite = useMutation({
    mutationFn: () =>
      createInvite({
        org_id: orgId as string,
        team_id: inviteTeam || null,
        email: email.trim().toLowerCase(),
        role,
      }),
    onSuccess: async (inv) => {
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["invites", orgId] });
      await copyLink(inv);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeInvite(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invites", orgId] });
      toast.success("Invitation revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = async (inv: CoachInvite) => {
    const url = inviteUrl(inv.token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Invite link copied — send it to ${inv.email}`);
    } catch {
      window.prompt("Copy this invite link", url);
    }
  };

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pending = (invites.data ?? []).filter(
    (i) => !i.accepted_at && new Date(i.expires_at).getTime() > Date.now(),
  );
  const used = (invites.data ?? []).filter(
    (i) => i.accepted_at || new Date(i.expires_at).getTime() <= Date.now(),
  );
  const teamName = (id: string | null) =>
    id ? (teams.find((t) => t.id === id)?.name ?? "Team") : "All teams";

  return (
    <Panel className="flex flex-col gap-3 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <Heading>Coach access</Heading>
        <Pill tone="muted">{orgName}</Pill>
        <Pill tone="flame">Head Coach</Pill>
        <Pill tone="grape">Assistant Coach</Pill>
      </div>
      <Note>
        Head coaches manage rosters, settings and invitations. Assistant coaches share the same
        rosters, games, stats and plays but cannot delete teams or change ownership.
      </Note>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Coaches on this program</Label>
          {members.isLoading ? <EmptyState>Loading coaches…</EmptyState> : null}
          {(members.data ?? []).map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/70 px-3 py-2"
            >
              <Pill tone={m.role === "head_coach" ? "flame" : "grape"}>{ROLE_LABEL[m.role]}</Pill>
              <Pill tone="neutral">{m.full_name || m.email || "Coach"}</Pill>
              {m.full_name && m.email ? <Pill tone="muted">{m.email}</Pill> : null}
              {m.user_id === myUserId ? <Pill tone="muted">You</Pill> : null}
            </div>
          ))}
          {!members.isLoading && !(members.data ?? []).length ? (
            <EmptyState>No coaches listed yet</EmptyState>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Invite a coach</Label>
          {isHeadCoach && orgId ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-2/50 p-3">
              <TextInput
                type="email"
                placeholder="assistant@school.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectInput value={role} onChange={(e) => setRole(e.target.value as CoachRole)}>
                  <option value="assistant_coach">Assistant Coach</option>
                  <option value="head_coach">Head Coach (co-head)</option>
                </SelectInput>
                <SelectInput value={inviteTeam} onChange={(e) => setInviteTeam(e.target.value)}>
                  <option value="">All teams in the program</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BubbleButton
                  tone="flame"
                  disabled={!valid || invite.isPending}
                  onClick={() => invite.mutate()}
                >
                  {invite.isPending ? "Creating…" : "Create invite & copy link"}
                </BubbleButton>
                <Note>Send the link by text or email — it works for 14 days.</Note>
              </div>
            </div>
          ) : (
            <Note>Only the head coach can invite other coaches.</Note>
          )}

          {pending.length ? (
            <div className="flex flex-col gap-2">
              <Label>Pending invitations</Label>
              {pending.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-flame/40 bg-flame/10 px-3 py-2"
                >
                  <Pill tone="neutral">{inv.email}</Pill>
                  <Pill tone={inv.role === "head_coach" ? "flame" : "grape"}>{ROLE_LABEL[inv.role]}</Pill>
                  <Pill tone="muted">{teamName(inv.team_id)}</Pill>
                  <div className="ml-auto flex gap-1.5">
                    <BubbleButton size="sm" tone="neutral" onClick={() => void copyLink(inv)}>
                      Copy link
                    </BubbleButton>
                    {isHeadCoach ? (
                      <BubbleButton
                        size="sm"
                        tone="ghost"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(inv.id)}
                      >
                        Revoke
                      </BubbleButton>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {used.length ? (
            <div className="flex flex-col gap-2">
              <Label>Past invitations</Label>
              {used.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface-2/40 px-3 py-2"
                >
                  <Pill tone="muted">{inv.email}</Pill>
                  <Pill tone={inv.accepted_at ? "success" : "muted"}>
                    {inv.accepted_at ? "Accepted" : "Expired"}
                  </Pill>
                  {isHeadCoach ? (
                    <BubbleButton
                      size="sm"
                      tone="ghost"
                      className="ml-auto"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(inv.id)}
                    >
                      Clear
                    </BubbleButton>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
