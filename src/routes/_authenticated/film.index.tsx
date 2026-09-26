import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clapperboard, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, Panel, Pill } from "@/components/Bubbles";
import { listFilmJobs } from "@/lib/film.functions";
import { FILM_STATUS_LABEL, type FilmJob } from "@/lib/film.types";
import { useCurrentTeam } from "@/lib/teamContext";

export const Route = createFileRoute("/_authenticated/film/")({
  head: () => ({
    meta: [
      { title: "Film Room — CoachSide" },
      { name: "description", content: "Upload game film, review tagged events, and turn them into verified stats." },
      { property: "og:title", content: "Film Room — CoachSide" },
      { property: "og:description", content: "Upload game film, review tagged events, and turn them into verified stats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FilmRoomPage,
});

function statusTone(status: string): "grape" | "flame" | "success" | "danger" | "muted" {
  if (status === "complete") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "needs_review") return "flame";
  if (status === "analyzing" || status === "queued") return "grape";
  return "muted";
}

function FilmRoomPage() {
  const { team, teamId, loading } = useCurrentTeam();
  const fetchJobs = useServerFn(listFilmJobs);
  const { data: jobs } = useQuery({
    queryKey: ["film-jobs", teamId],
    queryFn: () => fetchJobs({ data: { teamId: teamId! } }),
    enabled: Boolean(teamId),
    refetchInterval: 15000,
  });

  return (
    <AppShell title="Film Room" subtitle="Upload game film. Review every event. Own the stats." wide>
      <div className="flex flex-col items-center gap-4">
        <Panel className="flex w-full max-w-3xl flex-col items-center gap-3 text-center">
          <Clapperboard className="h-8 w-8 text-grape-bright" aria-hidden />
          <p className="text-sm font-semibold leading-relaxed text-muted-foreground">
            Upload a full game video, tag events while you watch, and finalize them into real team
            stats. Automatic AI analysis is not connected yet — every event is reviewed by you
            before it counts.
          </p>
          <Link to="/film/new">
            <BubbleButton tone="grape" size="lg">
              <Plus className="h-4 w-4" aria-hidden /> New film job
            </BubbleButton>
          </Link>
        </Panel>

        {loading ? (
          <EmptyState className="w-full max-w-3xl">Loading your teams…</EmptyState>
        ) : !team ? (
          <EmptyState className="w-full max-w-3xl">Create a team first, then come back to add film.</EmptyState>
        ) : !jobs?.length ? (
          <EmptyState className="w-full max-w-3xl">
            No film jobs for {team.name} yet. Upload your first game video to get started.
          </EmptyState>
        ) : (
          <div className="flex w-full max-w-3xl flex-col gap-2">
            {(jobs as unknown as FilmJob[]).map((job) => (
              <Link key={job.id} to="/film/$jobId" params={{ jobId: job.id }} className="block">
                <Panel className="flex flex-wrap items-center gap-2 transition-all hover:border-grape/70">
                  <Pill tone={statusTone(job.status)}>{FILM_STATUS_LABEL[job.status] ?? job.status}</Pill>
                  <span className="text-sm font-bold text-foreground">
                    {job.source_type === "upload" ? "Uploaded video" : "Linked video"} ·{" "}
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                  {job.status_detail ? (
                    <span className="w-full text-xs font-semibold text-muted-foreground">{job.status_detail}</span>
                  ) : null}
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
