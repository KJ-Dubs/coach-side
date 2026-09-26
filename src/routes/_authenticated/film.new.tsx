import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  Field,
  InfoPanel,
  Label,
  Panel,
  Pill,
  SelectInput,
  TextInput,
} from "@/components/Bubbles";
import { createFilmJob, getFilmUploadUrl, markFilmUploaded } from "@/lib/film.functions";
import { createGame, fetchGames, fetchPlayers } from "@/lib/data";
import { useCurrentTeam } from "@/lib/teamContext";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/film/new")({
  head: () => ({
    meta: [
      { title: "New Film Job — CoachSide" },
      { name: "description", content: "Upload or link a game video and set up film review." },
      { property: "og:title", content: "New Film Job — CoachSide" },
      { property: "og:description", content: "Upload or link a game video and set up film review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewFilmJobPage,
});

const JERSEY_COLORS = ["White", "Black", "Purple", "Navy", "Red", "Blue", "Green", "Gold", "Orange", "Gray"];

function NewFilmJobPage() {
  const navigate = useNavigate();
  const { team, teamId, loading } = useCurrentTeam();
  const createJob = useServerFn(createFilmJob);
  const getUpload = useServerFn(getFilmUploadUrl);
  const markUploaded = useServerFn(markFilmUploaded);

  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState<"upload" | "link">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [gameId, setGameId] = useState<string>("");
  const [newOpponent, setNewOpponent] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ourColor, setOurColor] = useState("White");
  const [oppColor, setOppColor] = useState("Black");
  const [attack, setAttack] = useState<"left" | "right">("right");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: games } = useQuery({
    queryKey: ["games"],
    queryFn: fetchGames,
    enabled: Boolean(teamId),
  });
  const { data: players } = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => fetchPlayers(teamId!),
    enabled: Boolean(teamId),
  });
  const teamGames = useMemo(
    () => (games ?? []).filter((g) => g.team_id === teamId),
    [games, teamId],
  );
  const roster = useMemo(() => (players ?? []).filter((p) => p.active), [players]);

  const togglePlayer = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canNext =
    step === 0
      ? sourceType === "upload"
        ? Boolean(file)
        : /^https?:\/\/.+/.test(sourceUrl)
      : step === 1
        ? Boolean(gameId || newOpponent.trim())
        : step === 2
          ? selected.size > 0
          : step === 4
            ? consent
            : true;

  const start = async () => {
    if (!teamId || busy) return;
    setBusy(true);
    setError(null);
    try {
      let gid = gameId || null;
      if (!gid) {
        const g = await createGame({
          teamId,
          opponent: newOpponent.trim(),
          gameDate: new Date().toISOString().slice(0, 10),
          startingFive: [],
        });
        gid = g.id;
      }
      const rosterSnapshot = roster
        .filter((p) => selected.has(p.id))
        .map((p: Player) => ({ jersey: p.jersey, player_id: p.id, name: p.name }));
      const job = await createJob({
        data: {
          teamId,
          gameId: gid,
          sourceType,
          sourceUrl: sourceType === "link" ? sourceUrl : null,
          ourColor,
          oppColor,
          attackBasketFirstHalf: attack,
          periods: team?.default_periods ?? 4,
          roster: rosterSnapshot,
          consent: true,
        },
      });
      if (sourceType === "upload" && file) {
        const { path, token } = await getUpload({ data: { jobId: job.id, teamId } });
        const { error: upErr } = await supabase.storage
          .from("game-film")
          .uploadToSignedUrl(path, token, file, { contentType: file.type || "video/mp4" });
        if (upErr) throw new Error(upErr.message);
        await markUploaded({ data: { jobId: job.id, path } });
      }
      navigate({ to: "/film/$jobId", params: { jobId: job.id } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const steps = ["Video", "Game", "Roster", "Colors", "Consent"];

  return (
    <AppShell title="New Film Job" subtitle={team ? `${team.name} · ${steps[step]}` : "Set up film review"}>
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-1.5">
          {steps.map((s, i) => (
            <Pill key={s} tone={i === step ? "grape" : i < step ? "success" : "muted"}>
              {i + 1}. {s}
            </Pill>
          ))}
        </div>

        <Panel className="flex w-full flex-col gap-4">
          {step === 0 ? (
            <>
              <Label>Game video</Label>
              <div className="flex flex-wrap gap-2">
                <BubbleButton tone={sourceType === "upload" ? "grape" : "neutral"} onClick={() => setSourceType("upload")}>
                  Upload file
                </BubbleButton>
                <BubbleButton tone={sourceType === "link" ? "grape" : "neutral"} onClick={() => setSourceType("link")}>
                  Link a video
                </BubbleButton>
              </div>
              {sourceType === "upload" ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <BubbleButton tone="neutral" onClick={() => fileRef.current?.click()}>
                    {file ? file.name : "Choose video file"}
                  </BubbleButton>
                  <InfoPanel tone="neutral">
                    Video stays private to your coaching staff. Files up to 1 GB; longer games may
                    need a link instead.
                  </InfoPanel>
                </>
              ) : (
                <Field label="Video URL">
                  <TextInput
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://… (YouTube, Hudl, Drive)"
                  />
                </Field>
              )}
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Label>Which game is this?</Label>
              <Field label="Existing game">
                <SelectInput value={gameId} onChange={(e) => setGameId(e.target.value)}>
                  <option value="">— Create a new game —</option>
                  {teamGames.map((g) => (
                    <option key={g.id} value={g.id}>
                      vs {g.opponent} · {g.game_date}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              {!gameId ? (
                <Field label="Opponent">
                  <TextInput value={newOpponent} onChange={(e) => setNewOpponent(e.target.value)} placeholder="Opponent name" />
                </Field>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Label>Confirm the roster in this game</Label>
              <div className="flex flex-wrap gap-2">
                {roster.map((p) => (
                  <BubbleButton
                    key={p.id}
                    size="sm"
                    tone={selected.has(p.id) ? "grape" : "neutral"}
                    onClick={() => togglePlayer(p.id)}
                  >
                    #{p.jersey} {p.name}
                  </BubbleButton>
                ))}
              </div>
              <InfoPanel tone="neutral">
                Jersey numbers here are what the analysis worker uses to identify players — and what
                you pick from during manual tagging.
              </InfoPanel>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Our jersey color">
                  <SelectInput value={ourColor} onChange={(e) => setOurColor(e.target.value)}>
                    {JERSEY_COLORS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Opponent jersey color">
                  <SelectInput value={oppColor} onChange={(e) => setOppColor(e.target.value)}>
                    {JERSEY_COLORS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <Field label="Basket we attack in the 1st half">
                <SelectInput value={attack} onChange={(e) => setAttack(e.target.value as "left" | "right")}>
                  <option value="right">Right basket</option>
                  <option value="left">Left basket</option>
                </SelectInput>
              </Field>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Label>Consent & privacy</Label>
              <InfoPanel tone="grape">
                Game film shows minors. Only upload video you have the right to record and share
                with your coaching staff, and follow your program's consent policies. Film is
                private to your team's coaches, never public, and you can delete it at any time.
                Videos are kept for 180 days unless you delete them sooner.
              </InfoPanel>
              <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-surface-2/60 p-3 text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[var(--grape)]"
                />
                I confirm I have the right to upload this video and that required consents are in
                place.
              </label>
            </>
          ) : null}

          {error ? <InfoPanel tone="danger">{error}</InfoPanel> : null}

          <div className="flex flex-wrap justify-between gap-2">
            <BubbleButton tone="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </BubbleButton>
            {step < steps.length - 1 ? (
              <BubbleButton tone="grape" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Continue
              </BubbleButton>
            ) : (
              <BubbleButton tone="flame" disabled={!canNext || busy} onClick={start}>
                {busy ? "Starting…" : sourceType === "upload" ? "Upload & start" : "Start film job"}
              </BubbleButton>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
