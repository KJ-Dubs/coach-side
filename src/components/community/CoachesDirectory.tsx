import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BubbleButton, EmptyState, Note, Panel, Pill, TextInput } from "@/components/Bubbles";
import { FollowButton } from "@/components/community/FollowButton";
import {
  fetchCreatorDirectory,
  fetchMyPublicProfile,
  type CreatorDirectoryEntry,
} from "@/lib/community";
import { useAuth } from "@/lib/auth";

export function CoachesDirectory({ source }: { source: "app" | "public" }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const directory = useQuery({ queryKey: ["creator-directory"], queryFn: fetchCreatorDirectory });
  const mine = useQuery({
    queryKey: ["my-public-profile"],
    queryFn: fetchMyPublicProfile,
    enabled: !!user,
  });

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return directory.data ?? [];
    return (directory.data ?? []).filter((coach) =>
      coach.display_name.toLowerCase().includes(needle) || coach.username.toLowerCase().includes(needle),
    );
  }, [directory.data, query]);

  const origin = source === "app" ? "app-coaches" : "public-coaches";

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col gap-2">
        <TextInput
          aria-label="Search coaches"
          placeholder="Search coaches by name or @handle"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Note>Popular coaches appear first, then coaches with the most published plays.</Note>
      </Panel>

      {directory.isLoading ? <EmptyState>Loading coaches…</EmptyState> : null}
      {!directory.isLoading && !shown.length ? <EmptyState>No coaches match that search yet</EmptyState> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((coach) => (
          <CoachCard
            key={coach.username}
            coach={coach}
            ownUsername={mine.data?.username ?? null}
            origin={origin}
          />
        ))}
      </div>
    </div>
  );
}

function CoachCard({
  coach,
  ownUsername,
  origin,
}: {
  coach: CreatorDirectoryEntry;
  ownUsername: string | null;
  origin: "app-coaches" | "public-coaches";
}) {
  const isSelf = ownUsername?.toLowerCase() === coach.username.toLowerCase();

  return (
    <Panel className="flex min-w-0 flex-col gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-black text-foreground">{coach.display_name}</h3>
        <p className="truncate text-sm font-bold text-grape-bright">@{coach.username}</p>
      </div>
      {coach.bio ? (
        <p className="line-clamp-3 text-left text-sm font-semibold leading-relaxed text-muted-foreground">{coach.bio}</p>
      ) : null}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Metric label="Plays" value={coach.published_plays} />
        <Metric label="Hearts" value={coach.total_hearts} />
        <Metric label="Followers" value={coach.followers} />
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-center gap-2">
        <Link to="/coach/$username" params={{ username: coach.username }} search={{ from: origin }}>
          <BubbleButton size="sm" tone="neutral">View Profile</BubbleButton>
        </Link>
        {isSelf ? (
          <Pill tone="grape">Your profile</Pill>
        ) : (
          <FollowButton username={coach.username} size="sm" />
        )}
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/70 px-1.5 py-2">
      <div className="text-base font-black text-foreground">{value}</div>
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
    </div>
  );
}