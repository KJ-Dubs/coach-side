import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BubbleButton, Heading, Label, Panel, Pill } from "@/components/Bubbles";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { HeartButton } from "@/components/community/HeartButton";
import { PlayThumb } from "@/components/community/PlayThumb";
import { fetchPlayOfTheDay, libraryPlayAsPlay } from "@/lib/community";
import { normalizeCategory } from "@/lib/types";
import { trackActivityOnce } from "@/lib/activity";

const markViewed = (id: string) => trackActivityOnce("potd_viewed", `${new Date().toISOString().slice(0, 10)}`, { entityId: id });

/** Home's featured play. A CoachSide owner picks this by hand. */
export function PlayOfTheDayCard({ canAdd = true }: { canAdd?: boolean }) {
  const potd = useQuery({ queryKey: ["play-of-the-day"], queryFn: fetchPlayOfTheDay });
  const play = potd.data;
  if (!play) return null;

  return (
    <Panel className="flex flex-col gap-3 border-flame/50 bg-flame/5 sm:flex-row sm:items-stretch">
      <Link
        to="/library/$playId"
        params={{ playId: play.id }}
        className="block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape sm:w-1/2"
        aria-label={`Open Play of the Day ${play.name}`}
        onClick={() => markViewed(play.id)}
      >
        <PlayThumb playId={play.id} attackBasket={play.attack_basket} category={play.category} />
      </Link>
      <div className="flex flex-1 flex-col gap-2">
        <Label>Play of the Day</Label>
        <Heading tone="flame">{play.name}</Heading>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">{normalizeCategory(play.category)}</Pill>
          {play.creator_username ? (
            <Link to="/coach/$username" params={{ username: play.creator_username }}>
              <Pill tone="grape">by {play.author_label}</Pill>
            </Link>
          ) : (
            <Pill tone="muted">by {play.author_label}</Pill>
          )}
          <HeartButton play={play} />
        </div>
        <Link
          to="/plays/$playId/view"
          params={{ playId: play.id }}
          search={{ from: "home" }}
          onClick={() => markViewed(play.id)}
          className="block w-full"
        >
          <BubbleButton tone="flame" size="lg" className="min-h-14 w-full">
            ▶ Run Play
          </BubbleButton>
        </Link>
        {canAdd ? <AddToPlaybook play={libraryPlayAsPlay(play)} compact /> : null}
      </div>
    </Panel>
  );
}
