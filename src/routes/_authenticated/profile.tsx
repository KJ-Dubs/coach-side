import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { NotificationPrefsPanel } from "@/components/NotificationPrefsPanel";
import {
  BubbleButton,
  EmptyState,
  Field,
  Heading,
  Label,
  Note,
  Panel,
  Pill,
  TextInput,
} from "@/components/Bubbles";
import { fetchPlayers, updateProfile } from "@/lib/data";
import { initialsOf } from "@/lib/auth";
import { useAccess } from "@/lib/access";
import { useMe } from "@/lib/useMe";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Coach Profile — CoachSide" },
      {
        name: "description",
        content: "Your coach name, email, role, program and assigned teams in CoachSide.",
      },
      { property: "og:title", content: "Coach Profile — CoachSide" },
      { property: "og:description", content: "Coach name, role, program and assigned teams." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const me = useMe();
  const { access } = useAccess();
  const queryClient = useQueryClient();
  const [name, setName] = useState(me.profile?.full_name ?? "");
  useEffect(() => setName(me.profile?.full_name ?? ""), [me.profile?.full_name]);

  const save = useMutation({
    mutationFn: () => updateProfile({ full_name: name.trim() || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPlayer = access.isPlayerOnly;
  const playerTeamId = access.playerTeamIds[0] ?? null;
  const playerTeam = me.teams.find((t) => t.id === playerTeamId) ?? null;
  const roster = useQuery({
    queryKey: ["players", playerTeamId],
    queryFn: () => fetchPlayers(playerTeamId!),
    enabled: isPlayer && !!playerTeamId,
  });
  const myPlayer = {
    data: (roster.data ?? []).find((p) => p.id === access.playerId) ?? null,
  };

  const email = me.user?.email ?? me.profile?.email ?? "";


  return (
    <AppShell
      title="Profile"
      subtitle={isPlayer ? "Your player account" : "Who you are in this program"}
      actions={
        isPlayer ? undefined : (
          <Link to="/settings">
            <BubbleButton size="sm" tone="neutral">
              Settings
            </BubbleButton>
          </Link>
        )
      }
    >

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-grape/60 bg-grape/25 text-xl font-black text-foreground">
              {initialsOf(me.profile?.full_name, email)}
            </div>
            <div className="flex flex-col gap-2">
              <Heading>{me.profile?.full_name || "Coach"}</Heading>
              <div className="flex flex-wrap gap-2">
                {me.role ? (
                  <Pill tone={me.role === "head_coach" ? "flame" : "grape"}>{ROLE_LABEL[me.role]}</Pill>
                ) : (
                  <Pill tone="muted">Role pending</Pill>
                )}
                {me.org ? <Pill tone="neutral">{me.org.name}</Pill> : null}
              </div>
            </div>
          </div>
          <Field label="Coach name">
            <TextInput
              placeholder="Your name as players see it"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email">
            <TextInput value={email} disabled readOnly />
          </Field>
          <Note>Email is your sign-in and cannot be changed here.</Note>
          <BubbleButton tone="grape" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save profile"}
          </BubbleButton>
        </Panel>

        {isPlayer ? (
          <Panel className="flex flex-col gap-3">
            <Heading tone="flame">Your team</Heading>
            <div className="flex flex-wrap gap-2">
              {playerTeam ? <Pill tone="grape">{playerTeam.name}</Pill> : null}
              {playerTeam ? <Pill tone="muted">{playerTeam.season}</Pill> : null}
              {myPlayer.data ? <Pill tone="flame">#{myPlayer.data.jersey}</Pill> : null}
              {myPlayer.data ? <Pill tone="neutral">{myPlayer.data.name}</Pill> : null}
            </div>
            <Note>
              Your account is linked to this roster spot by your coach. Ask your coach if it needs to
              change.
            </Note>
          </Panel>
        ) : (
          <Panel className="flex flex-col gap-3">
            <Heading tone="flame">Assigned teams</Heading>
            {me.loading ? <EmptyState>Loading teams…</EmptyState> : null}
            {!me.loading && !me.teams.length ? (
              <EmptyState>No teams yet — add one in Rosters</EmptyState>
            ) : null}
            <div className="flex flex-col gap-2">
              {me.teams.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/70 px-3 py-2"
                >
                  <Pill tone="grape">{t.name}</Pill>
                  <Pill tone="muted">{t.season}</Pill>
                  {t.head_coach_name ? <Pill tone="neutral">HC {t.head_coach_name}</Pill> : null}
                  <div className="ml-auto flex gap-1.5">
                    <Link to="/roster">
                      <BubbleButton size="sm" tone="neutral">
                        Roster
                      </BubbleButton>
                    </Link>
                    <Link to="/stats/team" search={{ team: t.id }}>
                      <BubbleButton size="sm" tone="ghost">
                        Stats
                      </BubbleButton>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label>Access</Label>
              <Note>
                {me.isHeadCoach
                  ? "Full access: rosters, settings, invitations, games, stats and plays."
                  : "Shared access to rosters, games, stats and plays for your program."}
              </Note>
            </div>
          </Panel>
        )}

        <div className="lg:col-span-2">
          <NotificationPrefsPanel />
        </div>

      </div>
    </AppShell>
  );
}
