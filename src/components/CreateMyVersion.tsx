import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BubbleButton, Note, Panel } from "@/components/Bubbles";
import {
  copyPlayForMe,
  fetchCoachLabel,
  fetchMyCoachLabel,
  versionTitle,
} from "@/lib/playOwnership";
import type { Play } from "@/lib/types";

/**
 * A coach who did not create a play never edits the original. This explains
 * that, then copies the play and its frames into a play they own.
 */
export function CreateMyVersion({
  play,
  teamIds,
  size = "sm",
  label = "Create My Version",
}: {
  play: Play;
  teamIds?: string[];
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const author = useQuery({
    queryKey: ["coach-label", play.created_by],
    queryFn: () => fetchCoachLabel(play.created_by),
    enabled: open && !!play.created_by,
  });

  const run = async () => {
    setBusy(true);
    try {
      const mine = await fetchMyCoachLabel();
      const newId = await copyPlayForMe({
        playId: play.id,
        name: versionTitle(play.name, mine),
        ...(teamIds?.length ? { teamIds } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["plays"] });
      await queryClient.invalidateQueries({ queryKey: ["play-assignments"] });
      toast.success("Your version is ready — the original was not changed");
      void navigate({ to: "/plays/$playId", params: { playId: newId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <BubbleButton size={size} tone="grape" onClick={() => setOpen(true)}>
        {label}
      </BubbleButton>
    );
  }

  return (
    <Panel className="flex flex-col gap-2 text-center">
      <Note>
        {play.created_by
          ? `This play was created by ${author.data ?? "another coach"}. To edit it, CoachSide will create your own version. The original will stay unchanged.`
          : "This play has no confirmed author yet, so it stays read-only. CoachSide can create your own version to edit."}
      </Note>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <BubbleButton size={size} tone="grape" disabled={busy} onClick={() => void run()}>
          {busy ? "Creating…" : "Create My Version"}
        </BubbleButton>
        <BubbleButton size={size} tone="ghost" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </BubbleButton>
      </div>
    </Panel>
  );
}

/** Subtle "Original by Coach X" line for detail/version context. */
export function PlayLineage({ play }: { play: Play }) {
  const originalOwner = play.source_creator_id ?? null;
  const author = useQuery({
    queryKey: ["coach-label", originalOwner],
    queryFn: () => fetchCoachLabel(originalOwner),
    enabled: !!originalOwner,
  });
  if (!originalOwner || !author.data) return null;
  return <Note>Based on the original by {author.data}</Note>;
}
