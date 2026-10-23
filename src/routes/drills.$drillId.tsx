import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BubbleButton,
  EmptyState,
  InfoPanel,
  Label,
  Panel,
  Pill,
  SectionHeader,
} from "@/components/Bubbles";
import { DrillCanvas } from "@/components/court/DrillCanvas";
import { ExportDrillVideo } from "@/components/court/ExportDrillVideo";
import { SocialCTA } from "@/components/SocialCTA";
import { copyDrillForMe, fetchDrill, fetchDrillFrames } from "@/lib/drills";
import { useAuth } from "@/lib/auth";
import { getPublicDrillSeo } from "@/lib/publicDrill.functions";
import { drillSeoDescription, drillSeoKeywords, drillSeoTitle } from "@/lib/drillSeo";

const SITE = "https://coachside.live";

export const Route = createFileRoute("/drills/$drillId")({
  staticData: { sitemap: true },
  loader: async ({ params }) => {
    const ok = /^[0-9a-f-]{36}$/i.test(params.drillId);
    return { seo: ok ? await getPublicDrillSeo({ data: { drillId: params.drillId } }) : null };
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE}/drills/${params.drillId}`;
    const seo = loaderData?.seo ?? null;
    if (!seo) {
      return {
        meta: [
          { title: "Drill not available — CoachSide Drill Library" },
          { name: "description", content: "This basketball drill is not published in the CoachSide Library." },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = drillSeoTitle(seo);
    const description = drillSeoDescription(seo);
    const keywords = drillSeoKeywords(seo);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "keywords", content: keywords.join(", ") },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: seo.name,
            headline: title,
            description,
            keywords: keywords.join(", "),
            url,
            ...(seo.duration_minutes > 0 ? { totalTime: `PT${Math.round(seo.duration_minutes)}M` } : {}),
            ...(seo.equipment.length ? { tool: seo.equipment.map((name) => ({ "@type": "HowToTool", name })) } : {}),
            ...(seo.published_at ? { datePublished: seo.published_at } : {}),
            step: [{ "@type": "HowToStep", text: seo.instructions }],
            author: { "@type": "Person", name: seo.library_author_name ?? "CoachSide Coach" },
            publisher: { "@type": "Organization", name: "CoachSide", url: SITE },
          }),
        },
      ],
    };
  },
  component: DrillPage,
  errorComponent: () => <EmptyState>That drill could not be loaded.</EmptyState>,
  notFoundComponent: () => <EmptyState>That drill does not exist.</EmptyState>,
});

function DrillPage() {
  const { drillId } = Route.useParams();
  const { seo } = Route.useLoaderData();
  const { user } = useAuth();
  const drill = useQuery({ queryKey: ["drill", drillId], queryFn: () => fetchDrill(drillId) });
  const frames = useQuery({ queryKey: ["drill-frames", drillId], queryFn: () => fetchDrillFrames(drillId) });

  const copy = useMutation({
    mutationFn: () => copyDrillForMe(drillId),
    onSuccess: () => toast.success("Saved to My Drills"),
    onError: (e: Error) => toast.error(e.message),
  });

  // Server-loaded public text renders first (and for Google); the full drill replaces it once fetched.
  const d = drill.data ?? seo;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-2 sm:p-4">
      <SectionHeader as="h1" title={d?.name ?? "Drill"} subtitle={d ? `${d.category} • ${d.duration_minutes} min • ${d.group_size}` : "Loading…"}>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/library">
            <BubbleButton tone="neutral" size="sm">
              Back to Library
            </BubbleButton>
          </Link>
          <Link to={user ? "/dashboard" : "/"}>
            <BubbleButton tone="ghost" size="sm">
              {user ? "Home" : "CoachSide"}
            </BubbleButton>
          </Link>
        </div>
      </SectionHeader>

      {!d && !drill.isLoading ? <EmptyState>That drill is not available.</EmptyState> : null}

      {d ? (
        <>
          {seo ? <InfoPanel>{drillSeoDescription(seo)}</InfoPanel> : null}
          {drill.data ? (
          <Panel className="flex flex-col gap-3">
            <DrillCanvas frame={frames.data?.[0]} />
            {frames.data?.[0]?.note ? <InfoPanel>{frames.data[0]!.note}</InfoPanel> : null}
          </Panel>

          {frames.data?.length ? <ExportDrillVideo drill={d} frames={frames.data} /> : null}

          <Panel className="flex flex-col gap-3">
            <div className="flex flex-wrap justify-center gap-2">
              <Pill tone="grape">{d.difficulty}</Pill>
              <Pill tone="neutral">{d.style}</Pill>
              {d.repetitions ? <Pill tone="muted">{d.repetitions}</Pill> : null}
              {d.equipment.map((e) => (
                <Pill key={e} tone="muted">
                  {e}
                </Pill>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>How it runs</Label>
              <InfoPanel>{d.instructions}</InfoPanel>
            </div>
            {d.coaching_points ? (
              <div className="flex flex-col gap-1.5">
                <Label>Coaching points</Label>
                <InfoPanel tone="grape">{d.coaching_points}</InfoPanel>
              </div>
            ) : null}
            {d.scoring_rules ? (
              <div className="flex flex-col gap-1.5">
                <Label>Scoring</Label>
                <InfoPanel tone="flame">{d.scoring_rules}</InfoPanel>
              </div>
            ) : null}
            <InfoPanel className="text-center">by {d.library_author_name ?? "CoachSide Coach"}</InfoPanel>
            {user ? (
              <BubbleButton tone="flame" size="lg" disabled={copy.isPending} onClick={() => copy.mutate()}>
                {copy.isPending ? "Saving…" : "Save my own version"}
              </BubbleButton>
            ) : null}
          </Panel>
          <SocialCTA />
        </>
      ) : null}
    </main>
  );
}
