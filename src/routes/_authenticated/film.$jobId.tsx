import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  Field,
  InfoPanel,
  Label,
  Panel,
  Pill,
  SelectInput,
} from "@/components/Bubbles";
import { Court, toLocal } from "@/components/court/Court";
import { statColor } from "@/lib/statColors";
import { STAT_LABELS } from "@/lib/statColors";
import {
  addFilmEvent,
  bulkAcceptFilmEvents,
  cancelFilmJob,
  deleteFilmJob,
  finalizeFilmJob,
  getFilmJob,
  getFilmPlaybackUrl,
  listFilmEvents,
  listFilmSubs,
  reviewFilmEvent,
  reviewFilmSub,
} from "@/lib/film.functions";
import {
  FILM_EVENT_TYPES,
  FILM_STATUS_LABEL,
  formatVideoTime,
  type FilmEvent,
  type FilmJob,
  type FilmSub,
} from "@/lib/film.types";
import { fetchPlayers } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/film/$jobId")({
  head: () => ({
    meta: [
      { title: "Film Review — CoachSide" },
      { name: "description", content: "Review film events and finalize verified stats." },
      { property: "og:title", content: "Film Review — CoachSide" },
      { property: "og:description", content: "Review film events and finalize verified stats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FilmJobPage,
});

const SHOT_TYPES = new Set(["MADE", "MISS", "FT_MADE", "FT_MISS"]);

function FilmJobPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);

  const getJob = useServerFn(getFilmJob);
  const getPlayback = useServerFn(getFilmPlaybackUrl);
  const getEvents = useServerFn(listFilmEvents);
  const getSubs = useServerFn(listFilmSubs);
  const reviewEvent = useServerFn(reviewFilmEvent);
  const reviewSub = useServerFn(reviewFilmSub);
  const addEvent = useServerFn(addFilmEvent);
  const bulkAccept = useServerFn(bulkAcceptFilmEvents);
  const finalize = useServerFn(finalizeFilmJob);
  const cancelJob = useServerFn(cancelFilmJob);
  const deleteJob = useServerFn(deleteFilmJob);

  const { data: jobData } = useQuery({
    queryKey: ["film-job", jobId],
    queryFn: () => getJob({ data: { jobId } }),
    refetchInterval: (q) => {
      const s = q.state.data?.job?.status;
      return s === "queued" || s === "analyzing" || s === "uploading" ? 8000 : false;
    },
  });
  const job = jobData?.job as FilmJob | undefined;

  const { data: playback } = useQuery({
    queryKey: ["film-playback", jobId],
    queryFn: () => getPlayback({ data: { jobId } }),
    enabled: Boolean(job?.storage_path),
    refetchInterval: 50 * 60 * 1000,
  });
  const { data: events } = useQuery({
    queryKey: ["film-events", jobId],
    queryFn: () => getEvents({ data: { jobId } }),
    enabled: Boolean(job),
  });
  const { data: subs } = useQuery({
    queryKey: ["film-subs", jobId],
    queryFn: () => getSubs({ data: { jobId } }),
    enabled: Boolean(job),
  });
  const { data: players } = useQuery({
    queryKey: ["players", job?.team_id],
    queryFn: () => fetchPlayers(job!.team_id),
    enabled: Boolean(job?.team_id),
  });

  const [filter, setFilter] = useState<"pending" | "all" | "shots">("pending");
  const [editing, setEditing] = useState<FilmEvent | null>(null);
  const [adding, setAdding] = useState(false);
  const [addLoc, setAddLoc] = useState<{ x: number; y: number } | null>(null);
  const [addType, setAddType] = useState("MADE");
  const [addPlayer, setAddPlayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const playerById = useMemo(() => new Map((players ?? []).map((p) => [p.id, p])), [players]);
  const pendingCount = (events ?? []).filter((e) => e.review_state === "pending").length;
  const shown = useMemo(() => {
    const list = (events ?? []) as FilmEvent[];
    if (filter === "pending") return list.filter((e) => e.review_state === "pending");
    if (filter === "shots") return list.filter((e) => SHOT_TYPES.has(e.event_type));
    return list;
  }, [events, filter]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["film-events", jobId] });
    qc.invalidateQueries({ queryKey: ["film-subs", jobId] });
    qc.invalidateQueries({ queryKey: ["film-job", jobId] });
  };

  const seek = (ms: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = ms / 1000;
      v.play().catch(() => {});
    }
  };

  const act = async (id: string, action: "accept" | "reject" | "edit", patch?: Record<string, unknown>) => {
    await reviewEvent({ data: { id, action, patch: patch as never } });
    refresh();
  };

  const saveEdit = async () => {
    if (!editing) return;
    await act(editing.id, "edit", {
      event_type: editing.event_type,
      player_id: editing.player_id,
      x: editing.x,
      y: editing.y,
      points: editing.points,
      quarter: editing.quarter,
      clock_seconds: editing.clock_seconds,
      side: editing.side,
    });
    setEditing(null);
  };

  const submitAdd = async () => {
    if (!job) return;
    const v = videoRef.current;
    await addEvent({
      data: {
        jobId: job.id,
        event_type: addType,
        player_id: addPlayer || null,
        x: addLoc?.x ?? null,
        y: addLoc?.y ?? null,
        points: addType === "MADE" ? (addLoc && addLoc.x < 0.5 ? 2 : 2) : addType === "FT_MADE" ? 1 : 0,
        video_ts_ms: Math.round((v?.currentTime ?? 0) * 1000),
      },
    });
    setAdding(false);
    setAddLoc(null);
    refresh();
  };

  const doFinalize = async () => {
    if (!job || busy) return;
    setBusy(true);
    try {
      const result = await finalize({ data: { jobId: job.id } });
      setNotice(`Finalized: ${result.events} events and ${result.subs} substitutions are now verified stats.`);
      refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!job || busy) return;
    if (!window.confirm("Delete this film job and its video? Verified stats stay unless you choose to remove them.")) return;
    setBusy(true);
    try {
      await deleteJob({ data: { jobId: job.id, removePromotedStats: false } });
      navigate({ to: "/film" });
    } catch (e) {
      setNotice((e as Error).message);
      setBusy(false);
    }
  };

  if (!job) {
    return (
      <AppShell title="Film Review">
        <EmptyState>Loading film job…</EmptyState>
      </AppShell>
    );
  }

  const reviewable = job.status === "needs_review" || job.status === "complete";

  return (
    <AppShell title="Film Review" subtitle={FILM_STATUS_LABEL[job.status] ?? job.status} wide>
      <div className="flex flex-col items-center gap-4">
        <Panel className="flex w-full max-w-5xl flex-wrap items-center justify-center gap-2">
          <Pill tone={job.status === "complete" ? "success" : job.status === "failed" ? "danger" : job.status === "needs_review" ? "flame" : "grape"}>
            {FILM_STATUS_LABEL[job.status] ?? job.status}
          </Pill>
          {job.provider === "none" ? (
            <Pill tone="muted">Automatic analysis not connected — manual tagging available</Pill>
          ) : null}
          {job.status_detail ? <Pill tone="muted">{job.status_detail}</Pill> : null}
          {pendingCount > 0 ? <Pill tone="flame">{pendingCount} to review</Pill> : null}
        </Panel>

        {notice ? <InfoPanel tone="grape" className="max-w-5xl">{notice}</InfoPanel> : null}

        {playback?.url ? (
          <Panel className="w-full max-w-5xl p-2">
            <video ref={videoRef} src={playback.url} controls className="w-full rounded-2xl bg-black" playsInline />
          </Panel>
        ) : job.source_url ? (
          <InfoPanel tone="neutral" className="max-w-5xl">
            Linked video:{" "}
            <a href={job.source_url} target="_blank" rel="noreferrer" className="underline">
              open in a new tab
            </a>{" "}
            and tag events with the timestamps below.
          </InfoPanel>
        ) : null}

        {reviewable ? (
          <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1.1fr_1fr]">
            {/* Court + add-event flow */}
            <Panel className="flex flex-col gap-3">
              <Label>Shot locations</Label>
              <Court
                variant="full"
                onCourtPoint={adding || editing ? (p) => (editing ? setEditing({ ...editing, x: p.x, y: p.y }) : setAddLoc(p)) : undefined}
                overlay={
                  <div className="pointer-events-none absolute inset-0">
                    {(events ?? [])
                      .filter((e) => e.x != null && e.y != null && e.review_state !== "rejected")
                      .map((e) => {
                        const lp = toLocal("full", { x: e.x!, y: e.y! });
                        return (
                          <span
                            key={e.id}
                            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
                            style={{
                              left: `${lp.x * 100}%`,
                              top: `${lp.y * 100}%`,
                              background: statColor(e.event_type),
                              opacity: e.review_state === "pending" ? 0.55 : 1,
                            }}
                          />
                        );
                      })}
                    {addLoc ? (
                      <span
                        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-flame bg-flame/60"
                        style={{ left: `${addLoc.x * 100}%`, top: `${addLoc.y * 100}%` }}
                      />
                    ) : null}
                  </div>
                }
              />
              {adding ? (
                <div className="flex flex-col gap-2">
                  <Label>Add event at {formatVideoTime(Math.round((videoRef.current?.currentTime ?? 0) * 1000))}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Stat">
                      <SelectInput value={addType} onChange={(e) => setAddType(e.target.value)}>
                        {FILM_EVENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {STAT_LABELS[t] ?? t}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Player">
                      <SelectInput value={addPlayer} onChange={(e) => setAddPlayer(e.target.value)}>
                        <option value="">— Unknown —</option>
                        {(players ?? []).map((p: Player) => (
                          <option key={p.id} value={p.id}>
                            #{p.jersey} {p.name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                  <InfoPanel tone="neutral">Tap the court to set the shot location (optional for non-shots).</InfoPanel>
                  <div className="flex flex-wrap gap-2">
                    <BubbleButton tone="grape" onClick={submitAdd}>
                      <Check className="h-4 w-4" aria-hidden /> Add event
                    </BubbleButton>
                    <BubbleButton tone="ghost" onClick={() => { setAdding(false); setAddLoc(null); }}>
                      Cancel
                    </BubbleButton>
                  </div>
                </div>
              ) : (
                <BubbleButton tone="flame" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" aria-hidden /> Add event at current video time
                </BubbleButton>
              )}
            </Panel>

            {/* Timeline */}
            <Panel className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-1.5">
                <Label>Timeline</Label>
                {(["pending", "all", "shots"] as const).map((f) => (
                  <BubbleButton key={f} size="sm" tone={filter === f ? "grape" : "ghost"} onClick={() => setFilter(f)}>
                    {f === "pending" ? `Pending (${pendingCount})` : f === "all" ? "All" : "Shots"}
                  </BubbleButton>
                ))}
              </div>
              {!shown.length ? (
                <EmptyState>
                  {filter === "pending"
                    ? "Nothing waiting for review. Add events manually or wait for analysis."
                    : "No events yet."}
                </EmptyState>
              ) : (
                shown.map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-2xl border p-2",
                      e.review_state === "pending"
                        ? "border-flame/40 bg-flame/5"
                        : e.review_state === "rejected"
                          ? "border-border/50 bg-surface-2/40 opacity-60"
                          : "border-grape/40 bg-grape/5",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => seek(e.video_ts_ms)}
                      className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-black text-foreground"
                    >
                      {formatVideoTime(e.video_ts_ms)}
                    </button>
                    <span className="text-sm font-bold text-foreground">
                      {STAT_LABELS[e.event_type] ?? e.event_type}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {e.player_id
                        ? `#${playerById.get(e.player_id)?.jersey ?? "?"} ${playerById.get(e.player_id)?.name ?? ""}`
                        : e.jersey_detected
                          ? `#${e.jersey_detected} (detected)`
                          : "Unknown player"}
                      {e.side === "opp" ? " · Opponent" : ""}
                    </span>
                    {e.confidence != null ? (
                      <Pill tone={e.confidence >= 0.8 ? "success" : e.confidence >= 0.5 ? "flame" : "danger"}>
                        {Math.round(e.confidence * 100)}%
                      </Pill>
                    ) : null}
                    <div className="ml-auto flex gap-1">
                      {e.review_state === "pending" ? (
                        <>
                          <BubbleButton size="sm" tone="grape" onClick={() => act(e.id, "accept")} aria-label="Accept">
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          </BubbleButton>
                          <BubbleButton size="sm" tone="neutral" onClick={() => setEditing({ ...e })} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </BubbleButton>
                          <BubbleButton size="sm" tone="ghost" onClick={() => act(e.id, "reject")} aria-label="Reject">
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </BubbleButton>
                        </>
                      ) : (
                        <Pill tone={e.review_state === "rejected" ? "danger" : "success"}>{e.review_state}</Pill>
                      )}
                    </div>
                  </div>
                ))
              )}

              {(subs ?? []).length ? (
                <>
                  <Label>Substitutions</Label>
                  {(subs as FilmSub[]).map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface-2/50 p-2">
                      <button
                        type="button"
                        onClick={() => seek(s.video_ts_ms)}
                        className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-black text-foreground"
                      >
                        {formatVideoTime(s.video_ts_ms)}
                      </button>
                      <span className="text-xs font-bold text-foreground">
                        {playerById.get(s.player_out ?? "")?.name ?? "?"} out → {playerById.get(s.player_in ?? "")?.name ?? "?"} in
                      </span>
                      {s.review_state === "pending" ? (
                        <div className="ml-auto flex gap-1">
                          <BubbleButton size="sm" tone="grape" onClick={async () => { await reviewSub({ data: { id: s.id, action: "accept" } }); refresh(); }}>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          </BubbleButton>
                          <BubbleButton size="sm" tone="ghost" onClick={async () => { await reviewSub({ data: { id: s.id, action: "reject" } }); refresh(); }}>
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </BubbleButton>
                        </div>
                      ) : (
                        <Pill tone={s.review_state === "rejected" ? "danger" : "success"} className="ml-auto">{s.review_state}</Pill>
                      )}
                    </div>
                  ))}
                </>
              ) : null}
            </Panel>
          </div>
        ) : (
          <EmptyState className="w-full max-w-3xl">
            {job.status === "failed"
              ? `Analysis failed: ${job.error ?? "unknown error"}`
              : job.status === "cancelled"
                ? "This job was cancelled."
                : job.provider === "none"
                  ? "Automatic film analysis is not connected yet. Once a video is uploaded you can tag events manually."
                  : "Waiting for the analysis worker…"}
          </EmptyState>
        )}

        {editing ? (
          <Panel className="flex w-full max-w-2xl flex-col gap-3 border-flame/50">
            <Label>Edit event · {formatVideoTime(editing.video_ts_ms)}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Stat">
                <SelectInput value={editing.event_type} onChange={(e) => setEditing({ ...editing, event_type: e.target.value })}>
                  {FILM_EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {STAT_LABELS[t] ?? t}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Player">
                <SelectInput
                  value={editing.player_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, player_id: e.target.value || null })}
                >
                  <option value="">— Unknown —</option>
                  {(players ?? []).map((p: Player) => (
                    <option key={p.id} value={p.id}>
                      #{p.jersey} {p.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Side">
                <SelectInput value={editing.side} onChange={(e) => setEditing({ ...editing, side: e.target.value as "us" | "opp" })}>
                  <option value="us">Us</option>
                  <option value="opp">Opponent</option>
                </SelectInput>
              </Field>
            </div>
            <InfoPanel tone="neutral">Tap the court above to move the shot location.</InfoPanel>
            <div className="flex flex-wrap gap-2">
              <BubbleButton tone="grape" onClick={saveEdit}>
                Save & accept
              </BubbleButton>
              <BubbleButton tone="ghost" onClick={() => setEditing(null)}>
                Cancel
              </BubbleButton>
            </div>
          </Panel>
        ) : null}

        <Panel className="flex w-full max-w-5xl flex-wrap items-center justify-center gap-2">
          {reviewable && pendingCount > 0 ? (
            <BubbleButton
              tone="neutral"
              onClick={async () => {
                await bulkAccept({ data: { jobId: job.id, minConfidence: 0.9 } });
                refresh();
              }}
            >
              Accept all 90%+ confidence
            </BubbleButton>
          ) : null}
          {reviewable && job.status !== "complete" ? (
            <BubbleButton tone="flame" size="lg" disabled={busy} onClick={doFinalize}>
              Finalize to stats
            </BubbleButton>
          ) : null}
          {job.status === "complete" && job.game_id ? (
            <Link to="/review/$gameId" params={{ gameId: job.game_id }}>
              <BubbleButton tone="grape" size="lg">
                Open verified game review
              </BubbleButton>
            </Link>
          ) : null}
          {job.status !== "complete" && job.status !== "cancelled" ? (
            <BubbleButton
              tone="ghost"
              onClick={async () => {
                await cancelJob({ data: { jobId: job.id } });
                refresh();
              }}
            >
              Cancel job
            </BubbleButton>
          ) : null}
          <BubbleButton tone="danger" onClick={doDelete} disabled={busy}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete film
          </BubbleButton>
        </Panel>
      </div>
    </AppShell>
  );
}
