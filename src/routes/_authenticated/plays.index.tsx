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
  SelectInput,
  TextInput,
} from "@/components/Bubbles";
import {
  createPlay,
  deletePlay,
  duplicatePlay,
  fetchPlays,
  fetchTeams,
  updatePlay,
} from "@/lib/data";
import { PLAY_CATEGORIES, normalizeCategory, type Play, type PlayCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  category: z.string().optional(),
  team: z.string().optional(),
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

  const visiblePlays = useMemo(
    () =>
      (plays.data ?? []).filter(
        (p) => teamFilter === "ALL" || (teamsByPlay.get(p.id) ?? []).includes(teamFilter),
      ),
    [plays.data, teamFilter, teamsByPlay],
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
                  <span className="rounded-2xl border border-border/70 bg-surface-2/80 px-3 py-1.5 text-base font-black tracking-tight text-foreground">
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
              <Panel key={p.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-2xl border border-grape/60 bg-grape/20 px-3 py-1.5 text-sm font-black text-foreground">
                    {p.name}
                  </span>
                  <Pill tone="muted">{teamName(p.team_id)}</Pill>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="neutral">Attack {p.attack_basket === "left" ? "left" : "right"}</Pill>
                  <Pill tone={p.is_shared ? "success" : "muted"}>
                    {p.is_shared ? "Shared link on" : "Private"}
                  </Pill>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Link to="/plays/$playId/view" params={{ playId: p.id }}>
                    <BubbleButton size="sm" tone="grape">
                      Present
                    </BubbleButton>
                  </Link>
                  <Link to="/plays/$playId" params={{ playId: p.id }}>
                    <BubbleButton size="sm" tone="flame">
                      Edit
                    </BubbleButton>
                  </Link>
                  <BubbleButton
                    size="sm"
                    tone="neutral"
                    disabled={share.isPending}
                    onClick={() => share.mutate(p)}
                  >
                    {p.is_shared ? "Copy link" : "Share"}
                  </BubbleButton>
                  {p.is_shared ? (
                    <BubbleButton
                      size="sm"
                      tone="ghost"
                      disabled={unshare.isPending}
                      onClick={() => unshare.mutate(p)}
                    >
                      Stop sharing
                    </BubbleButton>
                  ) : null}
                  <BubbleButton
                    size="sm"
                    tone="neutral"
                    disabled={duplicate.isPending}
                    onClick={() => duplicate.mutate(p)}
                  >
                    Duplicate
                  </BubbleButton>
                  <BubbleButton
                    size="sm"
                    tone="ghost"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete “${p.name}”? This cannot be undone.`)) {
                        remove.mutate(p);
                      }
                    }}
                  >
                    Delete
                  </BubbleButton>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

/** Inline quick-create: name + team, then straight into the designer. */
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
  const [teamId, setTeamId] = useState(defaultTeam);

  const create = useMutation({
    mutationFn: () =>
      createPlay({
        team_id: teamId || null,
        name: name.trim(),
        category,
        attack_basket: "right",
      }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ["plays"] });
      toast.success("Play created — opening the designer");
      onDone();
      navigate({ to: "/plays/$playId", params: { playId: p.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
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
      <Field label="Team">
        <SelectInput value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teams.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <BubbleButton
        tone="flame"
        disabled={!name.trim() || create.isPending}
        onClick={() => create.mutate()}
      >
        {create.isPending ? "Creating…" : "Create & design"}
      </BubbleButton>
    </Panel>
  );
}
