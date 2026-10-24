import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { BubbleButton, InfoPanel, Label, Panel, Pill } from "@/components/Bubbles";
import { AddToFolderPanel } from "@/components/playbook/Folders";
import { trackActivity } from "@/lib/activity";
import { resolveRole, useAccess } from "@/lib/access";
import { createPlayShareLink, fetchTeamsForPlay, setPlayTeams } from "@/lib/data";
import { publishPlay, setPlayAnonymous, unpublishPlay } from "@/lib/library";
import { isPlayOwner } from "@/lib/playOwnership";
import { useCurrentTeam } from "@/lib/teamContext";
import { useMe } from "@/lib/useMe";
import type { Play } from "@/lib/types";

type PanelKey = "none" | "teams" | "folders" | "publish";

/**
 * Coach-only action bar for the play slideshow. Reuses the Playbook's exact
 * sharing, team assignment, folder membership and publishing paths; it never
 * copies a play or changes who owns it.
 */
export function PlayActions({ play }: { play: Play }) {
  const qc = useQueryClient();
  const me = useMe();
  const { access } = useAccess();
  const role = resolveRole(access);
  const { teams, teamId } = useCurrentTeam();
  const [panel, setPanel] = useState<PanelKey>("none");
  const owner = isPlayOwner(play, me.user?.id ?? null);
  const coachTeams = teams.filter((t) => role.canCoachTeam(t.id));

  const linked = useQuery({
    queryKey: ["play-assignments", "for-play", play.id],
    queryFn: () => fetchTeamsForPlay(play.id),
    enabled: access.isCoach,
  });
  const assigned = coachTeams.filter((t) => (linked.data ?? []).includes(t.id) || play.team_id === t.id);
  const assignedIds = assigned.map((t) => t.id);
  const [picked, setPicked] = useState<string[]>([]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["play", play.id] });
    void qc.invalidateQueries({ queryKey: ["plays"] });
    void qc.invalidateQueries({ queryKey: ["library-feed"] });
  };

  const share = useMutation({
    mutationFn: async () => {
      // Team share link when the coach can make one; Library page for published plays otherwise.
      if (owner || assigned.length) return `${window.location.origin}/share/${await createPlayShareLink(play.id)}`;
      if (play.published_to_library) return `${window.location.origin}/library/${play.id}`;
      throw new Error("Add this play to one of your teams to share it");
    },
    onSuccess: async (url) => {
      void trackActivity("play_shared", { entityId: play.id });
      refresh();
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (typeof nav.share === "function") {
        try {
          await nav.share({ title: play.name, text: `${play.name} — CoachSide play`, url });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied");
      } catch {
        toast.success(`Share link: ${url}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTeams = useMutation({
    mutationFn: (ids: string[]) => setPlayTeams(play.id, ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["play-assignments"] });
      void qc.invalidateQueries({ queryKey: ["team-plays"] });
      refresh();
      toast.success("Team access updated");
      setPanel("none");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: (anonymous: boolean) => publishPlay(play, me.profile?.full_name ?? null, anonymous),
    onSuccess: (_r, anonymous) => {
      refresh();
      toast.success(anonymous ? "Published to the CoachSide Library as Anonymous Coach" : "Published to the CoachSide Library");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const anonymize = useMutation({
    mutationFn: (anonymous: boolean) => setPlayAnonymous(play.id, anonymous),
    onSuccess: (_r, anonymous) => {
      refresh();
      toast.success(anonymous ? "Now credited to Anonymous Coach" : "Now credited to your handle");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unpublish = useMutation({
    mutationFn: () => unpublishPlay(play.id),
    onSuccess: () => {
      refresh();
      toast.success("Removed from the CoachSide Library");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!access.isCoach) return null;

  const toggle = (key: PanelKey) => {
    if (key === "teams") setPicked(assignedIds);
    setPanel((cur) => (cur === key ? "none" : key));
  };
  // Library plays someone else owns are added the same way as from the Library card.
  const libraryAdd = !owner && !!play.published_to_library;

  return (
    <Panel className="flex flex-col gap-2" aria-label="Play actions">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
        <BubbleButton tone="flame" disabled={share.isPending} onClick={() => share.mutate()}>
          {share.isPending ? "Sharing…" : "Share Play"}
        </BubbleButton>
        <BubbleButton tone={panel === "teams" ? "grape" : "neutral"} aria-expanded={panel === "teams"} onClick={() => toggle("teams")}>
          {libraryAdd && !assigned.length ? "+ Add to Team" : "Teams"}
        </BubbleButton>
        <BubbleButton tone={panel === "folders" ? "grape" : "neutral"} aria-expanded={panel === "folders"} onClick={() => toggle("folders")}>
          Folder
        </BubbleButton>
        {owner ? (
          <BubbleButton tone={panel === "publish" ? "grape" : "neutral"} aria-expanded={panel === "publish"} onClick={() => toggle("publish")}>
            {play.published_to_library ? "Published ✓" : "Publish"}
          </BubbleButton>
        ) : null}
      </div>

      {assigned.length ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Pill tone="success">In Playbook</Pill>
          {assigned.map((t) => (
            <Pill key={t.id} tone="muted">{t.name}</Pill>
          ))}
        </div>
      ) : null}

      {panel === "teams" ? (
        libraryAdd ? (
          <AddToPlaybook play={play} compact />
        ) : coachTeams.length ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-grape/50 bg-grape/10 p-2">
            <Label>Available to</Label>
            <div className="flex flex-wrap gap-1.5">
              {coachTeams.map((t) => (
                <BubbleButton
                  key={t.id}
                  size="sm"
                  tone={picked.includes(t.id) ? "grape" : "neutral"}
                  onClick={() => setPicked((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
                >
                  {picked.includes(t.id) ? "✓ " : ""}
                  {t.name}
                </BubbleButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <BubbleButton size="sm" tone="flame" disabled={saveTeams.isPending} onClick={() => saveTeams.mutate(picked)}>
                {saveTeams.isPending ? "Saving…" : "Save team access"}
              </BubbleButton>
              <BubbleButton size="sm" tone="ghost" onClick={() => setPanel("none")}>Cancel</BubbleButton>
            </div>
          </div>
        ) : (
          <InfoPanel>Set up a team to add plays to your playbook</InfoPanel>
        )
      ) : null}

      {panel === "folders" ? (
        <AddToFolderPanel playId={play.id} teams={assigned} defaultTeamId={teamId} onClose={() => setPanel("none")} />
      ) : null}

      {panel === "publish" && owner ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-grape/50 bg-grape/10 p-2">
          {play.published_to_library ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone="grape">In CoachSide Library</Pill>
                <Pill tone="muted">{play.publish_anonymous ? "Credited to Anonymous Coach" : "Credited to your handle"}</Pill>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <BubbleButton size="sm" tone="neutral" disabled={anonymize.isPending} onClick={() => anonymize.mutate(!play.publish_anonymous)}>
                  {play.publish_anonymous ? "Credit my handle" : "Credit Anonymous Coach"}
                </BubbleButton>
                <BubbleButton size="sm" tone="ghost" disabled={unpublish.isPending} onClick={() => unpublish.mutate()}>
                  Remove from Library
                </BubbleButton>
              </div>
            </>
          ) : (
            <>
              <Label>Share this play with every coach in the CoachSide Library</Label>
              <div className="flex flex-wrap gap-1.5">
                <BubbleButton size="sm" tone="grape" disabled={publish.isPending} onClick={() => publish.mutate(false)}>
                  Publish to Library
                </BubbleButton>
                <BubbleButton size="sm" tone="neutral" disabled={publish.isPending} onClick={() => publish.mutate(true)}>
                  Publish anonymously
                </BubbleButton>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
