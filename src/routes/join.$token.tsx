import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/AuthCard";
import { BubbleButton, EmptyState, Heading, Note, Panel, Pill } from "@/components/Bubbles";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";
import { useAuth } from "@/lib/auth";
import { acceptTeamInvite, fetchInviteRoster, lookupTeamInvite } from "@/lib/locker";
import { clearPendingInvite, joinUrl, setPendingInvite } from "@/lib/pendingInvite";

export const Route = createFileRoute("/join/$token")({
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

  const invite = useQuery({
    queryKey: ["team-invite", token],
    queryFn: () => lookupTeamInvite(token),
    enabled: ready,
  });

  const isParent = invite.data?.invite_type === "parent";
  const parentLink =
    isParent && invite.data?.locker_token && invite.data.locker_enabled !== false
      ? invite.data.locker_token
      : null;

  // Parents never make an account: send them straight to the public team page.
  useEffect(() => {
    if (parentLink) navigate({ to: "/locker/$token", params: { token: parentLink }, replace: true });
  }, [parentLink, navigate]);

  const roster = useQuery({
    queryKey: ["invite-roster", token],
    queryFn: () => fetchInviteRoster(token),
    enabled: signedIn && invite.data?.invite_type === "player",
  });

  const join = useMutation({
    mutationFn: () => acceptTeamInvite(token, invite.data?.invite_type === "player" ? playerId || null : null),
    onSuccess: () => {
      toast.success("You're in — welcome to the Locker Room");
      navigate({ to: "/lockerroom", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
            Create your CoachSide player account or sign in, and you&apos;ll join the team right
            after.
          </Note>
          <AuthCard
            initialMode="signup"
            hideOrgField
            playerSignup
            signupTitle="Create your player account"
            onDone={() => undefined}
          />
        </>
      ) : invite.isLoading ? (
        <Panel className="w-full">
          <EmptyState>Checking this invite link…</EmptyState>
        </Panel>
      ) : !invite.data ? (
        <Panel className="w-full">
          <EmptyState>This invite link is not valid. Ask your coach for a new one.</EmptyState>
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
              <Note tone="grape">Pick your name on the roster so your coach knows who you are.</Note>
              <div className="grid gap-2 sm:grid-cols-2">
                {(roster.data ?? []).map((p) => (
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
                    {p.taken ? <Pill tone="muted">Claimed</Pill> : null}
                  </button>
                ))}
              </div>
              {!roster.data?.length ? (
                <EmptyState>No roster players yet — you can still join and claim later</EmptyState>
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
            disabled={join.isPending}
            onClick={() => join.mutate()}
          >
            Join the team
          </BubbleButton>
        </Panel>
      )}
    </main>
  );
}
