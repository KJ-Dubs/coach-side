import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BubbleButton, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { PlayPresenter } from "@/components/court/PlayPresenter";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { getSharedPlay, type SharedPlayBundle } from "@/lib/share.functions";
import { useAuth } from "@/lib/auth";

/** Public, read-only, login-free animated play viewer. */
export function SharedPlayView({ token }: { token: string }) {
  const { session, ready } = useAuth();
  const bundle = useQuery({
    queryKey: ["shared-play", token],
    queryFn: async () => {
      const raw = await getSharedPlay({ data: { token } });
      return raw ? (JSON.parse(raw) as SharedPlayBundle) : null;
    },
  });

  if (bundle.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Panel>
          <Label>Loading play…</Label>
        </Panel>
      </div>
    );
  }

  if (!bundle.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Panel className="text-center">
          <Label>This play is not shared or the link has expired</Label>
        </Panel>
      </div>
    );
  }

  const play = bundle.data.play;
  const inLibrary = !!play.published_to_library;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-2 p-2 sm:p-3">
      <PlayPresenter play={play} frames={bundle.data.frames} />

      <Panel className="flex flex-wrap items-center gap-2">
        <Label>CoachSide</Label>
        {inLibrary ? <Pill tone="grape">In the CoachSide Library</Pill> : null}
        {!ready ? (
          <Pill tone="muted">Loading…</Pill>
        ) : session && inLibrary ? (
          <AddToPlaybook play={play} compact />
        ) : session ? (
          <Note>This play has not been published to the CoachSide Library</Note>
        ) : (
          <>
            <Note>Create a free coach account to keep this play in your own playbook.</Note>
            <Link
              to="/auth"
              search={{ mode: "signup", next: `/share/${token}` }}
              className="ml-auto"
            >
              <BubbleButton tone="grape">+ Add to My Playbook</BubbleButton>
            </Link>
          </>
        )}
      </Panel>
    </div>
  );
}
