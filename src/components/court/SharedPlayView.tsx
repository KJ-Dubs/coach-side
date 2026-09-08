import { useQuery } from "@tanstack/react-query";
import { Label, Panel } from "@/components/Bubbles";
import { PlayPresenter } from "@/components/court/PlayPresenter";
import { getSharedPlay, type SharedPlayBundle } from "@/lib/share.functions";

/** Public, read-only, login-free animated play viewer. */
export function SharedPlayView({ token }: { token: string }) {
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-2 p-2 sm:p-3">
      <PlayPresenter play={bundle.data.play} frames={bundle.data.frames} />
    </div>
  );
}
