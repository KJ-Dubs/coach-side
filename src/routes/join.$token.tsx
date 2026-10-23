import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/AuthCard";
import { BubbleButton, EmptyState, Heading, Note, Panel, Pill } from "@/components/Bubbles";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";
import { useAuth } from "@/lib/auth";
import { acceptTeamInvite, fetchInviteRoster, fetchMyTeamMembership, lookupTeamInvite } from "@/lib/locker";
import { joinStateFor } from "@/lib/playerAccess";
import { clearPendingInvite, joinUrl, setPendingInvite } from "@/lib/pendingInvite";

export const Route = createFileRoute("/join/$token")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Join Your Team — CoachSide" },
      {
        name: "description",
        content:
          "Join your basketball team on CoachSide for the schedule, team messages, plays and announcements.",
      },
      { property: "og:title", content: "Join Your Team — CoachSide" },
      { property: "og:description", content: "Player and parent access to the CoachSide Locker Room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const signedIn = ready && !!session;
  const [playerId, setPlayerId] = useState<string>("");

  // Remember the invite so confirmation email / Google sign-in come back here.
  useEffect(() => {
    setPendingInvite(token);
  }, [token]);

  const invite = useQuery({
    queryKey: ["team-invite", token],
    queryFn: () => lookupTeamInvite(token),
    enabled: ready,
  });
  const teamId = invite.data?.team_id ?? null;

  const isParent = invite.data?.invite_type === "parent";
  const parentLink =
    isParent && invite.data?.locker_token && invite.data.locker_enabled !== false
      ? invite.data.locker_token
      : null;

  // Parents never make an account: send them straight to the public team page.
  useEffect(() => {
    if (parentLink) navigate({ to: "/locker/$token", params: { token: parentLink }, replace: true });
  }, [parentLink, navigate]);

  // A dead, turned-off or parent invite must never follow the visitor around.
  useEffect(() => {
    if (invite.isLoading) return;
    if (!invite.data || invite.data.status !== "active" || invite.data.invite_type !== "player") {
      clearPendingInvite();
    }
  }, [invite.isLoading, invite.data]);

  // The signed-in account's existing place on this team, if any.
  const membership = useQuery({
    queryKey: ["my-team-membership", teamId, session?.user.id ?? null],
    queryFn: () => fetchMyTeamMembership(String(teamId)),
    enabled: signedIn && !!teamId,
  });
  const state = joinStateFor(membership.data ?? null);

  const roster = useQuery({
    queryKey: ["invite-roster", token, session?.user.id ?? null],
    queryFn: () => fetchInviteRoster(token),
    enabled: signedIn && invite.data?.invite_type === "player",
  });

  const isPlayerInvite = invite.data?.invite_type === "player";
  const rosterRows = roster.data ?? [];
  const canJoin = isPlayerInvite ? !!playerId : true;
  const myRow =
    state.kind === "joined" ? rosterRows.find((r) => r.id === state.playerId) ?? null : null;

  // Already on the team: the invite is done, don't keep it pending.
  useEffect(() => {
    if (state.kind === "joined" || state.kind === "coach" || state.kind === "removed") clearPendingInvite();
  }, [state.kind]);

  const goLocker = () => {
    clearPendingInvite();
    navigate({ to: "/lockerroom", search: (teamId ? { team: teamId } : {}) as never, replace: true });
  };

  const join = useMutation({
    mutationFn: () => acceptTeamInvite(token, isPlayerInvite ? playerId || null : null),
    onSuccess: () => {
      clearPendingInvite();
      toast.success("You're in — welcome to the Locker Room");
      goLocker();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checking = invite.isLoading || (signedIn && !!teamId && membership.isLoading);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center gap-4 px-3 py-6">
      <Panel className="flex w-full flex-col items-center gap-3 p-4 text-center">
        <img src={wordmark.url} alt="CoachSide" className="h-10 w-auto max-w-[220px] object-contain" />
        <Heading tone="flame">Join your team</Heading>
        {invite.data ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill tone="grape">{invite.data.team_name}</Pill>
            <Pill tone="muted">{invite.data.season}</Pill>
            <Pill tone="flame">
              {invite.data.invite_type === "player" ? "Player access" : "Parent access"}
            </Pill>
          </div>
        ) : null}
      </Panel>

      {isParent ? (
        <Panel className="w-full">
          {parentLink ? (
            <EmptyState>Opening the team page — no account needed…</EmptyState>
          ) : (
            <EmptyState>
              The parent team page is turned off right now. Ask your coach to turn it back on.
            </EmptyState>
          )}
        </Panel>
      ) : !signedIn ? (
        <>
          <Note tone="grape">
            You&apos;re joining {invite.data?.team_name ?? "your team"}. This will not create a new
            team. Create your CoachSide player account or sign in, and you&apos;ll pick your name on
            the roster right after.
          </Note>
          <AuthCard
            initialMode="signup"
            hideOrgField
            playerSignup
            inviteToken={token}
            returnTo={joinUrl(token)}
            signupTitle="Create your player account"
            onDone={() => undefined}
          />
        </>
      ) : checking ? (
        <Panel className="w-full">
          <EmptyState>Checking this invite link…</EmptyState>
        </Panel>
      ) : !invite.data ? (
        <Panel className="w-full">
          <EmptyState>This invite link is not valid. Ask your coach for a new one.</EmptyState>
        </Panel>
      ) : state.kind === "joined" || state.kind === "coach" ? (
        <Panel className="flex w-full flex-col items-center gap-3 p-4 text-center">
          <Pill tone="success">{state.kind === "coach" ? "You coach this team" : "You're already on this team"}</Pill>
          {myRow ? (
            <span className="inline-flex items-center gap-3 rounded-2xl border border-flame bg-flame/20 px-4 py-3 text-base font-black text-foreground">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-grape/60 bg-grape/20">
                {myRow.jersey}
              </span>
              {myRow.name}
              <Pill tone="success">You</Pill>
            </span>
          ) : null}
          <BubbleButton size="lg" tone="grape" onClick={goLocker}>
            Go to the Locker Room
          </BubbleButton>
        </Panel>
      ) : state.kind === "removed" ? (
        <Panel className="w-full">
          <EmptyState>
            Your coach removed your access to {invite.data.team_name}. Ask them to restore it.
          </EmptyState>
        </Panel>
      ) : invite.data.status !== "active" ? (
        <Panel className="w-full">
          <EmptyState>
            This invite link has been {invite.data.status === "expired" ? "expired" : "turned off"} by
            the coach.
          </EmptyState>
        </Panel>
      ) : (
        <Panel className="flex w-full flex-col gap-3 p-4">
          {invite.data.invite_type === "player" ? (
            <>
              <Note tone="grape">
                {state.kind === "needs_roster_name"
                  ? `You're on ${invite.data.team_name}, but your account isn't linked to your roster name yet. Pick your name to finish.`
                  : `You're joining ${invite.data.team_name}. This will not create a new team. Pick your name on the roster to finish.`}
              </Note>
              <div className="grid gap-2 sm:grid-cols-2">
                {rosterRows.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.taken}
                    onClick={() => setPlayerId(p.id)}
                    className={
                      "flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-base font-black transition-colors disabled:opacity-40 " +
                      (playerId === p.id
                        ? "border-flame bg-flame/25 text-foreground"
                        : "border-border bg-surface-2/70 text-foreground hover:border-grape/70")
                    }
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-grape/60 bg-grape/20">
                      {p.jersey}
                    </span>
                    <span>{p.name}</span>
                    {p.mine ? <Pill tone="success">You</Pill> : p.taken ? <Pill tone="muted">Claimed</Pill> : null}
                  </button>
                ))}
              </div>
              {roster.isLoading ? <EmptyState>Loading the roster…</EmptyState> : null}
              {!roster.isLoading && !rosterRows.length ? (
                <EmptyState>Ask your coach to add you to the roster first</EmptyState>
              ) : null}
            </>
          ) : (
            <Note tone="grape">
              Parent access shows the schedule, announcements for families, locations and team
              resources. Private coach and player messages stay private.
            </Note>
          )}

          <BubbleButton
            size="lg"
            tone="grape"
            disabled={join.isPending || !canJoin}
            onClick={() => join.mutate()}
          >
            {isPlayerInvite && !playerId ? "Pick your name to join" : "Join the team"}
          </BubbleButton>
        </Panel>
      )}
    </main>
  );
}
