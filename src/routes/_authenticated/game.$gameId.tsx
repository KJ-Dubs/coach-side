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
  drainQueue,
  opId,
  pendingOps,
  uuid,
} from "@/lib/offline";
import type { GameEvent, Player } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtSplit, opponentLine, scoreFromEvents } from "@/lib/stats";
import { EventEditor } from "@/components/court/EventEditor";
import { TileEditor, EndGameCheck, type TileKind } from "@/components/game/LiveTileEditor";
import { supabase } from "@/integrations/supabase/client";
import { bonusLabel, countFouls, diffTracking, foulWindow, normalizeHistory, normalizeRules, normalizeTracking, type RulesConfig, type TrackingConfig } from "@/lib/gameConfig";
import { ClockEditor, TrackingSettingsSheet } from "@/components/game/TrackingSettingsSheet";
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
  | { kind: "ft"; made: boolean }
  | { kind: "quick"; value: 2 | 3 };

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
  const [tileEdit, setTileEdit] = useState<TileKind | null>(null);
  const [endCheck, setEndCheck] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  const tracking = useMemo(() => normalizeTracking(game.data?.stat_tracking_config), [game.data?.stat_tracking_config]);
  const rules = useMemo(() => normalizeRules(game.data?.rules_config), [game.data?.rules_config]);
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
    if (!running || !tracking.clock) return;
    const t = setInterval(() => setClock((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [running, tracking.clock]);
  // Event clock values are only meaningful while the clock is tracked;
  // otherwise store the 0 sentinel rather than a frozen fake time.
  const trackClockRef = useRef(tracking.clock);
  trackClockRef.current = tracking.clock;
  const eventClock = () => (trackClockRef.current ? clockRef.current : 0);
  const [clockEdit, setClockEdit] = useState(false);

  const roster = players.data ?? [];
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const byIdRef = useRef(byId);
  byIdRef.current = byId;
  const onFloor = lineup.map((id) => byId.get(id)).filter(Boolean) as Player[];
  const bench = roster.filter((p) => p.active && !lineup.includes(p.id));

  // One canonical scoring rule (src/lib/stats.ts eventPoints) for everything.
  const { team: teamScore, opp: oppScore } = useMemo(() => scoreFromEvents(events), [events]);
  const opp = useMemo(() => opponentLine(events), [events]);
  const scoreRef = useRef({ teamScore, oppScore });
  scoreRef.current = { teamScore, oppScore };
  const periods = game.data?.periods ?? 4;
  // Per-quarter or per-half window; foul events are never deleted on reset.
  const inFoulWindow = useMemo(() => foulWindow(rules.bonus, quarter, periods), [rules.bonus, quarter, periods]);
  const teamFouls = countFouls(events, "FOUL", inFoulWindow);
  const oppFouls = countFouls(events, "OPP_FOUL", inFoulWindow);
  const teamBonus = bonusLabel(rules.bonus, teamFouls);
  const oppBonus = bonusLabel(rules.bonus, oppFouls);
  const playerFouls = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) if (e.event_type === "FOUL" && e.player_id) m.set(e.player_id, (m.get(e.player_id) ?? 0) + 1);
    return m;
  }, [events]);
  const fouledOut = (pid: string) =>
    tracking.fouls && tracking.players && rules.foulLimit != null && (playerFouls.get(pid) ?? 0) >= rules.foulLimit;
  const timeoutsUsed = (kind: "FULL" | "30") => events.filter((e) => e.event_type === "TIMEOUT" && e.result === kind).length;
  const timeoutsLeftFull = Math.max(0, rules.timeoutsFull - timeoutsUsed("FULL"));
  const timeoutsLeft30 = Math.max(0, rules.timeouts30 - timeoutsUsed("30"));
  const isOvertime = quarter > periods;

  /* ---------------- event helpers ---------------- */
  const lastAddRef = useRef<{ sig: string; at: number; event: GameEvent } | null>(null);
  // Interaction lock: taps before this timestamp are ignored, so the touch
  // that opened a prompt can never also press a button mounted under it.
  const courtPressRef = useRef(false);
  // Set when the court gesture ends; cleared by the next real pointerdown.
  // Only a synthetic click from the SAME gesture can arrive while it is set.
  const swallowClickRef = useRef(false);
  useEffect(() => {
    const clear = () => { swallowClickRef.current = false; };
    window.addEventListener("pointerdown", clear, true);
    return () => window.removeEventListener("pointerdown", clear, true);
  }, []);
  const sameGesture = () => courtPressRef.current || swallowClickRef.current;
  const addEvent = useCallback(
    (partial: Partial<GameEvent> & { event_type: string }): GameEvent => {
      // Double-tap guard: an identical event within one interaction window is
      // the same physical action registering twice — reuse the first one.
      const sig = [partial.event_type, partial.player_id ?? "", partial.result ?? "", partial.points ?? 0, partial.x ?? "", partial.y ?? "", partial.related_event_id ?? ""].join("|");
      const now = Date.now();
      const last = lastAddRef.current;
      if (last && last.sig === sig && now - last.at < 400) return last.event;
      const e: GameEvent = {
        id: uuid(),
        game_id: gameId,
        quarter,
        clock_seconds: eventClock(),
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
      setEvents((prev) => {
        if (e.event_type === "FOUL" && e.player_id && rules.foulLimit != null && tracking.players) {
          const n = prev.filter((x) => x.event_type === "FOUL" && x.player_id === e.player_id).length + 1;
          if (n === rules.foulLimit) {
            const pl = byIdRef.current.get(e.player_id);
            setTimeout(() => toast.warning(`#${pl?.jersey ?? "?"} has fouled out (${n} fouls)`, { duration: 6000 }), 0);
          }
        }
        return [...prev, e];
      });
      void enqueue({ id: opId(), kind: "insert_event", payload: e }).then(() =>
        flushQueue().then(setPending),
      );
      lastAddRef.current = { sig, at: now, event: e };
      return e;
    },
    [gameId, quarter, lineup, rules.foulLimit, tracking.players],
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
          clock_seconds: eventClock(),
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
          team_score: scoreRef.current.teamScore,
          opp_score: scoreRef.current.oppScore,
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
    // Make sure the last tapped stat (often the game-winner) is persisted
    // before the game is marked final and the review opens.
    try {
      setPending(await drainQueue());
    } catch {
      /* offline — queued events stay in IndexedDB and still show in Review */
    }
    await saveGameState("final");
    await cacheSet(`game-final-${gameId}`, {
      status: "final",
      team_score: scoreRef.current.teamScore,
      opp_score: scoreRef.current.oppScore,
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
    if (!loaded || finalized || !tracking.clock) return;
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
    courtPressRef.current = true;
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
    if (!tracking.players) {
      setActivePlayer(null);
      goStep({ kind: "stat" });
      return;
    }
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
    if (!point || (tracking.players && !activePlayer)) return;
    if (statKey === "__opp") {
      goStep({ kind: "oppStat" });
      return;
    }
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
      if (tracking.assists && tracking.players) goStep({ kind: "assist", eventId: e.id });
      else reset();
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
      if (tracking.rebounds || (tracking.opponent && tracking.oppRebounds)) goStep({ kind: "miss", eventId: e.id });
      else reset();
      return;
    }
    if (statKey === "FOUL") {
      if (tracking.foulDetail) {
        goStep({ kind: "foul" });
      } else {
        addEvent({ event_type: "FOUL", player_id: activePlayer, x: point.x, y: point.y, zone });
        reset();
      }
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
    return `#${player.jersey}${shortName ? ` · ${shortName}` : ""}${fouledOut(player.id) ? " · FO" : ""}`;
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
    const enabled: Record<string, boolean> = {
      MADE: true,
      MISS: true,
      REBOUND: tracking.rebounds,
      ASSIST: tracking.assists && tracking.players,
      STEAL: tracking.steals,
      TURNOVER: tracking.turnovers,
      BLOCK: tracking.blocks,
      FOUL: tracking.fouls,
    };
    choices = STAT_CHOICES.filter((c) => enabled[c.key]);
    if (!tracking.players) choices.push({ key: "__opp", label: "Opponent", tone: "neutral" });
    choices.push({ key: "__cancel", label: "Cancel", tone: "ghost" });
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
  } else if (step.kind === "quick") {
    overlayTitle = `+${step.value} · who scored?`;
    choices = playerChoices(onFloor);
    if (bench.length) {
      choices.push(...(showOtherPlayers ? playerChoices(bench, "neutral") : [revealOtherChoice]));
    }
    choices.push({ key: "__team", label: "Team only", tone: "neutral" });
    onPick = (k) => {
      if (k === "__other") return setShowOtherPlayers(true);
      const pid = k === "__team" ? null : k;
      if (pid) ensureOnFloor(pid);
      const e = addEvent({ event_type: "MADE", player_id: pid, points: step.value, result: `${step.value}PT`, context: { shot_value: step.value } });
      if (pid && tracking.assists) {
        setActivePlayer(pid);
        goStep({ kind: "assist", eventId: e.id });
      } else reset();
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
    choices = [];
    if (tracking.rebounds && tracking.players) {
      choices.push(...playerChoices(onFloor));
      if (bench.length) {
        choices.push(...(showOtherPlayers ? playerChoices(bench, "neutral") : [revealOtherChoice]));
      }
    } else if (tracking.rebounds) {
      choices.push({ key: "__teamreb", label: "Our rebound", tone: "grape" });
    }
    if (tracking.opponent && tracking.oppRebounds) choices.push({ key: "__opp", label: "Opponent rebound", tone: "grape" });
    choices.push({ key: "__oob", label: "Out of bounds", tone: "neutral" });
    choices.push({ key: "__skip", label: "Skip", tone: "ghost" });
    onPick = (k) => {
      if (k === "__other") return setShowOtherPlayers(true);
      if (k === "__teamreb") {
        addEvent({ event_type: "REBOUND", result: "OFF", related_event_id: step.eventId });
        reset();
      } else if (k === "__opp") {
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
    choices = [{ key: "MADE", label: `Make ${value}`, tone: "flame" }];
    if (tracking.opponent) choices.push({ key: "MISS", label: "Miss", tone: "grape" });
    if (tracking.opponent && tracking.oppTurnovers) choices.push({ key: "TURNOVER", label: "Turnover", tone: "grape" });
    if (tracking.oppFouls) choices.push({ key: "FOUL", label: "Foul", tone: "grape" });
    choices.push({ key: "__cancel", label: "Cancel", tone: "ghost" });
    onPick = (k) => {
      if (k === "__cancel" || !point) return reset();
      const loc = { x: point.x, y: point.y, zone: zoneOf(point.x, point.y) };
      if (k === "MADE") {
        addEvent({ event_type: "OPP_MADE", ...loc, points: value, result: `${value}PT` });
        return reset();
      }
      if (k === "MISS") {
        const e = addEvent({ event_type: "OPP_MISS", ...loc, result: `${value}PT` });
        if (tracking.rebounds || tracking.oppRebounds) goStep({ kind: "oppMiss", eventId: e.id });
        else reset();
        return;
      }
      addEvent({ event_type: `OPP_${k}`, ...loc });
      reset();
    };
  } else if (step.kind === "oppMiss") {
    overlayTitle = "Rebound?";
    choices = tracking.oppRebounds ? [{ key: "__oreb", label: "Opponent Off. Reb", tone: "grape" }] : [];
    if (tracking.rebounds && tracking.players) {
      choices.push(...playerChoices(onFloor));
      if (bench.length) {
        choices.push(...(showOtherPlayers ? playerChoices(bench, "neutral") : [revealOtherChoice]));
      }
    }
    if (tracking.rebounds) choices.push({ key: "__usreb", label: "US Def. Reb · team", tone: "neutral" });
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
      if (sameGesture()) return;
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

  /* ---------------- mid-game tracking settings ---------------- */
  // Changes apply now (cache) and persist through the offline queue; every
  // toggle is appended to tracking_history so reports can disclose coverage.
  const patchGame = (patch: Record<string, unknown>) => {
    queryClient.setQueryData(["game", gameId], (old: unknown) => (old ? { ...(old as object), ...patch } : old));
    void enqueue({ id: opId(), kind: "update_game", payload: { id: gameId, ...patch } }).then(() => flushQueue().then(setPending));
  };
  const saveTracking = (next: TrackingConfig) => {
    const changes = diffTracking(tracking, next, { period: quarter, eventCount: events.length, userId });
    if (!changes.length) return;
    if (!next.clock) setRunning(false);
    const history = [...normalizeHistory(game.data?.tracking_history), ...changes];
    reset();
    patchGame({ stat_tracking_config: next, tracking_history: history });
  };
  const saveRules = (next: RulesConfig) => patchGame({ rules_config: next });
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
          <div className={cn("grid gap-1.5", tracking.clock ? "grid-cols-6" : "grid-cols-5")}>
            {([
              { k: "us", label: "Us", value: teamScore, tone: "grape", cls: "px-1.5 [&>div:first-child]:text-[10px] [&>div:nth-child(2)]:text-2xl" },
              { k: "opp", label: "Opp", value: oppScore, tone: "flame", cls: "px-1.5 [&>div:first-child]:text-[10px] [&>div:nth-child(2)]:text-2xl" },
              { k: "period", label: "Period", value: isOvertime ? `OT${quarter - periods}` : `Q${quarter}`, tone: "neutral", cls: "px-1 [&>div:first-child]:text-[10px] [&>div:nth-child(2)]:text-lg" },
              { k: "fouls", label: "Team fouls", value: teamFouls, hint: oppBonus, tone: "neutral", cls: "px-1 [&>div:first-child]:text-[9px] [&>div:nth-child(2)]:text-lg" },
              { k: "oppFouls", label: "Opp fouls", value: oppFouls, hint: teamBonus, tone: "neutral", cls: "px-1 [&>div:first-child]:text-[9px] [&>div:nth-child(2)]:text-lg" },
            ] as const).map((t) => (
              <button key={t.k} type="button" aria-label={`Edit ${t.label}`} onClick={() => setTileEdit(t.k)} className="min-h-11 rounded-2xl text-left active:scale-[0.97]">
                <StatTile
                  label={t.label}
                  value={t.value}
                  hint={"hint" in t && t.hint ? <span className="rounded-full bg-flame/25 px-1 font-black text-foreground">{t.k === "fouls" ? `OPP ${t.hint}` : t.hint}</span> : undefined}
                  tone={t.tone}
                  className={cn("h-full py-1.5", t.cls)}
                />
              </button>
            ))}
            {tracking.clock ? (
              <div className="flex min-h-11 flex-col gap-0.5 rounded-2xl border border-border bg-surface-2/70 p-0.5">
                <button type="button" aria-label="Edit game clock" onClick={() => { setRunning(false); setClockEdit(true); }} className={cn("min-h-6 flex-1 rounded-xl text-center font-black tabular-nums active:scale-[0.97]", clock === 0 ? "text-flame" : "", "text-base sm:text-lg")}>
                  {formatClock(clock)}
                </button>
                <button type="button" aria-label={running ? "Pause clock" : "Start clock"} disabled={clock === 0} onClick={() => setRunning((v) => !v)} className={cn("min-h-6 rounded-xl text-[11px] font-black disabled:opacity-40", running ? "bg-flame/30" : "bg-grape/30")}>
                  {running ? "❚❚ Pause" : "▶ Play"}
                </button>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 p-1.5 sm:flex sm:flex-wrap">
          <div className="flex min-w-0 flex-wrap gap-2">
            <BubbleButton size="sm" tone="neutral" onClick={() => navigate({ to: "/dashboard" })}>⌂ Home</BubbleButton>
            <BubbleButton size="sm" tone="neutral" aria-label="Tracking settings" onClick={() => setSettingsOpen(true)}>⚙ Tracking</BubbleButton>
            <BubbleButton size="sm" tone="grape" onClick={() => { void trackActivity("board_used_in_game", { entityId: gameId }); navigate({ to: "/board" }); }}>✎ Timeout Board</BubbleButton>
            {rules.timeoutsFull + rules.timeouts30 > 0 ? (
              <div className="flex items-center gap-1 rounded-full border border-border bg-surface-2/70 p-0.5">
                {rules.timeoutsFull > 0 ? <BubbleButton size="sm" tone="neutral" className="min-h-11 px-2 text-xs" disabled={timeoutsLeftFull === 0} onClick={() => addEvent({ event_type: "TIMEOUT", result: "FULL" })}>TO Full: {timeoutsLeftFull}</BubbleButton> : null}
                {rules.timeouts30 > 0 ? <BubbleButton size="sm" tone="neutral" className="min-h-11 px-2 text-xs" disabled={timeoutsLeft30 === 0} onClick={() => addEvent({ event_type: "TIMEOUT", result: "30" })}>30s: {timeoutsLeft30}</BubbleButton> : null}
                {events.some((e) => e.event_type === "TIMEOUT") ? (
                  <BubbleButton size="sm" tone="ghost" className="h-11 min-h-11 w-11 px-0" aria-label="Undo last timeout" onClick={() => { const t = [...events].reverse().find((e) => e.event_type === "TIMEOUT"); if (t) deleteEvent(t.id); }}>↺</BubbleButton>
                ) : null}
              </div>
            ) : null}
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
              onCourtPointerUp={() => {
                // Button pointerups inside the overlay bubble here too; only the
                // end of a gesture that STARTED on the court arms the ghost-click guard.
                if (!courtPressRef.current) return;
                courtPressRef.current = false;
                swallowClickRef.current = true;
              }}
              onCourtPointerCancel={() => { courtPressRef.current = false; }}
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
                      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                      onPointerUp={(pointerEvent) => {
                        pointerEvent.stopPropagation();
                        if (sameGesture()) return;
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
                        <div className={cn("grid gap-1", ["player", "ft", "assist", "miss", "oppMiss", "quick"].includes(step.kind) ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}>
                          {choices.map((choice) => {
                            const isPlayerChoice = !choice.key.startsWith("__") && ["player", "ft", "assist", "miss", "oppMiss", "quick"].includes(step.kind);
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
              <Label className="px-2">{tracking.players && tracking.shotLocations ? "Our FT" : "Us"}</Label>
              <div className={cn("grid gap-1.5", tracking.players && tracking.shotLocations ? "grid-cols-2" : "grid-cols-4")}>
                {tracking.players && tracking.shotLocations ? null : (
                  <>
                    {[2, 3].map((v) => (
                      <BubbleButton key={v} size="sm" tone="flame" className="min-h-11 px-1" onClick={() => {
                        if (tracking.players) { setPoint(null); goStep({ kind: "quick", value: v as 2 | 3 }); }
                        else addEvent({ event_type: "MADE", points: v, result: `${v}PT`, context: { shot_value: v } });
                      }}>+{v}</BubbleButton>
                    ))}
                  </>
                )}
                <BubbleButton size="sm" tone="flame" className="min-h-11 px-1 text-xs" onClick={() => tracking.players ? goStep({ kind: "ft", made: true }) : addEvent({ event_type: "FT_MADE", points: 1, result: "FT", zone: "freethrow" })}>{tracking.players && tracking.shotLocations ? "FT Made" : "+1 FT"}</BubbleButton>
                {tracking.players ? (
                  <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => goStep({ kind: "ft", made: false })}>FT Miss</BubbleButton>
                ) : tracking.fouls ? (
                  <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "FOUL" })}>Foul</BubbleButton>
                ) : (
                  <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "FT_MISS", result: "FT", zone: "freethrow" })}>FT Miss</BubbleButton>
                )}
              </div>
            </Panel>

            {/* OPPONENT */}
            {!tracking.opponent ? (
              <Panel className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 p-1.5">
                <Label className="px-2">Opp</Label>
                <div className={cn("grid gap-1.5", tracking.oppFouls ? "grid-cols-4" : "grid-cols-3")}>
                  {[1, 2, 3].map((v) => (
                    <BubbleButton key={v} size="sm" tone="flame" className="min-h-11 px-1" onClick={() => v === 1 ? addEvent({ event_type: "OPP_FT_MADE", points: 1, result: "FT" }) : addEvent({ event_type: "OPP_MADE", points: v, result: `${v}PT`, context: { shot_value: v } })}>+{v}</BubbleButton>
                  ))}
                  {tracking.oppFouls ? <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_FOUL" })}>Foul</BubbleButton> : null}
                </div>
              </Panel>
            ) : null}
            {tracking.opponent ? <Panel className="flex flex-col gap-1.5 p-1.5">
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
                      {tracking.oppRebounds ? <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_REBOUND", result: "OFF" })}>Off. Reb</BubbleButton> : null}
                      {tracking.oppRebounds ? <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_REBOUND", result: "DEF" })}>Def. Reb</BubbleButton> : null}
                      {tracking.oppTurnovers ? <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_TURNOVER" })}>Turnover</BubbleButton> : null}
                      {tracking.oppFouls ? <BubbleButton size="sm" tone="grape" className="min-h-11 px-1 text-xs" onClick={() => addEvent({ event_type: "OPP_FOUL" })}>Opp Foul</BubbleButton> : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-border/70 bg-surface-2/60 px-2 py-1 text-center text-[11px] font-bold text-muted-foreground">
                FG {fmtSplit(opp.fg)} · 3PT {fmtSplit(opp.three)} · FT {fmtSplit(opp.ft)} · OREB {opp.oreb} · TO {opp.to} · Fouls {oppFouls}
              </div>
            </Panel> : null}

            {/* LINEUP */}
            {tracking.players ? <Panel className="flex flex-col gap-1.5 p-1.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <Label>On the floor</Label>
                <BubbleButton size="md" tone={showBench ? "grape" : "neutral"} className="min-h-12" onClick={() => { setShowBench((value) => !value); setSubOut(null); }}>Sub</BubbleButton>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {onFloor.map((p) => (
                  <BubbleButton key={p.id} size="sm" tone={subOut === p.id ? "flame" : fouledOut(p.id) ? "danger" : "grape"} className="min-h-11 min-w-0 truncate px-2 text-xs" onClick={() => showBench && setSubOut(p.id)}>
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
            </Panel> : null}

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
                <BubbleButton size="lg" tone="danger" className="col-span-3 min-h-14 text-base" disabled={ending} onClick={() => setEndCheck(true)}>
                  {ending ? "Saving…" : finalized ? "Save & open review" : "End Game & Save"}
                </BubbleButton>
              </div>
            </Panel>
          </div>
        </div>
      </div>
      {settingsOpen ? (
        <TrackingSettingsSheet
          tracking={tracking}
          rules={rules}
          onTracking={saveTracking}
          onRules={saveRules}
          clockDefaults={{ periodMinutes: game.data?.period_minutes ?? 8, otMinutes: overtimeMinutes, clockSeconds: clock, isOvertime }}
          onClockSetup={({ periodMinutes, otMinutes, clockSeconds }) => {
            patchGame({ period_minutes: periodMinutes, overtime_minutes: otMinutes });
            setClock(clockSeconds);
            setRunning(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {clockEdit ? (
        <ClockEditor seconds={clock} onSave={(v) => { setClock(v); setEndPrompt(false); setClockEdit(false); }} onClose={() => setClockEdit(false)} />
      ) : null}
      {tileEdit ? (
        <TileEditor
          kind={tileEdit}
          events={events}
          onFloor={onFloor}
          bench={bench}
          tracking={tracking}
          quarter={quarter}
          periods={periods}
          teamFouls={teamFouls}
          oppFouls={oppFouls}
          inFoulWindow={inFoulWindow}
          userId={userId}
          onAdd={(e) => { if (e.player_id) ensureOnFloor(e.player_id); addEvent(e); }}
          onDelete={deleteEvent}
          onSetQuarter={(q) => {
            setQuarter(q);
            void enqueue({ id: opId(), kind: "update_game", payload: { id: gameId, quarter: q } }).then(() => flushQueue().then(setPending));
          }}
          onClose={() => setTileEdit(null)}
        />
      ) : null}
      {endCheck ? (
        <EndGameCheck
          teamScore={teamScore}
          oppScore={oppScore}
          userId={userId}
          onAdd={addEvent}
          onReconcile={(k) => { setEndCheck(false); setTileEdit(k); }}
          onConfirm={() => { setEndCheck(false); void finishGame(); }}
          onClose={() => setEndCheck(false)}
        />
      ) : null}
    </div>
  );
}
