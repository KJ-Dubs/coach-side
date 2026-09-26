import { PaidGate } from "@/components/billing/PaidGate";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BubbleButton, Label, Note, Pill } from "@/components/Bubbles";
import { addLibraryPlayToTeams } from "@/lib/library";
import { fetchTeamsForPlay } from "@/lib/data";
import { trackActivity } from "@/lib/activity";
import { useCurrentTeam } from "@/lib/teamContext";
import { resolveRole, useAccess } from "@/lib/access";
import type { Play } from "@/lib/types";

/**
 * Adds a published CoachSide Library play to the coach's team(s). The play
 * itself is never copied — the team simply links to the canonical version.
 */
function AddToPlaybookInner({ play, compact }: { play: Play; compact?: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { teams, teamId } = useCurrentTeam();
  const { access } = useAccess();
  const role = resolveRole(access);
  const coachTeams = teams.filter((t) => role.canCoachTeam(t.id));
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(teamId ? [teamId] : []);

  const linked = useQuery({
    queryKey: ["play-assignments", "for-play", play.id],
    queryFn: () => fetchTeamsForPlay(play.id),
  });
  const inMine = coachTeams.filter((t) => (linked.data ?? []).includes(t.id));
  const remaining = coachTeams.filter((t) => !inMine.some((m) => m.id === t.id));

  const add = useMutation({
    mutationFn: (ids: string[]) => addLibraryPlayToTeams(play, ids),
    onSuccess: (_r, ids) => {
      for (const id of ids) void trackActivity("library_play_added_to_playbook", { teamId: id, entityId: play.id });
      void qc.invalidateQueries({ queryKey: ["play-assignments"] });
      void qc.invalidateQueries({ queryKey: ["team-plays"] });
      void qc.invalidateQueries({ queryKey: ["plays"] });
      const names = ids.map((id) => coachTeams.find((t) => t.id === id)?.name ?? "team").join(", ");
      toast.success(`Added to ${names} Playbook`, {
        action: {
          label: "View in My Playbook",
          onClick: () => void router.navigate({ to: "/plays", search: { tab: "mine" } }),
        },
      });
      setOpen(false);
      setPicked([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!coachTeams.length) {
    return <Note>Set up a team to add plays to your playbook</Note>;
  }

  return (
    <div className="flex flex-col gap-2">
      {inMine.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="success">✓ In My Playbook</Pill>
          {inMine.map((t) => (
            <Pill key={t.id} tone="muted">{t.name}</Pill>
          ))}
        </div>
      ) : null}
      {remaining.length === 1 && !inMine.length ? (
        <BubbleButton
          size={compact ? "sm" : "md"}
          tone="grape"
          disabled={add.isPending}
          onClick={() => add.mutate([remaining[0]!.id])}
        >
          {add.isPending ? "Adding…" : `+ Add to My Playbook · ${remaining[0]!.name}`}
        </BubbleButton>
      ) : remaining.length ? (
        <BubbleButton size={compact ? "sm" : "md"} tone="grape" onClick={() => setOpen((o) => !o)}>
          {inMine.length ? "+ Add to another team" : "+ Add to My Playbook"}
        </BubbleButton>
      ) : null}
      {open && remaining.length ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-grape/50 bg-grape/10 p-2">
          <Label>Choose teams</Label>
          <div className="flex flex-wrap gap-1.5">
            {remaining.map((t) => (
              <BubbleButton
                key={t.id}
                size="sm"
                tone={picked.includes(t.id) ? "grape" : "neutral"}
                onClick={() =>
                  setPicked((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]))
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
              disabled={!picked.filter((id) => remaining.some((t) => t.id === id)).length || add.isPending}
              onClick={() => add.mutate(picked.filter((id) => remaining.some((t) => t.id === id)))}
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

export function AddToPlaybook(props: Parameters<typeof AddToPlaybookInner>[0]) {
  return (
    <PaidGate module="playbook_plus" benefit="Save CoachSide Library plays straight into your team Playbook." compact>
      <AddToPlaybookInner {...props} />
    </PaidGate>
  );
}
