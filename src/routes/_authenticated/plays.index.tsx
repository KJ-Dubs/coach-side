import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  Field,
  Label,
  Note,
  Panel,
  Pill,
  TextInput,
} from "@/components/Bubbles";
import {
  createPlay,
  deletePlay,
  duplicatePlay,
  fetchPlayAssignments,
  fetchPlays,
  fetchTeams,
  setPlayTeams,
  updatePlay,
} from "@/lib/data";
import { publishPlay, unpublishPlay } from "@/lib/library";
import { PlayLibrary } from "@/components/PlayLibrary";
import { useMe } from "@/lib/useMe";

import {
  PLAY_CATEGORIES,
  normalizeCategory,
  type Play,
  type PlayCategory,
  type Team,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  category: z.string().optional(),
  team: z.string().optional(),
  tab: z.enum(["mine", "library"]).optional(),
});

export const Route = createFileRoute("/_authenticated/plays/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Playbook — CoachSide" },
      {
        name: "description",
        content:
          "Your basketball playbook organised into Offense, BLOB, SLOB, Defense, Press Break and Presses folders.",
      },
      { property: "og:title", content: "Playbook — CoachSide" },
      {
        property: "og:description",
        content: "Present, edit, share and duplicate plays from organised category folders.",
      },
    ],
  }),
  component: PlaybookPage,
});

const CATEGORY_META: Record<
  PlayCategory,
  { blurb: string; tone: "grape" | "flame" | "neutral" }
> = {
  Offense: { blurb: "Half-court sets, motion and quick hitters", tone: "grape" },
  BLOB: { blurb: "Baseline out-of-bounds plays", tone: "flame" },
  SLOB: { blurb: "Sideline out-of-bounds plays", tone: "flame" },
  Defense: { blurb: "Half-court defensive schemes and rotations", tone: "neutral" },
  "Press Break": { blurb: "Beating full and three-quarter court pressure", tone: "grape" },
  Presses: { blurb: "Full-court presses with offense and defense on the floor", tone: "neutral" },
};

function isCategory(v: string | undefined): v is PlayCategory {
  return !!v && (PLAY_CATEGORIES as readonly string[]).includes(v);
}

function PlaybookPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const plays = useQuery({ queryKey: ["plays"], queryFn: fetchPlays });
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const assignments = useQuery({
    queryKey: ["play-assignments"],
    queryFn: fetchPlayAssignments,
  });

  const selected = isCategory(search.category) ? search.category : null;
  const teamFilter = search.team ?? "ALL";
  const tab = search.tab ?? "mine";
  const me = useMe();
  const myUserId = me.user?.id ?? null;

  /** playId -> teamIds it is shared with (legacy team_id counts as an assignment). */
  const teamsByPlay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of plays.data ?? []) map.set(p.id, p.team_id ? [p.team_id] : []);
    for (const a of assignments.data ?? []) {
      const list = map.get(a.play_id) ?? [];
      if (!list.includes(a.team_id)) list.push(a.team_id);
      map.set(a.play_id, list);
    }
    return map;
  }, [plays.data, assignments.data]);

  /**
   * My Playbook is only plays linked to one of my teams (or published by me).
   * Library plays other coaches published are readable but must not leak in.
   */
  const myPlays = useMemo(() => {
    const mine = new Set((teams.data ?? []).map((t) => t.id));
    return (plays.data ?? []).filter(
      (p) =>
        (teamsByPlay.get(p.id) ?? []).some((t) => mine.has(t)) ||
        (!!myUserId && p.published_by === myUserId),
    );
  }, [plays.data, teams.data, teamsByPlay, myUserId]);

  const visiblePlays = useMemo(
    () =>
      myPlays.filter(
        (p) => teamFilter === "ALL" || (teamsByPlay.get(p.id) ?? []).includes(teamFilter),
      ),
    [myPlays, teamFilter, teamsByPlay],
  );


  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of visiblePlays) {
      const c = normalizeCategory(p.category);
      out.set(c, (out.get(c) ?? 0) + 1);
    }
    return out;
  }, [visiblePlays]);

  const inCategory = useMemo(
    () =>
      selected
        ? visiblePlays
            .filter((p) => normalizeCategory(p.category) === selected)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [visiblePlays, selected],
  );

  const setCategory = (category: string | null) =>
    navigate({
      to: "/plays",
      search: {
        ...(category ? { category } : {}),
        ...(teamFilter !== "ALL" ? { team: teamFilter } : {}),
      },
    });

  const setTeam = (team: string) =>
    navigate({
      to: "/plays",
      search: {
        ...(selected ? { category: selected } : {}),
        ...(team !== "ALL" ? { team } : {}),
      },
    });

  const teamName = (id: string | null) =>
    id ? (teams.data?.find((t) => t.id === id)?.name ?? "Team") : "All teams";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["plays"] });

  const duplicate = useMutation({
    mutationFn: (p: Play) => duplicatePlay(p),
    onSuccess: (copy) => {
      void invalidate();
      toast.success(`Duplicated as “${copy.name}”`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (p: Play) => deletePlay(p.id),
    onSuccess: () => {
      void invalidate();
      toast.success("Play deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const share = useMutation({
    mutationFn: async (p: Play) => {
      if (!p.is_shared) await updatePlay(p.id, { is_shared: true });
      return p.share_token;
    },
    onSuccess: async (token) => {
      void invalidate();
      if (!token) {
        toast.error("Could not create a share link");
        return;
      }
      const url = `${window.location.origin}/share/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied");
      } catch {
        toast.success(`Share link: ${url}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unshare = useMutation({
    mutationFn: (p: Play) => updatePlay(p.id, { is_shared: false }),
    onSuccess: () => {
      void invalidate();
      toast.success("Sharing turned off");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignTeams = useMutation({
    mutationFn: ({ playId, teamIds }: { playId: string; teamIds: string[] }) =>
      setPlayTeams(playId, teamIds),
    onSuccess: () => {
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ["play-assignments"] });
      toast.success("Team access updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [quickOpen, setQuickOpen] = useState(false);


  return (
    <AppShell
      title="Playbook"
      subtitle={selected ? `${selected} folder` : "Pick a folder"}
      actions={
        <>
          {selected ? (
            <BubbleButton size="sm" tone="ghost" onClick={() => setCategory(null)}>
              ← All folders
            </BubbleButton>
          ) : null}
          <Link to="/plays/new" search={selected ? { category: selected } : {}}>
            <BubbleButton size="sm" tone="flame">
              + Create Play
            </BubbleButton>
          </Link>
        </>
      }
    >
      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Team</Label>
        <BubbleButton
          size="sm"
          tone={teamFilter === "ALL" ? "grape" : "neutral"}
          onClick={() => setTeam("ALL")}
        >
          All teams
        </BubbleButton>
        {teams.data?.map((t) => (
          <BubbleButton
            key={t.id}
            size="sm"
            tone={teamFilter === t.id ? "grape" : "neutral"}
            onClick={() => setTeam(t.id)}
          >
            {t.name}
          </BubbleButton>
        ))}
        <Pill tone="muted" className="ml-auto">
          {visiblePlays.length} {visiblePlays.length === 1 ? "play" : "plays"}
        </Pill>
      </Panel>

      {!selected ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLAY_CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            const n = counts.get(c) ?? 0;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "flex min-h-[150px] flex-col justify-between rounded-3xl border p-4 text-left shadow-lg shadow-black/30 transition-all active:scale-[0.98]",
                  meta.tone === "grape" && "border-grape/60 bg-grape/15 hover:bg-grape/25",
                  meta.tone === "flame" && "border-flame/60 bg-flame/15 hover:bg-flame/25",
                  meta.tone === "neutral" && "border-border bg-surface/80 hover:border-grape/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-2xl border border-border/70 bg-surface-2/80 px-3 py-2 text-xl font-black leading-tight text-foreground sm:text-2xl">
                    {c}
                  </span>
                  <Pill tone={n ? "flame" : "muted"}>{n}</Pill>
                </div>
                <Note className="mt-3">{meta.blurb}</Note>
                <div className="mt-3 flex items-center gap-2">
                  <Pill tone="neutral">Open folder</Pill>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Panel className="flex flex-wrap items-center gap-2">
            <Label>Folders</Label>
            {PLAY_CATEGORIES.map((c) => (
              <BubbleButton
                key={c}
                size="sm"
                tone={c === selected ? "grape" : "neutral"}
                onClick={() => setCategory(c)}
              >
                {c}
                <Pill tone="muted" className="px-2 py-0">
                  {counts.get(c) ?? 0}
                </Pill>
              </BubbleButton>
            ))}
            <BubbleButton
              size="sm"
              tone="flame"
              className="ml-auto"
              onClick={() => setQuickOpen((o) => !o)}
            >
              {quickOpen ? "Close" : `+ New ${selected} play`}
            </BubbleButton>
          </Panel>

          {quickOpen ? (
            <QuickCreate
              category={selected}
              defaultTeam={teamFilter !== "ALL" ? teamFilter : (teams.data?.[0]?.id ?? "")}
              onDone={() => setQuickOpen(false)}
            />
          ) : null}

          {plays.isLoading ? <EmptyState>Loading plays…</EmptyState> : null}
          {!plays.isLoading && inCategory.length === 0 ? (
            <EmptyState>No {selected} plays yet — create one to fill this folder</EmptyState>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inCategory.map((p) => (
              <PlayCard
                key={p.id}
                play={p}
                viewSearch={{
                  ...(selected ? { category: selected } : {}),
                  ...(teamFilter !== "ALL" ? { team: teamFilter } : {}),
                }}
                assignedTeams={teamsByPlay.get(p.id) ?? []}
                allTeams={teams.data ?? []}

                teamName={teamName}
                busy={share.isPending || duplicate.isPending || remove.isPending}
                onShareLink={() => share.mutate(p)}
                onUnshare={() => unshare.mutate(p)}
                onDuplicate={() => duplicate.mutate(p)}
                onDelete={() => {
                  if (window.confirm(`Delete “${p.name}”? This cannot be undone.`)) {
                    remove.mutate(p);
                  }
                }}
                onSaveTeams={(ids) => assignTeams.mutate({ playId: p.id, teamIds: ids })}
                savingTeams={assignTeams.isPending}
              />
            ))}
          </div>

        </div>
      )}
    </AppShell>
  );
}

/** Play card: one-tap Run Play, plus an overflow menu for everything else. */
function PlayCard({
  play,
  viewSearch,
  assignedTeams,
  allTeams,
  teamName,
  busy,
  onShareLink,
  onUnshare,
  onDuplicate,
  onDelete,
  onSaveTeams,
  savingTeams,
}: {
  play: Play;
  viewSearch: { category?: string; team?: string };
  assignedTeams: string[];
  allTeams: Team[];
  teamName: (id: string | null) => string;
  busy: boolean;
  onShareLink: () => void;
  onUnshare: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveTeams: (ids: string[]) => void;
  savingTeams: boolean;
}) {

  const [menu, setMenu] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(assignedTeams);

  const openTeams = () => {
    setPicked(assignedTeams);
    setTeamsOpen(true);
    setMenu(false);
  };

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-2xl border border-grape/60 bg-grape/20 px-3 py-2 text-xl font-black leading-tight text-foreground">
          {play.name}
        </span>
        <BubbleButton
          size="sm"
          tone={menu ? "grape" : "neutral"}
          className="ml-auto"
          onClick={() => setMenu((m) => !m)}
        >
          •••
        </BubbleButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="neutral">Attack {play.attack_basket === "left" ? "left" : "right"}</Pill>
        <Pill tone={play.is_shared ? "success" : "muted"}>
          {play.is_shared ? "Shared link on" : "Private"}
        </Pill>
        {assignedTeams.length ? (
          assignedTeams.map((t) => (
            <Pill key={t} tone="muted">
              {teamName(t)}
            </Pill>
          ))
        ) : (
          <Pill tone="muted">No team yet</Pill>
        )}
      </div>

      <Link
        to="/plays/$playId/view"
        params={{ playId: play.id }}
        search={viewSearch}
        aria-label={`Run play ${play.name}`}
        className="block"
      >
        <BubbleButton tone="flame" size="lg" className="w-full min-h-14">
          ▶ Run Play
        </BubbleButton>
      </Link>

      {menu ? (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-surface-2/70 p-2">
          <Link to="/plays/$playId/view" params={{ playId: play.id }} search={viewSearch}>
            <BubbleButton size="sm" tone="neutral">
              View
            </BubbleButton>
          </Link>

          <Link to="/plays/$playId" params={{ playId: play.id }}>
            <BubbleButton size="sm" tone="flame">
              Edit
            </BubbleButton>
          </Link>
          <BubbleButton size="sm" tone="neutral" disabled={busy} onClick={onShareLink}>
            {play.is_shared ? "Copy link" : "Share"}
          </BubbleButton>
          <BubbleButton size="sm" tone="neutral" onClick={openTeams}>
            Teams
          </BubbleButton>
          {play.is_shared ? (
            <BubbleButton size="sm" tone="ghost" disabled={busy} onClick={onUnshare}>
              Stop sharing
            </BubbleButton>
          ) : null}
          <BubbleButton size="sm" tone="neutral" disabled={busy} onClick={onDuplicate}>
            Duplicate
          </BubbleButton>
          <BubbleButton size="sm" tone="ghost" disabled={busy} onClick={onDelete}>
            Delete
          </BubbleButton>
        </div>
      ) : null}

      {teamsOpen ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-grape/50 bg-grape/10 p-2">
          <Label>Available to</Label>
          <div className="flex flex-wrap gap-1.5">
            {allTeams.map((t) => (
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
            <BubbleButton
              size="sm"
              tone="neutral"
              onClick={() => setPicked(allTeams.map((t) => t.id))}
            >
              Select all
            </BubbleButton>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <BubbleButton
              size="sm"
              tone="flame"
              disabled={savingTeams}
              onClick={() => {
                onSaveTeams(picked);
                setTeamsOpen(false);
              }}
            >
              {savingTeams ? "Saving…" : "Save team access"}
            </BubbleButton>
            <BubbleButton size="sm" tone="ghost" onClick={() => setTeamsOpen(false)}>
              Cancel
            </BubbleButton>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/** Inline quick-create: name + teams, then straight into the designer. */
function QuickCreate({
  category,
  defaultTeam,
  onDone,
}: {
  category: PlayCategory;
  defaultTeam: string;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [name, setName] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>(defaultTeam ? [defaultTeam] : []);

  const create = useMutation({
    mutationFn: () =>
      createPlay({
        team_id: teamIds[0] ?? null,
        name: name.trim(),
        category,
        attack_basket: "right",
        team_ids: teamIds,
      }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ["plays"] });
      void queryClient.invalidateQueries({ queryKey: ["play-assignments"] });
      toast.success("Play created — opening the designer");
      onDone();
      navigate({ to: "/plays/$playId", params: { playId: p.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="flex flex-col gap-3">
      <Field label="Play name">
        <TextInput
          autoFocus
          placeholder={`e.g. ${category === "BLOB" ? "Box 1" : category === "Presses" ? "1-2-1-1 Diamond" : "Horns Flare"}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) create.mutate();
          }}
        />
      </Field>
      <Field label="Available to">
        <div className="flex flex-wrap gap-1.5">
          {teams.data?.map((t) => (
            <BubbleButton
              key={t.id}
              size="sm"
              tone={teamIds.includes(t.id) ? "grape" : "neutral"}
              onClick={() =>
                setTeamIds((cur) =>
                  cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id],
                )
              }
            >
              {teamIds.includes(t.id) ? "✓ " : ""}
              {t.name}
            </BubbleButton>
          ))}
          <BubbleButton
            size="sm"
            tone="neutral"
            onClick={() => setTeamIds((teams.data ?? []).map((t) => t.id))}
          >
            Select all
          </BubbleButton>
        </div>
      </Field>
      <BubbleButton
        tone="flame"
        disabled={!name.trim() || !teamIds.length || create.isPending}
        onClick={() => create.mutate()}
      >
        {create.isPending ? "Creating…" : "Create & design"}
      </BubbleButton>
    </Panel>
  );
}

