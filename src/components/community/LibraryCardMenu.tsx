import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BubbleButton, InfoPanel } from "@/components/Bubbles";
import { trackActivity, trackActivityOnce, notifyProgressChanged } from "@/lib/activity";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { CreateMyVersion } from "@/components/CreateMyVersion";
import { AddToFolderPanel } from "@/components/playbook/Folders";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { resolveRole, useAccess } from "@/lib/access";
import { libraryPlayAsPlay, type LibraryPlay } from "@/lib/community";
import { createPlayShareLink, deletePlay, duplicatePlay, fetchTeams, fetchTeamsForPlay } from "@/lib/data";
import { setPlayAnonymous, unpublishPlay } from "@/lib/library";
import { isPlayOwner } from "@/lib/playOwnership";
import type { Play } from "@/lib/types";

async function copy(url: string, label: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success(label);
  } catch {
    toast.success(url);
  }
}

/**
 * Upper-right ••• for signed-in Library cards. Owner actions only appear for
 * the play's creator; everyone else gets adopt/share/version actions.
 */
export function LibraryCardMenu({ play, isCoach }: { play: LibraryPlay; isCoach: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"none" | "teams" | "folders">("none");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPanel("none");
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <BubbleButton
        size="sm"
        tone={open ? "grape" : "neutral"}
        className="min-h-11 min-w-11 text-lg"
        aria-label={`Actions for ${play.name}`}
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setPanel("none"); }}
      >
        •••
      </BubbleButton>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-surface-2 p-2 shadow-xl">
          <MenuBody play={play} isCoach={isCoach} userId={user.id} panel={panel} setPanel={setPanel} close={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

function MenuBody({
  play, isCoach, userId, panel, setPanel, close,
}: {
  play: LibraryPlay; isCoach: boolean; userId: string;
  panel: "none" | "teams" | "folders"; setPanel: (p: "none" | "teams" | "folders") => void; close: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { access } = useAccess();
  const role = resolveRole(access);
  const full = useQuery({
    queryKey: ["library-play-row", play.id],
    queryFn: async () => {
      const { data } = await supabase.from("plays").select("*").eq("id", play.id).maybeSingle();
      return (data as unknown as Play) ?? null;
    },
  });
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams, enabled: isCoach });
  const linked = useQuery({
    queryKey: ["play-assignments", "for-play", play.id],
    queryFn: () => fetchTeamsForPlay(play.id),
    enabled: isCoach,
  });
  const p: Play = full.data ?? libraryPlayAsPlay(play);
  const owner = isPlayOwner(p, userId);
  const coachTeams = (teams.data ?? []).filter((t) => role.canCoachTeam(t.id));
  const adoptedTeams = coachTeams.filter((t) => (linked.data ?? []).includes(t.id) || p.team_id === t.id);
  const canTeamShare = owner || adoptedTeams.length > 0;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["library-feed"] });
    void qc.invalidateQueries({ queryKey: ["plays"] });
    void qc.invalidateQueries({ queryKey: ["library-play-row", play.id] });
  };

  const share = useMutation({
    mutationFn: () => createPlayShareLink(play.id),
    onSuccess: (token) => { void trackActivity("play_shared", { entityId: play.id }); void copy(`${window.location.origin}/share/${token}`, "Share link copied"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicate = useMutation({
    mutationFn: () => duplicatePlay(p),
    onSuccess: (c) => { refresh(); toast.success(`Duplicated as “${c.name}”`); close(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const unpublish = useMutation({
    mutationFn: () => unpublishPlay(play.id),
    onSuccess: () => { refresh(); toast.success("Removed from the CoachSide Library"); close(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const anonymize = useMutation({
    mutationFn: (anon: boolean) => setPlayAnonymous(play.id, anon),
    onSuccess: (_r, anon) => { refresh(); toast.success(anon ? "Now credited to Anonymous Coach" : "Now credited to your handle"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deletePlay(play.id),
    onSuccess: () => { refresh(); toast.success("Play deleted"); close(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (panel === "teams") {
    return (
      <div className="flex flex-col gap-2">
        {owner ? (
          <InfoPanel className="py-2 text-xs">Manage team access for your own play from My Playbook.</InfoPanel>
        ) : (
          <AddToPlaybook play={libraryPlayAsPlay(play)} compact />
        )}
        {owner ? (
          <BubbleButton size="sm" tone="grape" onClick={() => void navigate({ to: "/plays", search: {} })}>Open My Playbook</BubbleButton>
        ) : null}
        <BubbleButton size="sm" tone="ghost" onClick={() => setPanel("none")}>← Back</BubbleButton>
      </div>
    );
  }
  if (panel === "folders") {
    return (
      <div className="flex flex-col gap-2">
        <AddToFolderPanel playId={play.id} teams={adoptedTeams} defaultTeamId={null} onClose={() => setPanel("none")} />
      </div>
    );
  }

  const item = "w-full justify-start";
  return (
    <div className="flex flex-col gap-1.5">
      <Link to="/plays/$playId/view" params={{ playId: play.id }} search={{ from: "library", tab: "library", content: "plays" }}>
        <BubbleButton size="sm" tone="flame" className={item}>▶ View / Run Play</BubbleButton>
      </Link>
      {owner ? (
        <Link to="/plays/$playId" params={{ playId: play.id }}>
          <BubbleButton size="sm" tone="neutral" className={item}>Edit</BubbleButton>
        </Link>
      ) : null}
      {isCoach ? (
        <BubbleButton size="sm" tone="neutral" className={item} onClick={() => setPanel("teams")}>
          {owner ? "Teams" : adoptedTeams.length ? "Manage Team Access" : "Add to My Playbook"}
        </BubbleButton>
      ) : null}
      <BubbleButton
        size="sm"
        tone="neutral"
        className={item}
        disabled={share.isPending}
        onClick={() => (canTeamShare ? share.mutate() : void copy(`${window.location.origin}/library/${play.id}`, "Library link copied"))}
      >
        Share / Copy Link
      </BubbleButton>
      {isCoach && adoptedTeams.length ? (
        <BubbleButton size="sm" tone="grape" className={item} onClick={() => setPanel("folders")}>Add to Folder</BubbleButton>
      ) : null}
      {isCoach && !owner ? <CreateMyVersion play={p} teamIds={adoptedTeams.map((t) => t.id)} label="Edit as My Version" /> : null}
      {owner ? (
        <>
          <BubbleButton size="sm" tone="neutral" className={item} disabled={duplicate.isPending} onClick={() => duplicate.mutate()}>Duplicate</BubbleButton>
          <BubbleButton size="sm" tone="neutral" className={item} onClick={() => anonymize.mutate(!p.publish_anonymous)}>
            {p.publish_anonymous ? "Credit my handle" : "Credit Anonymous Coach"}
          </BubbleButton>
          <BubbleButton size="sm" tone="ghost" className={item} disabled={unpublish.isPending} onClick={() => unpublish.mutate()}>Remove from Library</BubbleButton>
          <BubbleButton size="sm" tone="ghost" className={item} disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete “${play.name}”? This cannot be undone.`)) remove.mutate(); }}>Delete</BubbleButton>
        </>
      ) : null}
      {play.creator_username ? (
        <Link to="/coach/$username" params={{ username: play.creator_username }}>
          <BubbleButton size="sm" tone="neutral" className={item}>View creator</BubbleButton>
        </Link>
      ) : null}
    </div>
  );
}
