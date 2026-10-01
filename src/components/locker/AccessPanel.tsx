import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BubbleButton,
  EmptyState,
  Heading,
  Label,
  Note,
  Panel,
  Pill,
} from "@/components/Bubbles";
import { trackActivity, trackActivityOnce, notifyProgressChanged } from "@/lib/activity";
import { lockerUrl, resetLockerToken, setLockerSharing, updateTeam } from "@/lib/data";
import {
  ensureTeamInvite,
  fetchTeamDirectory,
  fetchTeamInvites,
  joinUrl,
  removeTeamMember,
  rotateTeamInvite,
  revokeTeamInvites,
  TEAM_ROLE_LABEL,
} from "@/lib/locker";
import type { Team } from "@/lib/types";

/** Head-coach controls for player/parent access to the Locker Room. */
export function LockerAccessPanel({ team }: { team: Team }) {
  const qc = useQueryClient();
  const invites = useQuery({
    queryKey: ["team-invites", team.id],
    queryFn: () => fetchTeamInvites(team.id),
  });
  const directory = useQuery({
    queryKey: ["team-directory", team.id],
    queryFn: () => fetchTeamDirectory(team.id),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["team-invites", team.id] });

  const make = useMutation({
    mutationFn: (type: "player" | "parent") => ensureTeamInvite(team.id, type),
    onSuccess: async (inv) => {
      await refresh();
      void navigator.clipboard?.writeText(joinUrl(inv.token));
      toast.success("Invite link copied");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotate = useMutation({
    mutationFn: (type: "player" | "parent") => rotateTeamInvite(team.id, type),
    onSuccess: async (inv) => {
      await refresh();
      void navigator.clipboard?.writeText(joinUrl(inv.token));
      toast.success("New link created and copied — the old one no longer works");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (type: "player" | "parent") => revokeTeamInvites(team.id, type),
    onSuccess: async () => {
      await refresh();
      toast.success("Link turned off");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveToggle = useMutation({
    mutationFn: (patch: Partial<Team>) => updateTeam(team.id, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const live = (type: "player" | "parent") =>
    (invites.data ?? []).find((i) => i.invite_type === type && i.active) ?? null;

  const row = (type: "player" | "parent", title: string, note: string) => {
    const inv = live(type);
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={type === "player" ? "grape" : "flame"}>{title}</Pill>
          <Pill tone={inv ? "success" : "muted"}>{inv ? "Link is live" : "No link yet"}</Pill>
        </div>
        <Note>{note}</Note>
        {inv ? <Pill tone="muted" className="max-w-full break-all">{joinUrl(inv.token)}</Pill> : null}
        <div className="flex flex-wrap gap-2">
          <BubbleButton tone="grape" onClick={() => make.mutate(type)}>
            {inv ? `Copy ${title}` : `Create ${title}`}
          </BubbleButton>
          {inv ? (
            <>
              <BubbleButton tone="neutral" onClick={() => rotate.mutate(type)}>
                Replace link
              </BubbleButton>
              <BubbleButton tone="ghost" onClick={() => revoke.mutate(type)}>
                Turn off
              </BubbleButton>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <Panel className="flex flex-col gap-3 lg:col-span-2">
      <Heading tone="grape">Locker Room access</Heading>
      <div className="grid gap-3 lg:grid-cols-2">
        {row(
          "player",
          "Player Invite Link",
          "Players open this link, create an account and pick their name from your roster.",
        )}
        <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="flame">Parent View Link</Pill>
            <Pill tone={team.locker_enabled === false ? "muted" : "success"}>
              {team.locker_enabled === false ? "Turned off" : "Link is live"}
            </Pill>
          </div>
          <Note>
            Anyone with this link can view parent-access team information: schedule, results, team
            and player stats and family announcements. No account needed, and nothing can be
            changed.
          </Note>
          {team.locker_token && team.locker_enabled !== false ? (
            <Pill tone="muted" className="max-w-full break-all">
              {lockerUrl(team.locker_token)}
            </Pill>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <BubbleButton
              tone="grape"
              onClick={async () => {
                if (team.locker_enabled === false) await setLockerSharing(team.id, true);
                await navigator.clipboard?.writeText(lockerUrl(team.locker_token));
                void trackActivity("parent_link_shared", { teamId: team.id });
                await qc.invalidateQueries({ queryKey: ["teams"] });
                toast.success("Parent link copied");
              }}
            >
              Copy link
            </BubbleButton>
            <BubbleButton
              tone="neutral"
              onClick={async () => {
                const token = await resetLockerToken(team.id);
                await navigator.clipboard?.writeText(lockerUrl(token));
                void trackActivity("parent_link_shared", { teamId: team.id });
                await qc.invalidateQueries({ queryKey: ["teams"] });
                toast.success("New parent link created and copied — the old one no longer works");
              }}
            >
              Reset link
            </BubbleButton>
            <BubbleButton
              tone="ghost"
              onClick={async () => {
                await setLockerSharing(team.id, team.locker_enabled === false);
                await qc.invalidateQueries({ queryKey: ["teams"] });
                toast.success(team.locker_enabled === false ? "Parent link turned on" : "Parent link disabled");
              }}
            >
              {team.locker_enabled === false ? "Turn on" : "Disable link"}
            </BubbleButton>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label>Team chat</Label>
        <BubbleButton
          tone={team.allow_player_posting === false ? "neutral" : "grape"}
          onClick={() =>
            saveToggle.mutate({ allow_player_posting: team.allow_player_posting === false })
          }
        >
          {team.allow_player_posting === false
            ? "Players can't post — tap to allow"
            : "Players can post — tap to make it coach-only"}
        </BubbleButton>
        <BubbleButton
          tone={team.require_ack_default ? "flame" : "neutral"}
          onClick={() => saveToggle.mutate({ require_ack_default: !team.require_ack_default })}
        >
          {team.require_ack_default
            ? "Announcements ask for acknowledgment"
            : "Announcements don't ask for acknowledgment"}
        </BubbleButton>
      </div>

      <Label>Team members</Label>
      <div className="flex flex-wrap gap-2">
        {(directory.data ?? []).length ? (
          (directory.data ?? []).map((d) => (
            <span
              key={d.user_id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/70 px-3 py-1.5 text-xs font-bold text-foreground"
            >
              {d.jersey ? `#${d.jersey} ` : ""}
              {d.full_name ?? d.player_name ?? d.email ?? "Member"} · {TEAM_ROLE_LABEL[d.role]}
            </span>
          ))
        ) : (
          <EmptyState>No players or parents have joined yet</EmptyState>
        )}
      </div>
      <Note>
        Removing someone takes away their Locker Room access right away. Share links only with your
        team.
      </Note>
      <div className="flex flex-wrap gap-2">
        {(directory.data ?? [])
          .filter((d) => d.role === "player" || d.role === "parent")
          .map((d) => (
            <BubbleButton
              key={`remove-${d.user_id}`}
              size="sm"
              tone="ghost"
              onClick={async () => {
                await removeTeamMember(team.id, d.user_id);
                await qc.invalidateQueries({ queryKey: ["team-directory", team.id] });
                toast.success("Access removed");
              }}
            >
              Remove {d.full_name ?? d.player_name ?? d.email ?? "member"}
            </BubbleButton>
          ))}
      </div>
    </Panel>
  );
}
