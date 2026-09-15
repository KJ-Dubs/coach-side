import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BubbleButton, Label, Note, Pill } from "@/components/Bubbles";
import { addLibraryPlayToTeams } from "@/lib/library";
import { useCurrentTeam } from "@/lib/teamContext";
import { resolveRole, useAccess } from "@/lib/access";
import type { Play } from "@/lib/types";

/**
 * Adds a published CoachSide Library play to the coach's team(s). The play
 * itself is never copied — the team simply links to the published version.
 */
export function AddToPlaybook({ play, compact }: { play: Play; compact?: boolean }) {
  const qc = useQueryClient();
  const { teams, teamId } = useCurrentTeam();
  const { access } = useAccess();
  const role = resolveRole(access);
  const coachTeams = teams.filter((t) => role.canCoachTeam(t.id));
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(teamId ? [teamId] : []);

  const add = useMutation({
    mutationFn: (ids: string[]) => addLibraryPlayToTeams(play, ids),
    onSuccess: (_r, ids) => {
      void qc.invalidateQueries({ queryKey: ["play-assignments"] });
      void qc.invalidateQueries({ queryKey: ["plays"] });
      const names = ids
        .map((id) => coachTeams.find((t) => t.id === id)?.name ?? "team")
        .join(", ");
      toast.success(`Added to ${names} Playbook`);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!coachTeams.length) {
    return <Note>Set up a team to add plays to your playbook</Note>;
  }

  if (coachTeams.length === 1) {
    const only = coachTeams[0]!;
    return (
      <BubbleButton
        size={compact ? "sm" : "md"}
        tone="grape"
        disabled={add.isPending}
        onClick={() => add.mutate([only.id])}
      >
        + Add to My Playbook
      </BubbleButton>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <BubbleButton size={compact ? "sm" : "md"} tone="grape" onClick={() => setOpen((o) => !o)}>
        + Add to My Playbook
      </BubbleButton>
      {open ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-grape/50 bg-grape/10 p-2">
          <Label>Add to teams</Label>
          <div className="flex flex-wrap gap-1.5">
            {coachTeams.map((t) => (
              <BubbleButton
                key={t.id}
                size="sm"
                tone={picked.includes(t.id) ? "grape" : "neutral"}
                onClick={() =>
                  setPicked((cur) =>
                    cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id],
                  )
                }
              >
                {picked.includes(t.id) ? "✓ " : ""}
                {t.name}
              </BubbleButton>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BubbleButton
              size="sm"
              tone="flame"
              disabled={!picked.length || add.isPending}
              onClick={() => add.mutate(picked)}
            >
              {add.isPending ? "Adding…" : "Add"}
            </BubbleButton>
            <Pill tone="muted">{picked.length} selected</Pill>
          </div>
        </div>
      ) : null}
    </div>
  );
}
