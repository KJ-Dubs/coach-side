import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BubbleButton, EmptyState, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { fetchLibraryPlays } from "@/lib/library";
import { PLAY_CATEGORIES, normalizeCategory } from "@/lib/types";

/** Free discovery feed of plays coaches published to the CoachSide Library. */
export function PlayLibrary() {
  const [category, setCategory] = useState<string>("All");
  const plays = useQuery({ queryKey: ["library-plays"], queryFn: fetchLibraryPlays });

  const shown = useMemo(() => {
    const list = plays.data ?? [];
    return list.filter((p) => category === "All" || normalizeCategory(p.category) === category);
  }, [plays.data, category]);

  const copyShare = async (token: string | null) => {
    if (!token) {
      toast.error("This play has no public link yet");
      return;
    }
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.success(`Share link: ${url}`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-wrap items-center gap-2">
        <Label>Category</Label>
        {["All", ...PLAY_CATEGORIES].map((c) => (
          <BubbleButton
            key={c}
            size="sm"
            tone={category === c ? "grape" : "neutral"}
            onClick={() => setCategory(c)}
          >
            {c}
          </BubbleButton>
        ))}
        <Pill tone="muted" className="ml-auto">
          {shown.length} {shown.length === 1 ? "play" : "plays"}
        </Pill>
      </Panel>

      {plays.isLoading ? <EmptyState>Loading the library…</EmptyState> : null}
      {!plays.isLoading && !shown.length ? (
        <EmptyState>No published plays here yet — publish one from your playbook</EmptyState>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <Panel key={p.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-2xl border border-grape/60 bg-grape/20 px-3 py-2 text-xl font-black leading-tight text-foreground">
                {p.name}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral">{normalizeCategory(p.category)}</Pill>
              {p.library_author_name ? <Pill tone="muted">by {p.library_author_name}</Pill> : null}
              <Pill tone="muted">v{p.library_version ?? 1}</Pill>
            </div>

            <Link
              to="/plays/$playId/view"
              params={{ playId: p.id }}
              search={{}}
              aria-label={`Run play ${p.name}`}
            >
              <BubbleButton tone="flame" size="lg" className="min-h-14 w-full">
                ▶ Run Play
              </BubbleButton>
            </Link>

            <AddToPlaybook play={p} compact />

            <BubbleButton size="sm" tone="ghost" onClick={() => void copyShare(p.share_token)}>
              Share
            </BubbleButton>
          </Panel>
        ))}
      </div>

      <Panel>
        <Note>
          Library plays stay owned by the coach who published them. Adding one links the published
          version to your team, so later edits never change what you already taught.
        </Note>
      </Panel>
    </div>
  );
}
