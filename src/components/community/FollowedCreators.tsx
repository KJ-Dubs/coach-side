import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BubbleButton, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { fetchLibraryFeed, fetchMyFollowedCreators, sortLibrary } from "@/lib/community";

/** Lightweight "new from coaches you follow" strip. Hidden when empty. */
export function FollowedCreators() {
  const follows = useQuery({ queryKey: ["my-follows"], queryFn: fetchMyFollowedCreators });
  const feed = useQuery({
    queryKey: ["library-feed", null],
    queryFn: () => fetchLibraryFeed(null),
    enabled: !!follows.data?.length,
  });

  const names = new Set((follows.data ?? []).map((c) => c.username));
  if (!names.size) return null;

  const plays = sortLibrary(
    (feed.data ?? []).filter((p) => p.creator_username && names.has(p.creator_username)),
    "new",
  ).slice(0, 3);
  if (!plays.length) return null;

  return (
    <Panel className="mb-3 flex flex-col gap-2">
      <Label>From coaches you follow</Label>
      <div className="flex flex-col gap-2">
        {plays.map((p) => (
          <Link
            key={p.id}
            to="/library/$playId"
            params={{ playId: p.id }}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/70 px-3 py-2 transition-all hover:border-grape/70 active:scale-[0.99]"
          >
            <span className="text-base font-black leading-tight text-foreground">{p.name}</span>
            <Pill tone="muted">by {p.author_label}</Pill>
            <Pill tone="flame">♥ {p.hearts}</Pill>
            <BubbleButton size="sm" tone="ghost" className="ml-auto" tabIndex={-1}>
              Watch
            </BubbleButton>
          </Link>
        ))}
      </div>
      <Note>Follow coaches from any play page to keep an eye on what they publish.</Note>
    </Panel>
  );
}
