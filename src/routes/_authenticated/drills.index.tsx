import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, InfoPanel, Panel } from "@/components/Bubbles";
import { DrillCard } from "@/components/drills/DrillFeed";
import { fetchMyDrills } from "@/lib/drills";

export const Route = createFileRoute("/_authenticated/drills/")({
  head: () => ({
    meta: [
      { title: "My Drills — CoachSide" },
      { name: "description", content: "Your own basketball drills, ready to drop into a practice plan." },
      { property: "og:title", content: "My Drills — CoachSide" },
      { property: "og:description", content: "Build and keep your own basketball drills in CoachSide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyDrillsPage,
});

function MyDrillsPage() {
  const drills = useQuery({ queryKey: ["my-drills"], queryFn: fetchMyDrills });

  return (
    <AppShell
      title="My Drills"
      subtitle="Your own drills, plus anything you saved from the Library"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/drills/new">
            <BubbleButton size="sm" tone="flame">
              + New Drill
            </BubbleButton>
          </Link>
          <Link to="/plays" search={{ tab: "library", content: "drills" }}>
            <BubbleButton size="sm" tone="ghost">
              CoachSide Drill Library
            </BubbleButton>
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Panel>
          <InfoPanel>
            Drills you build stay private until you publish them to the CoachSide Drill Library.
          </InfoPanel>
        </Panel>
        {drills.isLoading ? <EmptyState>Loading your drills…</EmptyState> : null}
        {!drills.isLoading && !drills.data?.length ? (
          <EmptyState>No drills yet — start with New Drill or save one from the Library.</EmptyState>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(drills.data ?? []).map((d) => (
            <DrillCard key={d.id} drill={d} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
