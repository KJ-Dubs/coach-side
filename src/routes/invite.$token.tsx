import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthCard } from "@/components/AuthCard";
import { BubbleButton, EmptyState, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { acceptInvite, lookupInvite } from "@/lib/data";
import { ROLE_LABEL } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Coach Invitation — CoachSide" },
      {
        name: "description",
        content: "Accept your coaching staff invitation to share team rosters, games, stats and plays.",
      },
      { property: "og:title", content: "Coach Invitation — CoachSide" },
      { property: "og:description", content: "Join a CoachSide coaching staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signedIn = ready && !!session;

  const invite = useQuery({
    queryKey: ["invite", token],
    queryFn: () => lookupInvite(token),
    // Invite details are only visible to signed-in users.
    enabled: signedIn,
  });

  const accept = useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("You're on the staff");
      navigate({ to: "/dashboard", replace: true });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not accept invite"),
  });

  const info = invite.data;

  return (
    <main className="flex min-h-screen items-center justify-center px-3 py-6">
      <div className="flex w-full max-w-md flex-col gap-3">
        <Panel className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="flame">Coaching staff invite</Pill>
            {info ? <Pill tone="muted">{ROLE_LABEL[info.role]}</Pill> : null}
          </div>
          {invite.isLoading ? (
            <Pill tone="muted">Loading invite…</Pill>
          ) : !info ? (
            <EmptyState>This invite link is not valid.</EmptyState>
          ) : info.status !== "pending" ? (
            <EmptyState>
              {info.status === "accepted" ? "This invite was already used." : "This invite has expired."}
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label>Program</Label>
                <Pill>{info.org_name}</Pill>
                {info.team_name ? <Pill tone="grape">{info.team_name}</Pill> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label>Invited email</Label>
                <Pill tone="muted">{info.email}</Pill>
              </div>
              <Note>
                Accepting shares this program's rosters, games, stats and plays with your account.
              </Note>
            </div>
          )}
        </Panel>

        {info && info.status === "pending" ? (
          ready && session ? (
            <Panel className="flex flex-wrap items-center gap-2">
              <Pill tone="muted">Signed in</Pill>
              <BubbleButton
                tone="flame"
                disabled={accept.isPending}
                onClick={() => accept.mutate()}
              >
                {accept.isPending ? "Joining…" : "Accept invitation"}
              </BubbleButton>
            </Panel>
          ) : (
            <AuthCard
              initialMode="signup"
              lockSignup
              defaultOrgName={info.org_name}
              banner={<Pill tone="grape">Create your account to join {info.org_name}</Pill>}
              onDone={() => accept.mutate()}
            />
          )
        ) : null}
      </div>
    </main>
  );
}
