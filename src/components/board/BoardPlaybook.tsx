import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, X } from "lucide-react";
import { BubbleButton, Label, Panel, Pill, TextInput } from "@/components/Bubbles";
import { PlayPresenter } from "@/components/court/PlayPresenter";
import type { CourtZoom } from "@/components/court/Court";
import { PlayThumb } from "@/components/community/PlayThumb";
import {
  fetchFrames,
  fetchPlayAssignments,
  fetchPlayFolderMemberships,
  fetchPlaybookFolders,
  fetchPlays,
} from "@/lib/data";
import {
  BOARD_SITUATIONS,
  matchesDiscovery,
  matchesQuery,
  playsForTeam,
  sortPlays,
  type SortKey,
} from "@/lib/playbookFilters";
import { normalizeIndex } from "@/lib/playIndex";
import { resolveRole, useAccess } from "@/lib/access";
import { useCurrentTeam } from "@/lib/teamContext";
import { normalizeCategory, type Play, type PlayToken } from "@/lib/types";

const PICKER_SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "updated", label: "Recent" },
  { key: "az", label: "A–Z" },
];

function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

/**
 * Compact team Playbook picker for the Timeout Board. Reads the same team
 * Playbook (source team + explicit assignments), folders and discovery
 * filters as My Playbook. The team choice is local to the picker and never
 * changes the coach's current team. Stays mounted while closed so the last
 * search/folder survive between timeouts.
 */
export function BoardPlaybookPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (play: Play) => void;
}) {
  const { access } = useAccess();
  const role = resolveRole(access);
  const current = useCurrentTeam();
  const teams = useMemo(
    () => current.teams.filter((t) => role.canCoachTeam(t.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current.teams, access],
  );
  const [teamId, setTeamId] = useState<string | null>(null);
  const scopeTeam = teams.find((t) => t.id === teamId) ?? teams.find((t) => t.id === current.teamId) ?? teams[0] ?? null;
  const scopeId = scopeTeam?.id ?? null;

  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string>("ALL");
  const [situations, setSituations] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("newest");

  const plays = useQuery({ queryKey: ["plays"], queryFn: fetchPlays, enabled: open });
  const assignments = useQuery({ queryKey: ["play-assignments"], queryFn: fetchPlayAssignments, enabled: open });
  const folders = useQuery({
    queryKey: ["playbook-folders", scopeId],
    queryFn: () => fetchPlaybookFolders(scopeId as string),
    enabled: open && !!scopeId,
  });
  const memberships = useQuery({
    queryKey: ["play-folder-memberships", scopeId],
    queryFn: () => fetchPlayFolderMemberships(scopeId as string),
    enabled: open && !!scopeId,
  });

  useEscape(open, onClose);

  // Desktop/keyboard: focus search at once. Touch: don't pop the keyboard over the list.
  useEffect(() => {
    if (!open) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) {
      document.getElementById("board-playbook-search")?.focus();
    }
  }, [open]);

  // A folder from another team never carries over.
  useEffect(() => setFolder("ALL"), [scopeId]);

  const teamPlays = useMemo(
    () => playsForTeam(plays.data ?? [], assignments.data ?? [], scopeId),
    [plays.data, assignments.data, scopeId],
  );

  const folderNamesByPlay = useMemo(() => {
    const names = new Map((folders.data ?? []).map((f) => [f.id, f.name]));
    const out = new Map<string, string[]>();
    for (const m of memberships.data ?? []) {
      const n = names.get(m.folder_id);
      if (n) out.set(m.play_id, [...(out.get(m.play_id) ?? []), n]);
    }
    return out;
  }, [folders.data, memberships.data]);

  const folderCounts = useMemo(() => {
    const ids = new Set(teamPlays.map((p) => p.id));
    const out = new Map<string, number>();
    for (const m of memberships.data ?? []) {
      if (ids.has(m.play_id)) out.set(m.folder_id, (out.get(m.folder_id) ?? 0) + 1);
    }
    return out;
  }, [teamPlays, memberships.data]);

  const results = useMemo(() => {
    const inFolder = (p: Play) =>
      folder === "ALL" ||
      (memberships.data ?? []).some((m) => m.play_id === p.id && m.folder_id === folder);
    return sortPlays(
      teamPlays.filter(
        (p) =>
          inFolder(p) &&
          matchesDiscovery(p, situations) &&
          matchesQuery(p, query, folderNamesByPlay.get(p.id) ?? []),
      ),
      sort,
    );
  }, [teamPlays, folder, memberships.data, situations, query, folderNamesByPlay, sort]);

  if (!open) return null;

  const loading = plays.isLoading || assignments.isLoading;
  const filtersActive = !!query.trim() || folder !== "ALL" || situations.length > 0;
  const toggleSituation = (key: string) =>
    setSituations((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-[2px]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Playbook picker"
        className="flex h-[100dvh] w-full max-w-lg flex-col gap-2 border-l border-grape/50 bg-surface p-3 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-2">
          <Pill tone="grape" className="shrink-0">
            <BookOpen className="h-4 w-4" aria-hidden /> Playbook
          </Pill>
          {teams.length > 1 ? (
            <select
              aria-label="Team for this picker"
              value={scopeId ?? ""}
              onChange={(e) => setTeamId(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-3 text-sm font-bold text-foreground focus:border-grape focus:outline-none"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <Pill tone="neutral" className="min-w-0 flex-1 truncate text-sm">
              {scopeTeam?.name ?? "No team"}
            </Pill>
          )}
          <BubbleButton tone="neutral" aria-label="Close playbook" onClick={onClose} className="shrink-0 px-3">
            <X className="h-5 w-5" aria-hidden />
          </BubbleButton>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <TextInput
            id="board-playbook-search"
            type="search"
            aria-label="Search this team's plays"
            placeholder="Search plays, tags, folders…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-12 w-full pl-9 text-base"
          />
        </div>

        <section aria-label="Folders" className="flex flex-col gap-1">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            <BubbleButton
              size="sm"
              tone={folder === "ALL" ? "grape" : "neutral"}
              aria-pressed={folder === "ALL"}
              onClick={() => setFolder("ALL")}
              className="shrink-0"
            >
              All Plays · {teamPlays.length}
            </BubbleButton>
            {(folders.data ?? []).map((f) => (
              <BubbleButton
                key={f.id}
                size="sm"
                tone={folder === f.id ? "grape" : "neutral"}
                aria-pressed={folder === f.id}
                onClick={() => setFolder(folder === f.id ? "ALL" : f.id)}
                className="shrink-0"
              >
                📁 {f.name} · {folderCounts.get(f.id) ?? 0}
              </BubbleButton>
            ))}
          </div>
        </section>

        <section aria-label="Situation" className="flex flex-wrap items-center gap-1.5">
          {BOARD_SITUATIONS.map((s) => {
            const on = situations.includes(s.key);
            return (
              <BubbleButton
                key={s.key}
                size="sm"
                tone={on ? "flame" : "neutral"}
                aria-pressed={on}
                onClick={() => toggleSituation(s.key)}
                className="px-2.5"
              >
                {s.label}
              </BubbleButton>
            );
          })}
        </section>

        <div className="flex items-center gap-1.5">
          {PICKER_SORTS.map((s) => (
            <BubbleButton
              key={s.key}
              size="sm"
              tone={sort === s.key ? "grape" : "ghost"}
              aria-pressed={sort === s.key}
              onClick={() => setSort(s.key)}
              className="px-2.5 shadow-none"
            >
              {s.label}
            </BubbleButton>
          ))}
          <span className="ml-auto rounded-full bg-surface-2/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground" role="status">
            {results.length} of {teamPlays.length}
          </span>
          {filtersActive ? (
            <BubbleButton
              size="sm"
              tone="ghost"
              className="px-2.5 shadow-none"
              onClick={() => {
                setQuery("");
                setFolder("ALL");
                setSituations([]);
              }}
            >
              Clear
            </BubbleButton>
          ) : null}
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
          {loading ? (
            <Panel className="flex justify-center">
              <Label>Loading plays…</Label>
            </Panel>
          ) : !scopeId ? (
            <Panel className="flex justify-center">
              <Label>Set up a team to use its Playbook here</Label>
            </Panel>
          ) : results.length === 0 ? (
            <Panel className="flex justify-center">
              <Label>{teamPlays.length ? "No plays match" : "No plays in this team's Playbook yet"}</Label>
            </Panel>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {results.map((p) => {
                const idx = normalizeIndex(p);
                const tags = [...idx.concepts, ...idx.defenses, ...idx.outcomes].slice(0, 3);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onPick(p)}
                      className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border/70 bg-surface-2/60 p-2 text-left transition-all hover:border-grape/70 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
                    >
                      <PlayThumb
                        playId={p.id}
                        attackBasket={p.attack_basket}
                        category={p.category}
                        authenticated
                        className="rounded-xl"
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-base font-black text-foreground">{p.name}</span>
                        <span className="flex flex-wrap gap-1">
                          <Pill tone="muted" className="px-2 py-0.5 text-[11px]">
                            {normalizeCategory(p.category)}
                          </Pill>
                          {tags.map((t) => (
                            <Pill key={t} tone="neutral" className="px-2 py-0.5 text-[11px]">
                              {t}
                            </Pill>
                          ))}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Full-screen quick presentation over the Board. Uses the same PlayPresenter
 * (normalized playback + saved/automatic camera) as Play Slideshow. The Board
 * stays mounted underneath, so closing returns to the exact whiteboard.
 */
export function BoardPlayOverlay({
  play,
  onClose,
  onOpenPicker,
  onLoadPositions,
  pickerOpen = false,
}: {
  play: Play;
  /** While the picker is open on top, Escape belongs to the picker. */
  pickerOpen?: boolean;
  onClose: () => void;
  onOpenPicker: () => void;
  onLoadPositions: (tokens: PlayToken[], camera: CourtZoom, flip: boolean) => void;
}) {
  const frames = useQuery({ queryKey: ["frames", play.id], queryFn: () => fetchFrames(play.id) });
  useEscape(!pickerOpen, onClose);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting ${play.name}`}
      className="fixed inset-0 z-40 overflow-y-auto bg-background p-2"
    >
      <PlayPresenter
        key={play.id}
        compact
        play={play}
        frames={frames.data ?? []}
        loading={frames.isLoading}
        className="mx-auto w-full max-w-7xl"
        headerAction={
          <>
            <BubbleButton size="sm" tone="grape" onClick={onClose} aria-label="Back to Board">
              ← Back to Board
            </BubbleButton>
            <BubbleButton size="sm" tone="neutral" onClick={onOpenPicker} aria-label="Pick another play">
              <BookOpen className="h-4 w-4" aria-hidden /> Plays ▾
            </BubbleButton>
          </>
        }
        onLoadPositions={onLoadPositions}
      />
    </div>
  );
}
