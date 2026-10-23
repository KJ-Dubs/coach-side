import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BubbleButton, EmptyState, InfoPanel, Label, Panel, Pill, PrimaryCTA, SectionHeader } from "@/components/Bubbles";
import { PlayPresenter } from "@/components/court/PlayPresenter";
import { PresenterNav } from "@/components/court/PresenterNav";
import { AddToPlaybook } from "@/components/AddToPlaybook";
import { HeartButton } from "@/components/community/HeartButton";
import { FollowButton } from "@/components/community/FollowButton";
import { useAuth } from "@/lib/auth";
import { resolveRole, useAccess } from "@/lib/access";
import {
  fetchLibraryFeed,
  fetchPublicFrames,
  libraryPlayAsPlay,
} from "@/lib/community";
import { normalizeCategory } from "@/lib/types";
import { getPublicPlaySeo } from "@/lib/publicPlay.functions";
import { playSeoDescription, playSeoKeywords, playSeoTerms, playSeoTitle } from "@/lib/playSeo";

const SITE = "https://coachside.live";

export const Route = createFileRoute("/library/$playId")({
  staticData: { sitemap: true },
  loader: async ({ params }) => {
    const ok = /^[0-9a-f-]{36}$/i.test(params.playId);
    return { seo: ok ? await getPublicPlaySeo({ data: { playId: params.playId } }) : null };
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE}/library/${params.playId}`;
    const seo = loaderData?.seo ?? null;
    if (!seo) {
      return {
        meta: [
          { title: "Play not available — CoachSide Library" },
          { name: "description", content: "This basketball play is not published in the CoachSide Library." },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = playSeoTitle(seo);
    const description = playSeoDescription(seo);
    const keywords = playSeoKeywords(seo);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "keywords", content: keywords.join(", ") },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${SITE}/og-cover.png` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: `${SITE}/og-cover.png` },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: seo.name,
            headline: title,
            description,
            keywords: keywords.join(", "),
            genre: `${normalizeCategory(seo.category)} basketball play`,
            url,
            ...(seo.published_at ? { datePublished: seo.published_at } : {}),
            author: { "@type": "Person", name: seo.author_label },
            publisher: { "@type": "Organization", name: "CoachSide", url: SITE },
          }),
        },
      ],
    };
  },
  component: PublicPlayPage,
});

function PublicPlayPage() {
  const { playId } = Route.useParams();
  const { seo } = Route.useLoaderData();
  const { session } = useAuth();
  const { access } = useAccess();
  const isCoach = !!session && !resolveRole(access).isPlayerOnly;

  const feed = useQuery({ queryKey: ["library-feed", null], queryFn: () => fetchLibraryFeed(null) });
  const frames = useQuery({
    queryKey: ["public-play-frames", playId],
    queryFn: () => fetchPublicFrames(playId),
  });
  const play = (feed.data ?? []).find((p) => p.id === playId) ?? null;
  const info = play ?? seo;
  const terms = info ? playSeoTerms(info) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-2 p-2 sm:p-3">
      <PresenterNav source="library" />
      {!play && seo ? (
        <Panel>
          <SectionHeader as="h1" title={seo.name} subtitle={`${normalizeCategory(seo.category)} basketball play`}>
            <Pill tone="muted">Loading animation…</Pill>
          </SectionHeader>
        </Panel>
      ) : null}
      {feed.isLoading && !seo ? <EmptyState>Loading play…</EmptyState> : null}
      {!feed.isLoading && !play && !seo ? (
        <Panel className="flex flex-col items-start gap-2">
          <Label>This play is not published</Label>
          <Link to="/library">
            <BubbleButton tone="grape">Browse the Library</BubbleButton>
          </Link>
        </Panel>
      ) : null}

      {play ? (
        <>
          <PlayPresenter
            play={{
              name: play.name,
              category: play.category,
              attack_basket: play.attack_basket,
            }}
            frames={frames.data}
            loading={frames.isLoading}
          />
          <Panel className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral">{normalizeCategory(play.category)}</Pill>
            {play.creator_username ? (
              <Link to="/coach/$username" params={{ username: play.creator_username }} search={{ from: "public-plays" }}>
                <Pill tone="grape">by {play.author_label}</Pill>
              </Link>
            ) : (
              <Pill tone="muted">by {play.author_label}</Pill>
            )}
            <HeartButton play={play} />
            {play.creator_username ? <FollowButton username={play.creator_username} /> : null}
            {isCoach ? (
              <div className="ml-auto">
                <AddToPlaybook play={libraryPlayAsPlay(play)} compact />
              </div>
            ) : null}
          </Panel>
        </>
      ) : null}

      {info && terms ? (
        <Panel className="flex flex-col gap-2">
          <Label>Indexed as</Label>
          <InfoPanel>{playSeoDescription(info)}</InfoPanel>
          <IndexRow label="Play type" items={[terms.type]} tone="grape" />
          <IndexRow label="Concept" items={terms.concepts} tone="grape" />
          <IndexRow label="Defense faced" items={terms.defenses} tone="neutral" />
          <IndexRow label="Outcome" items={terms.outcomes} tone="flame" />
          <IndexRow label="Actions" items={terms.actions} tone="neutral" />
          <IndexRow label="Tags" items={terms.tags} tone="muted" />
        </Panel>
      ) : null}

      {info && !session ? (
        <Panel className="flex flex-col items-center gap-3">
          <InfoPanel>Create a free coach account to heart plays and save them to your playbook.</InfoPanel>
          <PrimaryCTA><Link to="/auth" search={{ mode: "signup" }}>
            <BubbleButton tone="grape">Create Coach Account</BubbleButton>
          </Link></PrimaryCTA>
        </Panel>
      ) : null}
    </main>
  );
}

function IndexRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "grape" | "neutral" | "flame" | "muted";
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill tone="muted">{label}</Pill>
      {items.map((t) => (
        <Pill key={t} tone={tone}>
          {t}
        </Pill>
      ))}
    </div>
  );
}
