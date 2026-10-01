import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { statColor } from "@/lib/statColors";
import { Court, toLocal, type CourtZoom } from "@/components/court/Court";
import { BubbleButton, Label, Panel, Pill, StatTile } from "@/components/Bubbles";
import { trackActivity, trackActivityOnce, notifyProgressChanged } from "@/lib/activity";
import { fetchEvents, fetchGame, fetchPlayers } from "@/lib/data";
import { shotValue, zoneOf, ZONE_LABEL } from "@/lib/court";
import {
  cacheGet,
  cacheSet,
  enqueue,
  flushQueue,
  opId,
  pendingOps,
  uuid,
} from "@/lib/offline";
import type { GameEvent, Player } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtSplit, opponentLine, scoreFromEvents } from "@/lib/stats";
import { EventEditor } from "@/components/court/EventEditor";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/game/$gameId")({
  head: () => ({
    meta: [
      { title: "Live Game — CoachSide" },
      {
        name: "description",
        content:
          "Tap the court, tap the player, tap the stat. Courtside basketball stat entry that never leaves the court.",
      },
      { property: "og:title", content: "Live Game — CoachSide" },
      {
        property: "og:description",
        content: "Courtside basketball stat entry that never leaves the court.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveGamePage,
});

type Choice = { key: string; label: string; tone?: "grape" | "flame" | "neutral" | "ghost" };

type Step =
  | { kind: "idle" }
  | { kind: "player" }
  | { kind: "stat" }
  | { kind: "assist"; eventId: string }
  | { kind: "miss"; eventId: string }
  | { kind: "foul" }
  | { kind: "turnover" }
  | { kind: "reboundLoc"; playerId: string; eventId: string }
  | { kind: "oppStat" }
  | { kind: "oppMiss"; eventId: string }
  | { kind: "ft"; made: boolean };

const STAT_CHOICES: Choice[] = [
  { key: "MADE", label: "MAKE", tone: "flame" },
  { key: "MISS", label: "MISS", tone: "grape" },
  { key: "REBOUND", label: "Rebound", tone: "grape" },
  { key: "ASSIST", label: "Assist", tone: "grape" },
  { key: "STEAL", label: "Steal", tone: "grape" },
  { key: "TURNOVER", label: "Turnover", tone: "grape" },
  { key: "BLOCK", label: "Block", tone: "grape" },
  { key: "FOUL", label: "Foul", tone: "grape" },
];

function LiveGamePage() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => fetchGame(gameId) });
  const teamId = game.data?.team_id;
  const players = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => fetchPlayers(teamId as string),
    enabled: !!teamId,
  });

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [lineup, setLineup] = useState<string[]>([]);
  const [quarter, setQuarter] = useState(1);
  const [clock, setClock] = useState(480);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [subOut, setSubOut] = useState<string | null>(null);
  const [showBench, setShowBench] = useState(false);
  const [showOtherPlayers, setShowOtherPlayers] = useState(false);
  const [opponentExpanded, setOpponentExpanded] = useState(true);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [endPrompt, setEndPrompt] = useState(false);
  const [courtZoom, setCourtZoom] = useState<CourtZoom>("full");
  const [orientLocked, setOrientLocked] = useState(false);
  // Bench player who just got a stat while five are already on the floor.
  const [pendingSubIn, setPendingSubIn] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locPick, setLocPick] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setOpponentExpanded(!isMobile);
  }, [isMobile]);

  const toggleOrientationLock = useCallback(async () => {
    try {
      if (orientLocked) {
        screen.orientation.unlock();
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        setOrientLocked(false);
        toast.success("Orientation unlocked");
        return;
      }
      // iPadOS/Safari only allow orientation lock while fullscreen.
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      await (screen.orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock(
        "landscape",
      );
      setOrientLocked(true);
      toast.success("Screen locked to landscape");
    } catch {
      toast.error("This browser won't allow orientation lock — try rotating the iPad manually.");
    }
  }, [orientLocked]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setOrientLocked(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const stateKey = `game-state-${gameId}`;
  const eventsKey = `game-events-${gameId}`;

  /* ---------------- load (server first, local cache fallback) ---------------- */
  useEffect(() => {
    if (!game.data) return;
    let cancelled = false;
    (async () => {
      const cachedEvents = (await cacheGet<GameEvent[]>(eventsKey)) ?? [];
      const cachedState = await cacheGet<{
        lineup: string[];
        quarter: number;
        clock: number;
        courtZoom?: CourtZoom;
      }>(stateKey);
      let serverEvents: GameEvent[] = [];
      try {
        serverEvents = await fetchEvents(gameId);
      } catch {
        serverEvents = [];
      }
      const ops = await pendingOps();
      const deleted = new Set(
        ops.filter((o) => o.kind === "delete_event").map((o) => (o.payload as { id: string }).id),
      );
      const byId = new Map<string, GameEvent>();
      for (const e of [...serverEvents, ...cachedEvents]) byId.set(e.id, e);
      const merged = [...byId.values()]
        .filter((e) => !deleted.has(e.id))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (cancelled) return;
      setEvents(merged);
      const g = game.data;
      setLineup(cachedState?.lineup?.length ? cachedState.lineup : (g?.starting_five ?? []));
      setQuarter(cachedState?.quarter ?? g?.quarter ?? 1);
      setClock(cachedState?.clock ?? (g?.period_minutes ?? 8) * 60);
      setFinalized(g?.status === "final");
      // Full court is the default; keep whatever the coach picked this game.
      setCourtZoom(cachedState?.courtZoom ?? "full");
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, game.data?.id]);

  /* ---------------- persistence + sync ---------------- */
  useEffect(() => {
    if (!loaded) return;
    void cacheSet(eventsKey, events);
  }, [events, loaded, eventsKey]);

  useEffect(() => {
    if (!loaded) return;
    void cacheSet(stateKey, { lineup, quarter, clock, courtZoom });
  }, [lineup, quarter, clock, courtZoom, loaded, stateKey]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const sync = async () => {
      setOnline(navigator.onLine);
      setPending(await flushQueue());
    };
    void sync();
    const t = setInterval(sync, 5000);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  /* ---------------- clock ---------------- */
  const clockRef = useRef(clock);
  clockRef.current = clock;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setClock((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const roster = players.data ?? [];
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const onFloor = lineup.map((id) => byId.get(id)).filter(Boolean) as Player[];
  const bench = roster.filter((p) => p.active && !lineup.includes(p.id));

  // One canonical scoring rule (src/lib/stats.ts eventPoints) for everything.
  const { team: teamScore, opp: oppScore } = useMemo(() => scoreFromEvents(events), [events]);
  const opp = useMemo(() => opponentLine(events), [events]);
  const teamFouls = events.filter((e) => e.event_type === "FOUL" && e.quarter === quarter).length;
  const oppFouls = events.filter((e) => e.event_type === "OPP_FOUL" && e.quarter === quarter).length;
  const periods = game.data?.periods ?? 4;
  const isOvertime = quarter > periods;

  /* ---------------- event helpers ---------------- */
  const addEvent = useCallback(
    (partial: Partial<GameEvent> & { event_type: string }): GameEvent => {
      const e: GameEvent = {
        id: uuid(),
        game_id: gameId,
        quarter,
        clock_seconds: clockRef.current,
        player_id: partial.player_id ?? null,
        x: partial.x ?? null,
        y: partial.y ?? null,
        event_type: partial.event_type,
        result: partial.result ?? null,
        points: partial.points ?? 0,
        zone: partial.zone ?? null,
        current_lineup: lineup,
        related_event_id: partial.related_event_id ?? null,
        context: partial.context ?? {},
        created_at: new Date().toISOString(),
      };
      setEvents((prev) => [...prev, e]);
      void enqueue({ id: opId(), kind: "insert_event", payload: e }).then(() =>
        flushQueue().then(setPending),
      );
      return e;
    },
    [gameId, quarter, lineup],
  );

  const updateEvent = useCallback((id: string, patch: Partial<GameEvent>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    void enqueue({ id: opId(), kind: "update_event", payload: { id, ...patch } }).then(() =>
      flushQueue().then(setPending),
    );
  }, []);

  /* ---------------- self-correcting lineup ---------------- */
  const lineupRef = useRef(lineup);
  lineupRef.current = lineup;
  const logSub = useCallback(
    (out: string | null, inId: string, after: string[]) => {
      void enqueue({
        id: opId(),
        kind: "insert_sub",
        payload: {
          id: uuid(),
          game_id: gameId,
          quarter,
          clock_seconds: clockRef.current,
          player_out: out,
          player_in: inId,
          lineup_after: after,
          created_at: new Date().toISOString(),
        },
      }).then(() => flushQueue().then(setPending));
    },
    [gameId, quarter],
  );
  /** A US player who gets a stat is on the floor. Never discards the stat. */
  const ensureOnFloor = useCallback(
    (pid: string | null | undefined) => {
      if (!pid) return;
      const cur = lineupRef.current;
      if (cur.includes(pid)) return;
      if (cur.length < 5) {
        const after = [...cur, pid];
        lineupRef.current = after;
        setLineup(after);
        logSub(null, pid, after);
        return;
      }
      setPendingSubIn(pid);
    },
    [logSub],
  );
  const resolveSubOut = (outId: string) => {
    if (!pendingSubIn) return;
    const after = lineupRef.current.map((id) => (id === outId ? pendingSubIn : id));
    lineupRef.current = after;
    setLineup(after);
    logSub(outId, pendingSubIn, after);
    setPendingSubIn(null);
  };

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    void enqueue({ id: opId(), kind: "delete_event", payload: { id } }).then(() =>
      flushQueue().then(setPending),
    );
  }, []);

  // Mirror of the current step, updated synchronously so a finished sequence
  // can never commit again (double taps) or fall back into another prompt.
  const stepRef = useRef<Step>(step);
  stepRef.current = step;
  const goStep = (next: Step) => {
    stepRef.current = next;
    setShowOtherPlayers(false);
    setStep(next);
  };
  /** Finish an event sequence: clears every temporary selection, keeps events. */
  const reset = () => {
    stepRef.current = { kind: "idle" };
    setPoint(null);
    setStep({ kind: "idle" });
    setActivePlayer(null);
    setShowOtherPlayers(false);
  };
  const dismissCourtPrompt = () => {
    reset();
    setPendingSubIn(null);
  };

  /* ---------------- end of game ---------------- */
  const saveGameState = useCallback(
    async (status: "live" | "final") => {
      await enqueue({
        id: opId(),
        kind: "update_game",
        payload: {
          id: gameId,
          status,
          quarter,
          clock_seconds: clockRef.current,
          team_score: teamScore,
          opp_score: oppScore,
          ...(status === "final" ? { ended_at: new Date().toISOString() } : {}),
        },
      });
      try {
        setPending(await flushQueue());
      } catch {
        /* offline — the queue flushes when the connection returns */
      }
    },
    [gameId, quarter, teamScore, oppScore],
  );

  /** Persist final status locally + remotely (queued when offline). */
  const finalizeGame = useCallback(async () => {
    setRunning(false);
    setFinalized(true);
    await saveGameState("final");
    await cacheSet(`game-final-${gameId}`, {
      status: "final",
      team_score: teamScore,
      opp_score: oppScore,
      quarter,
      ended_at: new Date().toISOString(),
    });
    void queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    void queryClient.invalidateQueries({ queryKey: ["games"] });
    void queryClient.invalidateQueries({ queryKey: ["season-bundle"] });
  }, [saveGameState, queryClient, gameId, teamScore, oppScore, quarter]);

  /** Coach pressed End Game & Save → finalize then go straight to the review. */
  const [ending, setEnding] = useState(false);
  const finishGame = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    try {
      await finalizeGame();
      toast.success("Game saved — opening the review");
      navigate({ to: "/review/$gameId", params: { gameId } });
    } catch (e) {
      toast.error((e as Error).message || "Could not save the game");
      setEnding(false);
    }
  }, [ending, finalizeGame, navigate, gameId]);

  const overtimeMinutes = game.data?.overtime_minutes ?? 4;
  const startOvertime = useCallback(() => {
    setQuarter((q) => Math.max(periods, q) + 1);
    setClock(overtimeMinutes * 60);
    setRunning(false);
    setFinalized(false);
    setEndPrompt(false);
    void saveGameState("live");
    toast.success("Overtime started");
  }, [periods, overtimeMinutes, saveGameState]);

  // Time expired in the final period → auto-end and save. A tied game is not
  // finalized automatically: the coach picks overtime or ends it.
  useEffect(() => {
    if (!loaded || finalized) return;
    if (clock > 0) return;
    setRunning(false);
    if (quarter >= periods) {
      setEndPrompt(true);
      if (teamScore !== oppScore) {
        void finalizeGame().then(() => toast.success("Time expired — game saved as final"));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, loaded, finalized, quarter]);

  /* ---------------- court tap ---------------- */
  const onCourtPoint = (raw: { x: number; y: number }) => {
    // The surface reports full-court coordinates 0..1; stats are stored in
    // half-court units (1 = half line) so backcourt taps land in 1..2.
    const p = { x: Math.min(2, Math.max(0, raw.x * 2)), y: raw.y };
    if (editingId && locPick) {
      updateEvent(editingId, { x: p.x, y: p.y, zone: zoneOf(p.x, p.y) });
      setLocPick(false);
      return;
    }
    // A court tap while an optional follow-up is open ends the sequence (the
    // parent event is already saved). It never reopens "Who?"; the court is
    // idle and the next tap starts a fresh event.
    const currentStep = stepRef.current;
    if (currentStep.kind === "assist" || currentStep.kind === "miss" || currentStep.kind === "oppMiss") {
      reset();
      return;
    }
    if (currentStep.kind === "reboundLoc") {
      addEvent({
        event_type: "REBOUND",
        player_id: currentStep.playerId,
        x: p.x,
        y: p.y,
        zone: zoneOf(p.x, p.y),
        result: "OFF",
        related_event_id: currentStep.eventId,
      });
      reset();
      return;
    }
    // While a chooser is open, a tap on the exposed court edge dismisses it.
    // Choice controls stop propagation, and rebound-location mode still uses
    // the court tap above to save its requested location.
    if (currentStep.kind !== "idle") {
      reset();
      return;
    }
    setPoint(p);
    goStep({ kind: "player" });
  };

  /* ---------------- flow handlers ---------------- */
  const pickPlayer = (playerId: string) => {
    if (playerId === "__opp") {
      setActivePlayer(null);
      goStep({ kind: "oppStat" });
      return;
    }
    setActivePlayer(playerId);
    ensureOnFloor(playerId);
    goStep({ kind: "stat" });
  };

  const pickStat = (statKey: string) => {
    if (!point || !activePlayer) return;
    const zone = zoneOf(point.x, point.y);
    const value = shotValue(point.x, point.y);

    if (statKey === "MADE") {
      const e = addEvent({
        event_type: "MADE",
        player_id: activePlayer,
        x: point.x,
        y: point.y,
        zone,
        points: value,
        result: `${value}PT`,
      });
      goStep({ kind: "assist", eventId: e.id });
      return;
    }
    if (statKey === "MISS") {
      const e = addEvent({
        event_type: "MISS",
        player_id: activePlayer,
        x: point.x,
        y: point.y,
        zone,
        result: `${value}PT`,
      });
      goStep({ kind: "miss", eventId: e.id });
      return;
    }
    if (statKey === "FOUL") {
      goStep({ kind: "foul" });
      return;
    }
    if (statKey === "TURNOVER") {
      goStep({ kind: "turnover" });
      return;
    }
    if (statKey === "STEAL") {
      // One entry: the steal also implies an opponent turnover (stored as context).
      addEvent({
        event_type: "STEAL",
        player_id: activePlayer,
        x: point.x,
        y: point.y,
        zone,
        context: { forced_opponent_turnover: true },
      });
      reset();
      return;
    }
    addEvent({
      event_type: statKey,
      player_id: activePlayer,
      x: point.x,
      y: point.y,
      zone,
    });
    reset();
  };

  const playerChoiceLabel = (player: Player) => {
    const shortName = player.name.trim().split(/\s+/)[0] ?? "";
    return `#${player.jersey}${shortName ? ` · ${shortName}` : ""}`;
  };
  const playerChoices = (list: Player[], tone: Choice["tone"] = "grape") =>
    list.map((player) => ({ key: player.id, label: playerChoiceLabel(player), tone }));
  const revealOtherChoice: Choice = { key: "__other", label: "Other Player", tone: "neutral" };

  /* ---------------- overlay content per step ---------------- */
  let overlayTitle = "";
  let choices: Choice[] = [];
  let onPick: (key: string) => void = () => {};

  if (step.kind === "player") {
    overlayTitle = "Who?";
    choices = playerChoices(onFloor);
    if (bench.length) {
      choices.push(...(showOtherPlayers ? playerChoices(bench, "neutral") : [revealOtherChoice]));
    }
    choices.push({ key: "__opp", label: "Opponent", tone: "neutral" });
    choices.push({ key: "__cancel", label: "Cancel", tone: "ghost" });
    onPick = (k) => {
      if (k === "__other") return setShowOtherPlayers(true);
      if (k === "__cancel") return reset();
      pickPlayer(k);
    };
  } else if (step.kind === "stat") {
    const zone = point ? ZONE_LABEL[zoneOf(point.x, point.y)] : "";
    overlayTitle = zone ? `${zone} · what happened?` : "What happened?";
    choices = [...STAT_CHOICES, { key: "__cancel", label: "Cancel", tone: "ghost" }];
    onPick = (k) => (k === "__cancel" ? reset() : pickStat(k));
  } else if (step.kind === "ft") {
    overlayTitle = "Who shot it?";
    choices = playerChoices(onFloor);
    if (bench.length) {
      choices.push(...(showOtherPlayers ? playerChoices(bench, "neutral") : [revealOtherChoice]));
    }
    choices.push({ key: "__cancel", label: "Cancel", tone: "ghost" });
    onPick = (k) => {
      if (k === "__other") return setShowOtherPlayers(true);
      if (k === "__cancel") return reset();
      ensureOnFloor(k);
      addEvent({
        event_type: step.made ? "FT_MADE" : "FT_MISS",
        player_id: k,
        points: step.made ? 1 : 0,
        x: 0.404,
        y: 0.5,
        zone: "freethrow",
        result: "FT",
      });
      reset();
    };
  } else if (step.kind === "assist") {
    overlayTitle = "Assist?";
    const eligibleFloor = onFloor.filter((p) => p.id !== activePlayer);
    const eligibleBench = bench.filter((p) => p.id !== activePlayer);
    choices = playerChoices(eligibleFloor);
    if (eligibleBench.length) {
      choices.push(...(showOtherPlayers ? playerChoices(eligibleBench, "neutral") : [revealOtherChoice]));
    }
    choices.push({ key: "__unassisted", label: "Unassisted", tone: "neutral" });
    choices.push({ key: "__skip", label: "Skip", tone: "ghost" });
    onPick = (k) => {
      if (k === "__other") return setShowOtherPlayers(true);
      if (k !== "__skip" && k !== "__unassisted") {
        ensureOnFloor(k);
        addEvent({
          event_type: "ASSIST",
          player_id: k,
          related_event_id: step.eventId,
          x: point?.x ?? null,
          y: point?.y ?? null,
        });
      }
      reset();
    };
  } else if (step.kind === "miss") {
    overlayTitle = "Rebound?";
    choices = playerChoices(onFloor);
    if (bench.length) {
      choices.push(...(showOtherPlayers ? playerChoices(bench, "neutral") : [revealOtherChoice]));
    }
    choices.push({ key: "__opp", label: "Opponent rebound", tone: "grape" });
    choices.push({ key: "__oob", label: "Out of bounds", tone: "neutral" });
    choices.push({ key: "__skip", label: "Skip", tone: "ghost" });
    onPick = (k) => {
      if (k === "__other") return setShowOtherPlayers(true);
      if (k === "__opp") {
        addEvent({ event_type: "OPP_REBOUND", result: "DEF", related_event_id: step.eventId });
        reset();
      } else if (k === "__oob") {
        addEvent({
          event_type: "OUT_OF_BOUNDS",
          related_event_id: step.eventId,
          x: point?.x ?? null,
          y: point?.y ?? null,
        });
        reset();
      } else if (k === "__skip") {
        reset();
      } else {
        ensureOnFloor(k);
        setPoint(null);
        goStep({ kind: "reboundLoc", playerId: k, eventId: step.eventId });
      }
    };
  } else if (step.kind === "reboundLoc") {
    overlayTitle = `Tap the rebound spot for #${byId.get(step.playerId)?.jersey ?? ""}`;
    choices = [{ key: "__skip", label: "Skip location", tone: "ghost" }];
    onPick = () => {
      addEvent({
        event_type: "REBOUND",
        player_id: step.playerId,
        related_event_id: step.eventId,
        result: "OFF",
      });
      reset();
    };
  } else if (step.kind === "oppStat") {
    const zone = point ? ZONE_LABEL[zoneOf(point.x, point.y)] : "";
    const value = point ? shotValue(point.x, point.y) : 2;
    overlayTitle = `Opponent${zone ? ` · ${zone}` : ""} · what happened?`;
    choices = [
      { key: "MADE", label: `Make ${value}`, tone: "flame" },
      { key: "MISS", label: "Miss", tone: "grape" },
      { key: "TURNOVER", label: "Turnover", tone: "grape" },
      { key: "FOUL", label: "Foul", tone: "grape" },
      { key: "__cancel", label: "Cancel", tone: "ghost" },
    ];
    onPick = (k) => {
      if (k === "__cancel" || !point) return reset();
      const loc = { x: point.x, y: point.y, zone: zoneOf(point.x, point.y) };
      if (k === "MADE") {
        addEvent({ event_type: "OPP_MADE", ...loc, points: value, result: `${value}PT` });
        return reset();
      }
      if (k === "MISS") {
        const e = addEvent({ event_type: "OPP_MISS", ...loc, result: `${value}PT` });
        goStep({ kind: "oppMiss", eventId: e.id });
        return;
      }
      addEvent({ event_type: `OPP_${k}`, ...loc });
      reset();
    };
  } else if (step.kind === "oppMiss") {
    overlayTitle = "Rebound?";
    choices = [
      { key: "__oreb", label: "Opponent Off. Reb", tone: "grape" },
      ...playerChoices(onFloor),
    ];
    if (bench.length) {
      choices.push(...(showOtherPlayers ? playerChoices(bench, "neutral") : [revealOtherChoice]));
    }
    choices.push({ key: "__usreb", label: "US Def. Reb · team", tone: "neutral" });
    choices.push({ key: "__oob", label: "Out of bounds", tone: "neutral" });
    choices.push({ key: "__skip", label: "Skip", tone: "ghost" });
    onPick = (k) => {
      if (k === "__other") return setShowOtherPlayers(true);
      if (k === "__oreb") {
        addEvent({ event_type: "OPP_REBOUND", result: "OFF", related_event_id: step.eventId });
      } else if (k === "__oob") {
        addEvent({ event_type: "OUT_OF_BOUNDS", related_event_id: step.eventId });
      } else if (k === "__usreb") {
        addEvent({ event_type: "REBOUND", result: "DEF", related_event_id: step.eventId });
      } else if (k !== "__skip") {
        ensureOnFloor(k);
        addEvent({ event_type: "REBOUND", player_id: k, result: "DEF", related_event_id: step.eventId });
      }
      reset();
    };
  } else if (step.kind === "foul") {
    overlayTitle = "Foul type";
    choices = [
      { key: "SHOOTING", label: "Shooting", tone: "grape" },
      { key: "OFFENSIVE", label: "Offensive", tone: "grape" },
      { key: "DEFENSIVE", label: "Defensive", tone: "grape" },
      { key: "LOOSE BALL", label: "Loose ball", tone: "grape" },
      { key: "OTHER", label: "Other", tone: "grape" },
      { key: "__skip", label: "Skip", tone: "ghost" },
    ];
    onPick = (k) => {
      addEvent({
        event_type: "FOUL",
        player_id: activePlayer,
        x: point?.x ?? null,
        y: point?.y ?? null,
        zone: point ? zoneOf(point.x, point.y) : null,
        result: k === "__skip" ? null : k,
      });
      reset();
    };
  } else if (step.kind === "turnover") {
    overlayTitle = "Turnover type";
    choices = [
      { key: "BAD PASS", label: "Bad pass", tone: "grape" },
      { key: "TRAVEL", label: "Travel", tone: "grape" },
      { key: "OFFENSIVE FOUL", label: "Offensive foul", tone: "grape" },
      { key: "LOST BALL", label: "Lost ball", tone: "grape" },
      { key: "OTHER", label: "Other", tone: "grape" },
      { key: "__skip", label: "Skip", tone: "ghost" },
    ];
    onPick = (k) => {
      addEvent({
        event_type: "TURNOVER",
        player_id: activePlayer,
        x: point?.x ?? null,
        y: point?.y ?? null,
        zone: point ? zoneOf(point.x, point.y) : null,
        result: k === "__skip" ? null : k,
      });
      reset();
    };
  }

  // Guard: a pick only applies to the step it was rendered for.
  {
    const renderedStep = step;
    const inner = onPick;
    onPick = (k) => {
      if (stepRef.current !== renderedStep) return;
      inner(k);
    };
  }

  // Stat coordinates stay in half-court space; the court surface draws the one
  // full court, so half-court points are mapped into the visible slice.
  const halfToLocal = (p: { x: number; y: number }) =>
    toLocal(courtZoom, { x: p.x * 0.5, y: p.y });

  /* ---------------- substitutions ---------------- */
  const doSub = (inId: string) => {
    if (!subOut) return;
    const after = lineup.map((id) => (id === subOut ? inId : id));
    lineupRef.current = after;
    setLineup(after);
    logSub(subOut, inId, after);
    setSubOut(null);
    setShowBench(false);
  };

  const lastEvent = events[events.length - 1];
  const editingEvent = editingId ? events.find((e) => e.id === editingId) ?? null : null;
  const jersey = (e: GameEvent) =>
    e.player_id
      ? `#${byId.get(e.player_id)?.jersey ?? "?"}`
      : String(e.event_type).startsWith("OPP_")
        ? "OPP"
        : "TEAM";

  return (
    <div className="min-h-screen p-2 sm:p-3">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-2">
        {/* SCORE + PERIOD + FOULS — compact and sticky */}
        <Panel className="sticky top-1 z-40 border-grape/50 bg-background/95 p-1.5 backdrop-blur">
          <div className="grid grid-cols-5 gap-1.5">
            <StatTile label={game.data ? "Us" : "Team"} value={teamScore} tone="grape" className="px-1.5 py-1.5 [&>div:first-child]:text-[10px] [&>div:nth-child(2)]:text-2xl" />
            <StatTile label="Opp" value={oppScore} tone="flame" className="px-1.5 py-1.5 [&>div:first-child]:text-[10px] [&>div:nth-child(2)]:text-2xl" />
            <StatTile label="Period" value={isOvertime ? `OT${quarter - periods}` : `Q${quarter}`} className="px-1 py-1.5 [&>div:first-child]:text-[10px] [&>div:nth-child(2)]:text-lg" />
            <StatTile label="Team fouls" value={teamFouls} className="px-1 py-1.5 [&>div:first-child]:text-[9px] [&>div:nth-child(2)]:text-lg" />
            <StatTile label="Opp fouls" value={oppFouls} className="px-1 py-1.5 [&>div:first-child]:text-[9px] [&>div:nth-child(2)]:text-lg" />
          </div>
        </Panel>

        <Panel className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 p-1.5 sm:flex sm:flex-wrap">
          <div className="flex min-w-0 flex-wrap gap-2">
            <BubbleButton size="sm" tone="neutral" onClick={() => navigate({ to: "/dashboard" })}>⌂ Home</BubbleButton>
            <BubbleButton size="sm" tone="grape" onClick={() => { void trackActivity("board_used_in_game", { entityId: gameId }); navigate({ to: "/board" }); }}>✎ Timeout Board</BubbleButton>
          </div>
          <div className="flex shrink-0 gap-1.5 sm:ml-auto">
            <BubbleButton size="sm" tone={courtZoom === "left" ? "grape" : "neutral"} onClick={() => setCourtZoom("left")}>Half</BubbleButton>
            <BubbleButton size="sm" tone={courtZoom === "full" ? "grape" : "neutral"} onClick={() => setCourtZoom("full")}>Full</BubbleButton>
            <BubbleButton size="sm" tone={orientLocked ? "grape" : "neutral"} onClick={() => void toggleOrientationLock()}>
              {orientLocked ? "🔒" : "⟳"}
              <span className="sr-only sm:not-sr-only">Landscape</span>
            </BubbleButton>
          </div>
        </Panel>

        <div className="grid min-w-0 gap-1.5 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* COURT — always visible, never replaced */}
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <Court
              variant="full"
              zoom={courtZoom}
              className="mx-auto w-full"
              style={courtZoom === "full" ? { maxWidth: "100%" } : { maxWidth: "min(100%, calc((100dvh - 5rem) * 0.94))" }}
              onCourtPoint={onCourtPoint}
              overlay={
                <>
                  {point ? (
                    <div
                      className="pointer-events-none absolute z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-flame bg-flame/40 bubble-pop"
                      style={{ left: `${halfToLocal(point).x * 100}%`, top: `${halfToLocal(point).y * 100}%` }}
                    />
                  ) : null}
                  {(step.kind !== "idle" && step.kind !== "reboundLoc") || pendingSubIn ? (
                    <div
                      className="absolute inset-0 z-[15] rounded-[1.25rem] bg-background/15"
                      aria-label="Dismiss current prompt"
                      onPointerDown={(pointerEvent) => {
                        pointerEvent.stopPropagation();
                        dismissCourtPrompt();
                      }}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        dismissCourtPrompt();
                      }}
                    />
                  ) : null}
                  {step.kind !== "idle" && step.kind !== "reboundLoc" ? (
                    <div
                      className="absolute bottom-2 left-1/2 z-20 max-h-[calc(100%_-_1rem)] w-[calc(100%_-_1rem)] max-w-[540px] -translate-x-1/2 overflow-y-auto overscroll-contain bubble-pop sm:w-[min(68%,540px)]"
                      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                    >
                      <div className="rounded-2xl border border-grape/60 bg-background/95 p-1 shadow-2xl shadow-black/60 backdrop-blur">
                        <div className="mb-1 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1">
                          <span aria-hidden />
                          <Label className="justify-self-center truncate bg-grape/25 px-2 text-xs text-foreground">{overlayTitle}</Label>
                          <BubbleButton size="sm" tone="ghost" className="h-11 min-h-11 w-11 px-0 text-lg" aria-label="Cancel current prompt" onClick={dismissCourtPrompt}>×</BubbleButton>
                        </div>
                        <div className={cn("grid gap-1", ["player", "ft", "assist", "miss", "oppMiss"].includes(step.kind) ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}>
                          {choices.map((choice) => {
                            const isPlayerChoice = !choice.key.startsWith("__") && ["player", "ft", "assist", "miss", "oppMiss"].includes(step.kind);
                            const primary = choice.key === "MADE" || choice.key === "MISS";
                            return (
                              <BubbleButton
                                key={choice.key}
                                size="sm"
                                tone={choice.tone ?? "neutral"}
                                className={cn("min-h-11 min-w-0 px-1.5 text-[11px] sm:px-2 sm:text-xs", primary && "text-xs sm:text-sm", isPlayerChoice && "whitespace-nowrap", choice.key === "__cancel" && "hidden")}
                                onClick={() => onPick(choice.key)}
                              >
                                {choice.label}
                              </BubbleButton>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {step.kind === "reboundLoc" ? (
                    <div className="pointer-events-none absolute inset-x-1 top-1 z-30 flex justify-center bubble-pop">
                      <div className="grid max-w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-2xl border border-flame/70 bg-background/95 p-1 shadow-2xl shadow-black/60 backdrop-blur">
                        <Label className="min-w-0 truncate bg-flame/25 px-2 text-[11px] text-foreground">{overlayTitle}</Label>
                        <BubbleButton
                          size="sm"
                          tone="ghost"
                          className="pointer-events-auto min-h-11 px-2 text-[11px]"
                          onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                          onClick={() => onPick("__skip")}
                        >
                          Skip location
                        </BubbleButton>
                        <BubbleButton
                          size="sm"
                          tone="ghost"
                          className="pointer-events-auto h-11 min-h-11 w-11 px-0 text-lg"
                          aria-label="Cancel rebound location"
                          onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                          onClick={reset}
                        >
                          ×
                        </BubbleButton>
                      </div>
                    </div>
                  ) : null}
                  {pendingSubIn ? (
                    <div className="absolute bottom-2 left-1/2 z-30 max-h-[calc(100%_-_1rem)] w-[calc(100%_-_1rem)] max-w-[560px] -translate-x-1/2 overflow-y-auto overscroll-contain bubble-pop" onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}>
                      <div className="rounded-2xl border border-flame/70 bg-background/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur">
                        <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
                          <Label className="truncate bg-flame/25 px-2 text-xs text-foreground">
                            {playerChoiceLabel(byId.get(pendingSubIn) ?? { id: "", team_id: "", jersey: "?", name: "Player", position: null, active: true })} in · who came out?
                          </Label>
                          <BubbleButton size="sm" tone="ghost" className="h-11 min-h-11 w-11 px-0 text-lg" aria-label="Cancel lineup correction" onClick={dismissCourtPrompt}>×</BubbleButton>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {onFloor.map((p) => (
                            <BubbleButton key={p.id} size="sm" tone="grape" className="min-h-11 min-w-0 px-1.5 text-[11px] sm:px-2 sm:text-xs" onClick={() => resolveSubOut(p.id)}>
                              {playerChoiceLabel(p)}
                            </BubbleButton>
                          ))}
                          <BubbleButton size="sm" tone="ghost" className="min-h-11 px-2 text-xs" onClick={() => setPendingSubIn(null)}>Keep lineup</BubbleButton>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {locPick ? (
                    <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-full border border-flame bg-background/90 px-4 py-2 text-sm font-black">Tap the new spot for this event</div>
                  ) : null}
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    {events.filter((e) => e.x != null).slice(-60).map((e) => {
                      const hollow = String(e.event_type).endsWith("MISS");
                      const color = statColor(String(e.event_type));
                      return <circle key={e.id} cx={`${halfToLocal({ x: e.x as number, y: e.y as number }).x * 100}%`} cy={`${halfToLocal({ x: e.x as number, y: e.y as number }).y * 100}%`} r={5} fill={hollow ? "transparent" : color} stroke={color} strokeWidth={2} opacity={0.8} />;
                    })}
                  </svg>
                </>
              }
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            {/* OUR FREE THROWS — player list appears only after a result is chosen */}
            <Panel className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 p-1.5">
              <Label className="px-2">Our FT</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <BubbleButton size="sm" tone="flame" className="min-h-11" onClick={() => goStep({ kind: "ft", made: true })}>FT Made</BubbleButton>
                <BubbleButton size="sm" tone="grape" className="min-h-11" onClick={() => goStep({ kind: "ft", made: false })}>FT Miss</BubbleButton>
              </div>
            </Panel>

            {/* OPPONENT */}
            <Panel className="flex flex-col gap-1.5 p-1.5">
              <BubbleButton
                size="sm"
                tone="neutral"
                className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl px-3 text-left sm:pointer-events-none"
                onClick={() => setOpponentExpanded((v) => !v)}
                aria-expanded={opponentExpanded}
              >
                <span className="min-w-0 truncate text-sm font-black text-foreground">Opponent</span>
                <span className="shrink-0 text-xs font-bold text-muted-foreground">
                  FG {fmtSplit(opp.fg)} · TO {opp.to} · OREB {opp.oreb}<span className="sm:hidden"> · {opponentExpanded ? "Hide" : "Track"}</span>
                </span>
              </BubbleButton>
              {opponentExpanded ? (
                <div className="flex flex-col gap-1.5 bubble-pop">
                  <div>
                    <Label>Scoring</Label>
                    <div className="mt-1 grid grid-cols-4 gap-1.5">
                      {[2, 3].map((n) => (
                        <BubbleButton key={n} size="sm" tone="flame" className="min-h-11 px-2" onClick={() => addEvent({ event_type: "OPP_MADE", points: n, result: `${n}PT`, context: { shot_value: n } })}>+{n}</BubbleButton>
                      ))}
                      <BubbleButton size="sm" tone="flame" className="min-h-11 px-1.5 text-xs" onClick={() => addEvent({ event_type: "OPP_FT_MADE", points: 1, result: "FT" })}>FT Made</BubbleButton>
                      <BubbleButton size="sm" tone="grape" className="min-h-11 px-1.5 text-xs" onClick={() => addEvent({ event_type: "OPP_FT_MISS", result: "FT" })}>FT Miss</BubbleButton>
                    </div>
                  </div>
                  <div>
                    <Label>Possession</Label>
                    <div className="mt-1 grid grid-cols-4 gap-1.5">
                      <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_REBOUND", result: "OFF" })}>Off. Reb</BubbleButton>
                      <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_REBOUND", result: "DEF" })}>Def. Reb</BubbleButton>
                      <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_TURNOVER" })}>Turnover</BubbleButton>
                      <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_FOUL" })}>Opp Foul</BubbleButton>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-border/70 bg-surface-2/60 px-2 py-1 text-center text-[11px] font-bold text-muted-foreground">
                FG {fmtSplit(opp.fg)} · 3PT {fmtSplit(opp.three)} · FT {fmtSplit(opp.ft)} · OREB {opp.oreb} · TO {opp.to} · Fouls {oppFouls}
              </div>
            </Panel>

            {/* LINEUP */}
            <Panel className="flex flex-col gap-1.5 p-1.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <Label>On the floor</Label>
                <BubbleButton size="md" tone={showBench ? "grape" : "neutral"} className="min-h-12" onClick={() => { setShowBench((value) => !value); setSubOut(null); }}>Sub</BubbleButton>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {onFloor.map((p) => (
                  <BubbleButton key={p.id} size="sm" tone={subOut === p.id ? "flame" : "grape"} className="min-h-11 min-w-0 truncate px-2 text-xs" onClick={() => showBench && setSubOut(p.id)}>
                    {playerChoiceLabel(p)}
                  </BubbleButton>
                ))}
              </div>
              {showBench ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-2/60 p-2">
                  <Label>{subOut ? "Who came in?" : "Who came out?"}</Label>
                  {subOut ? (
                    <div className="grid grid-cols-2 gap-2">
                      {bench.map((p) => <BubbleButton key={p.id} size="md" tone="grape" className="min-h-12" onClick={() => doSub(p.id)}>{playerChoiceLabel(p)}</BubbleButton>)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Panel>

            {/* EVENT / REVIEW / UNDO */}
            {eventsExpanded || editingEvent ? <Panel className="flex flex-col gap-1.5 p-1.5">
              {editingEvent ? (
                <EventEditor
                  key={editingEvent.id}
                  event={editingEvent}
                  roster={roster}
                  picking={locPick}
                  onPickLocation={() => setLocPick((v) => !v)}
                  onSave={(patch) => { updateEvent(editingEvent.id, patch); if (patch.player_id) ensureOnFloor(patch.player_id); setEditingId(null); setLocPick(false); }}
                  onDelete={() => { deleteEvent(editingEvent.id); setEditingId(null); setLocPick(false); }}
                  onClose={() => { setEditingId(null); setLocPick(false); }}
                />
              ) : null}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                <Label>Events · tap one to edit</Label>
                <BubbleButton size="sm" tone="ghost" className="min-h-11" onClick={() => setEventsExpanded(false)}>Close</BubbleButton>
              </div>
              <div className="flex max-h-[30vh] flex-col gap-1.5 overflow-y-auto bubble-pop">
                {[...events].reverse().slice(0, 40).map((event) => (
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setEditingId(event.id); setLocPick(false); }}
                    onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter" || keyEvent.key === " ") { setEditingId(event.id); setLocPick(false); } }}
                    className={cn("grid min-h-11 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border bg-surface-2/70 px-2 py-1.5", editingId === event.id ? "border-flame" : "border-border")}
                  >
                    <Pill tone="muted">Q{event.quarter}</Pill>
                    <span className="rounded-full bg-grape/25 px-2 py-0.5 text-xs font-black">{jersey(event)}</span>
                    <span className="min-w-0 truncate rounded-full bg-surface/70 px-2 py-0.5 text-xs font-bold">{event.event_type}{event.result ? ` · ${event.result}` : ""}</span>
                    <BubbleButton size="sm" tone="ghost" aria-label="Delete event" onClick={(clickEvent) => { clickEvent.stopPropagation(); deleteEvent(event.id); }}>✕</BubbleButton>
                  </div>
                ))}
                {events.length === 0 ? <Pill tone="muted">Tap the court to record your first event</Pill> : null}
              </div>
            </Panel> : null}

            {/* GAME STATUS */}
            <Panel className={cn("flex flex-col gap-1.5 p-1.5", endPrompt && "border-flame/60")}>
              <div className="flex flex-wrap items-center gap-2">
                <Label>Game status</Label>
                <Pill tone={finalized ? "muted" : "grape"}>{finalized ? "Final — saved" : "In progress"}</Pill>
                <Pill tone={online ? (pending ? "flame" : "grape") : "flame"}>{online ? (pending ? `Syncing ${pending}` : "Synced") : `Offline · ${pending} queued`}</Pill>
                {isOvertime ? <Pill tone="flame">OT{quarter - periods > 1 ? quarter - periods : ""}</Pill> : null}
              </div>
              {endPrompt ? <Pill tone="flame">{teamScore === oppScore ? "Time expired — tied. Start overtime or end the game." : "Time expired — saved as final. Open the review or add overtime."}</Pill> : null}
              <div className="grid grid-cols-3 gap-1.5">
                <BubbleButton
                  size="sm"
                  tone="neutral"
                  className="min-h-11"
                  disabled={quarter >= periods}
                  onClick={() => {
                    setQuarter((q) => q + 1);
                    setClock((game.data?.period_minutes ?? 8) * 60);
                    setRunning(false);
                  }}
                >
                  Next Period
                </BubbleButton>
                <BubbleButton tone="neutral" size="sm" className="min-h-11" disabled={!lastEvent} onClick={() => lastEvent && deleteEvent(lastEvent.id)}>↺ Undo Last</BubbleButton>
                <BubbleButton size="sm" tone="neutral" className="min-h-11" onClick={() => navigate({ to: "/review/$gameId", params: { gameId } })}>Review</BubbleButton>
                <BubbleButton size="sm" tone="grape" className="min-h-11" disabled={quarter < periods} onClick={startOvertime}>+ Overtime</BubbleButton>
                <BubbleButton size="sm" tone="ghost" className="col-span-2 min-h-11" onClick={() => setEventsExpanded((value) => !value)}>Recent events ({events.length})</BubbleButton>
                <BubbleButton size="lg" tone="danger" className="col-span-3 min-h-14 text-base" disabled={ending} onClick={() => void finishGame()}>
                  {ending ? "Saving…" : finalized ? "Save & open review" : "End Game & Save"}
                </BubbleButton>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
