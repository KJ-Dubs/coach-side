import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BubbleButton, EmptyState, InfoPanel, Label, Panel, Pill, TextInput } from "@/components/Bubbles";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { LibraryCardMenu } from "@/components/community/LibraryCardMenu";
import { HeartButton } from "@/components/community/HeartButton";
import { PlayThumb } from "@/components/community/PlayThumb";
import { useAuth } from "@/lib/auth";
import { resolveRole, useAccess } from "@/lib/access";
import {
  fetchLibraryFeed,
  fetchMyHearts,
  libraryPlayAsPlay,
  LIBRARY_SORTS,
  sortLibrary,
  type LibraryPlay,
  type LibrarySort,
} from "@/lib/community";
import { searchScore, DEFENSES, OUTCOMES, SITUATIONS } from "@/lib/playIndex";
import { setPlayOfTheDayAndNotify } from "@/lib/notifications.functions";
import { useIsAppAdmin } from "@/lib/useIsAppAdmin";
import { PLAY_CATEGORIES, normalizeCategory } from "@/lib/types";

/**
 * The CoachSide Library feed. Renders for signed-out visitors (public browse)
 * and inside the coach Playbook, where adding a play keeps the coach here.
 */
export function LibraryFeed({
  variant = "app",
  creator,
}: {
  variant?: "app" | "public";
  creator?: string;
}) {
  const { user } = useAuth();
  const { access } = useAccess();
  const isCoach = !!user && !resolveRole(access).isPlayerOnly;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [situation, setSituation] = useState("Any");
  const [defense, setDefense] = useState("Any");
  const [outcome, setOutcome] = useState("Any");
  const [sort, setSort] = useState<LibrarySort>("featured");
  const [showFilters, setShowFilters] = useState(false);

  const feed = useQuery({
    queryKey: ["library-feed", creator ?? null],
    queryFn: () => fetchLibraryFeed(creator ?? null),
  });
  const hearts = useQuery({
    queryKey: ["my-hearts"],
    queryFn: fetchMyHearts,
    enabled: !!user,
  });
  const { isAdmin } = useIsAppAdmin();

  const shown = useMemo(() => {
    const list = (feed.data ?? []).filter((p) => {
      if (category !== "All" && normalizeCategory(p.category) !== category) return false;
      if (situation !== "Any" && p.situation !== situation) return false;
      if (defense !== "Any" && p.defense_faced !== defense) return false;
      if (outcome !== "Any" && p.outcome !== outcome) return false;
      return (
        searchScore(
          {
            name: p.name,
            category: p.category,
            creator: p.author_label,
            situation: p.situation,
            defense_faced: p.defense_faced,
            outcome: p.outcome,
            primary_actions: p.primary_actions,
            time_pressure: p.time_pressure,
            tags: p.tags,
          },
          query,
        ) > 0
      );
    });
    if (query.trim()) {
      return [...list].sort(
        (a, b) =>
          searchScore({ name: b.name, category: b.category, tags: b.tags, primary_actions: b.primary_actions }, query) -
          searchScore({ name: a.name, category: a.category, tags: a.tags, primary_actions: a.primary_actions }, query),
      );
    }
    return sortLibrary(list, sort);
  }, [feed.data, category, situation, defense, outcome, query, sort]);

  /** Built only from the coach's own hearts — never from private team data. */
  const recommended = useMemo(() => {
    const liked = new Set(hearts.data ?? []);
    if (!liked.size || query.trim()) return [];
    const likedPlays = (feed.data ?? []).filter((p) => liked.has(p.id));
    const weight = new Map<string, number>();
    for (const p of likedPlays) {
      for (const k of [normalizeCategory(p.category), ...(p.tags ?? []), ...(p.primary_actions ?? [])]) {
        weight.set(k, (weight.get(k) ?? 0) + 1);
      }
    }
    const top = [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
    if (!top.length) return [];
    return (feed.data ?? [])
      .filter((p) => !liked.has(p.id))
      .filter((p) =>
        top.some(
          (k) =>
            normalizeCategory(p.category) === k ||
            (p.tags ?? []).includes(k) ||
            (p.primary_actions ?? []).includes(k),
        ),
      )
      .slice(0, 3)
      .map((p) => ({ play: p, reason: `Because you save ${top.join(" + ")}` }));
  }, [feed.data, hearts.data, query]);

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col gap-2">
        <TextInput
          placeholder="Search plays — try “3 point play end of game” or “backdoor vs tight defense”"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Label>Sort</Label>
          {LIBRARY_SORTS.map((s) => (
            <BubbleButton
              key={s.key}
              size="sm"
              tone={sort === s.key ? "flame" : "neutral"}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </BubbleButton>
          ))}
          <BubbleButton size="sm" tone={showFilters ? "grape" : "neutral"} onClick={() => setShowFilters((v) => !v)}>
            {showFilters ? "Hide filters" : "Filters"}
          </BubbleButton>
          <Pill tone="muted" className="ml-auto">
            {shown.length} {shown.length === 1 ? "play" : "plays"}
          </Pill>
        </div>
        {showFilters ? (
          <div className="flex flex-col gap-2">
            <FilterRow label="Category" options={["All", ...PLAY_CATEGORIES]} value={category} onPick={setCategory} />
            <FilterRow label="Situation" options={["Any", ...SITUATIONS]} value={situation} onPick={setSituation} />
            <FilterRow label="Defense" options={["Any", ...DEFENSES]} value={defense} onPick={setDefense} />
            <FilterRow label="Outcome" options={["Any", ...OUTCOMES]} value={outcome} onPick={setOutcome} />
          </div>
        ) : (
          <InfoPanel>{LIBRARY_SORTS.find((s) => s.key === sort)?.hint}</InfoPanel>
        )}
      </Panel>

      {recommended.length ? (
        <Panel className="flex flex-col gap-3">
          <div className="text-center">
            <h3 className="text-xl font-black leading-tight text-foreground">Recommended for You</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{recommended[0]!.reason}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recommended.map((r) => (
              <LibraryCard key={r.play.id} play={r.play} variant={variant} isCoach={isCoach} isAdmin={false} />
            ))}
          </div>
        </Panel>
      ) : null}

      {feed.isLoading ? <EmptyState>Loading the library…</EmptyState> : null}
      {!feed.isLoading && !shown.length ? (
        <EmptyState>No plays match that search yet</EmptyState>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <LibraryCard
            key={p.id}
            play={p}
            variant={variant}
            isCoach={isCoach}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label>{label}</Label>
      {options.map((o) => (
        <BubbleButton key={o} size="sm" tone={value === o ? "grape" : "neutral"} onClick={() => onPick(o)}>
          {o}
        </BubbleButton>
      ))}
    </div>
  );
}

function LibraryCard({
  play,
  variant,
  isCoach,
  isAdmin,
}: {
  play: LibraryPlay;
  variant: "app" | "public";
  isCoach: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const feature = useMutation({
    mutationFn: () => setPlayOfTheDayAndNotify({ data: { playId: play.id } }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["library-feed"] });
      void qc.invalidateQueries({ queryKey: ["play-of-the-day"] });
      toast.success(
        r.notified > 0
          ? `${play.name} is the Play of the Day — ${r.notified} coaches notified`
          : `${play.name} is now the Play of the Day`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = [normalizeCategory(play.category), play.situation, play.defense_faced]
    .filter(Boolean)
    .join(" • ");
  const tags = (play.tags ?? []).slice(0, 4);

  const runLink =
    variant === "app" ? (
      <Link
        to="/plays/$playId/view"
        params={{ playId: play.id }}
        search={{ from: "library", tab: "library", content: "plays" }}
        className="block w-full"
        aria-label={`Run play ${play.name}`}
      >
        <BubbleButton tone="flame" size="lg" className="min-h-14 w-full">
          ▶ Run Play
        </BubbleButton>
      </Link>
    ) : (
      <Link
        to="/library/$playId"
        params={{ playId: play.id }}
        className="block w-full"
        aria-label={`Run play ${play.name}`}
      >
        <BubbleButton tone="flame" size="lg" className="min-h-14 w-full">
          ▶ Run Play
        </BubbleButton>
      </Link>
    );

  return (
    <Panel className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h3 className="min-w-0 truncate text-center text-xl font-black leading-tight text-foreground">
          {play.name}
        </h3>
        <LibraryCardMenu play={play} isCoach={isCoach} />
      </div>

      <Link
        to="/library/$playId"
        params={{ playId: play.id }}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
        aria-label={`Open ${play.name}`}
      >
        <PlayThumb playId={play.id} attackBasket={play.attack_basket} category={play.category} />
      </Link>


      <InfoPanel className="py-2 text-center text-xs">{meta}</InfoPanel>

      {tags.length ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {tags.map((t) => (
            <Pill key={t} tone="muted">
              {t}
            </Pill>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {play.featured ? <Pill tone="flame">Play of the Day</Pill> : null}
        {play.creator_username ? (
          <Link to="/coach/$username" params={{ username: play.creator_username }}>
            <Pill tone="grape">by {play.author_label}</Pill>
          </Link>
        ) : (
          <Pill tone="muted">by {play.author_label}</Pill>
        )}
        <HeartButton play={play} />
      </div>

      {runLink}

      {isCoach ? <AddToPlaybook play={libraryPlayAsPlay(play)} compact /> : null}

      {isAdmin && !play.featured ? (
        <BubbleButton size="sm" tone="grape" disabled={feature.isPending} onClick={() => feature.mutate()}>
          ★ Make Play of the Day
        </BubbleButton>
      ) : null}
    </Panel>
  );
}
