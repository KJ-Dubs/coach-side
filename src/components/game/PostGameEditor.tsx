import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { Court } from "@/components/court/Court";
import { EventEditor } from "@/components/court/EventEditor";
import { supabase } from "@/integrations/supabase/client";
import { trackActivity } from "@/lib/activity";
import { zoneOf } from "@/lib/court";
import { uuid } from "@/lib/offline";
import { eventPoints, isOppEvent, scoreFromEvents, shotValueOf } from "@/lib/stats";
import type { Game, GameEvent, Player } from "@/lib/types";
import { CoverageEditor } from "@/components/game/CoverageEditor";

type AddKind =
  | "MADE"
  | "MISS"
  | "FT_MADE"
  | "FT_MISS"
  | "REBOUND"
  | "ASSIST"
  | "STEAL"
  | "TURNOVER"
  | "BLOCK"
  | "FOUL"
  | "ADJUST";
const US_ADD: AddKind[] = ["MADE", "MISS", "FT_MADE", "FT_MISS", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL", "ADJUST"];
const OPP_ADD: AddKind[] = ["MADE", "MISS", "FT_MADE", "FT_MISS", "REBOUND", "TURNOVER", "FOUL"];
const ADD_LABEL: Record<AddKind, string> = {
  MADE: "Made shot",
  MISS: "Missed shot",
  FT_MADE: "FT made",
  FT_MISS: "FT missed",
  REBOUND: "Rebound",
  ASSIST: "Assist",
  STEAL: "Steal",
  TURNOVER: "Turnover",
  BLOCK: "Block",
  FOUL: "Foul",
  ADJUST: "Team-only score fix",
};

const TYPE_LABEL: Record<string, string> = {
  MADE: "Made FG",
  MISS: "Missed FG",
  FT_MADE: "FT made",
  FT_MISS: "FT missed",
  REBOUND: "Rebound",
  ASSIST: "Assist",
  STEAL: "Steal",
  TURNOVER: "Turnover",
  BLOCK: "Block",
  FOUL: "Foul",
  SCORE: "Score fix",
  OUT_OF_BOUNDS: "Out of bounds",
};

export function describeEvent(e: GameEvent) {
  const t = String(e.event_type);
  const base = t.startsWith("OPP_") ? t.slice(4) : t;
  let label = TYPE_LABEL[base] ?? base;
  if (base === "MADE" || base === "MISS") label += ` · ${shotValueOf(e)}PT`;
  if (base === "REBOUND" && e.result) label += ` · ${e.result === "OFF" ? "Off" : "Def"}`;
  return label;
}

/**
 * Post-game corrections for a FINAL game. Every change edits the event ledger
 * (the canonical score source); the stored game score is only re-snapshotted
 * from the corrected events afterwards.
 */
export function PostGameEditor({
  game,
  events,
  roster,
  onChanged,
  onDone,
}: {
  game: Game;
  events: GameEvent[];
  roster: Player[];
  onChanged: () => Promise<GameEvent[]>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [order, setOrder] = useState<"newest" | "chrono">("newest");
  const [scoringOnly, setScoringOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Add-stat form
  const [aOpp, setAOpp] = useState(false);
  const [aKind, setAKind] = useState<AddKind>("MADE");
  const [aValue, setAValue] = useState<1 | 2 | 3>(2);
  const [aPlayer, setAPlayer] = useState<string | null>(null);
  const [aReb, setAReb] = useState<"OFF" | "DEF">("DEF");
  const [aQuarter, setAQuarter] = useState(Math.max(game.periods, game.quarter || 1));
  const [aLoc, setALoc] = useState<{ x: number; y: number } | null>(null);
  const [aPicking, setAPicking] = useState(false);

  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const who = (e: GameEvent) =>
    isOppEvent(e) ? "OPP" : e.player_id ? `#${byId.get(e.player_id)?.jersey ?? "?"}` : "TEAM";
  const score = scoreFromEvents(events);
  const result = score.team > score.opp ? "W" : score.team < score.opp ? "L" : "T";
  const periodLabel = (q: number) => (q > game.periods ? `OT${q - game.periods}` : `Q${q}`);

  const lastEdited = events.reduce<string | null>((m, e) => {
    const t = (e.context as Record<string, unknown> | null)?.["postgame_edited_at"];
    return typeof t === "string" && (!m || t > m) ? t : m;
  }, null);

  const list = useMemo(() => {
    const l = events.filter((e) => !scoringOnly || eventPoints(e) > 0 || /MADE|MISS|SCORE/.test(String(e.event_type)));
    const sorted = [...l].sort((a, b) => a.quarter - b.quarter || a.created_at.localeCompare(b.created_at));
    return order === "newest" ? sorted.reverse() : sorted;
  }, [events, scoringOnly, order]);

  /** Re-fetch, re-snapshot stored score, record audit, refresh every stats view. */
  const afterMutation = async (
    kind: "game_stat_edited" | "game_stat_added_postgame" | "game_stat_deleted_postgame",
    eventId: string,
  ) => {
    const fresh = await onChanged();
    const s = scoreFromEvents(fresh);
    await supabase.from("games").update({ team_score: s.team, opp_score: s.opp } as never).eq("id", game.id);
    void trackActivity(kind, { teamId: game.team_id, entityId: game.id, metadata: { event_id: eventId } });
    await qc.invalidateQueries();
  };

  const stamp = (ctx: Record<string, unknown> | null | undefined) => ({
    ...(ctx ?? {}),
    postgame_edited_at: new Date().toISOString(),
  });

  const saveEdit = async (e: GameEvent, patch: Partial<GameEvent>) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("game_events")
        .update({ ...patch, context: stamp((patch.context as Record<string, unknown>) ?? e.context) } as never)
        .eq("id", e.id);
      if (error) throw error;
      setEditingId(null);
      setPicking(false);
      await afterMutation("game_stat_edited", e.id);
      toast.success("Event updated");
    } catch (err) {
      toast.error((err as Error).message || "Could not save — only team coaches can edit stats");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: GameEvent) => {
    const pts = eventPoints(e);
    const msg =
      pts > 0
        ? (() => {
            const after = scoreFromEvents(events.filter((x) => x.id !== e.id));
            return `Delete this ${pts === 1 ? "free throw" : `${pts}-point make`} by ${who(e)}? Score will change from ${score.team}–${score.opp} to ${after.team}–${after.opp}.`;
          })()
        : `Delete this ${describeEvent(e)} (${who(e)})?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("game_events").delete().eq("id", e.id);
      if (error) throw error;
      setEditingId(null);
      await afterMutation("game_stat_deleted_postgame", e.id);
      toast.success("Event deleted");
    } catch (err) {
      toast.error((err as Error).message || "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  const needsPlayer = !aOpp && aKind !== "ADJUST";
  const needsValue = aKind === "MADE" || aKind === "MISS" || aKind === "ADJUST";
  const canLocate = aKind !== "ADJUST" && aKind !== "FT_MADE" && aKind !== "FT_MISS";

  const openAdd = (opp: boolean, kind: AddKind, value: 1 | 2 | 3 = 2) => {
    setAOpp(opp);
    setAKind(kind);
    setAValue(value);
    setALoc(null);
    setAPicking(false);
    setAdding(true);
    setEditingId(null);
  };

  const saveAdd = async () => {
    if (needsPlayer && !aPlayer) {
      toast.error("Pick the player");
      return;
    }
    let type: string = aKind;
    let points = 0;
    let result: string | null = null;
    const context: Record<string, unknown> = { postgame: true };
    if (aKind === "MADE" || aKind === "MISS") {
      const v = aValue === 3 ? 3 : 2;
      points = aKind === "MADE" ? v : 0;
      result = `${v}PT`;
      context["shot_value"] = v;
    } else if (aKind === "FT_MADE" || aKind === "FT_MISS") {
      points = aKind === "FT_MADE" ? 1 : 0;
      result = "FT";
    } else if (aKind === "REBOUND") {
      result = aReb;
    } else if (aKind === "ADJUST") {
      type = "SCORE";
      points = aValue;
      context["team_adjustment"] = true;
    }
    const loc = canLocate ? aLoc : null;
    const ev: GameEvent = {
      id: uuid(),
      game_id: game.id,
      quarter: aQuarter,
      clock_seconds: 0, // post-game sentinel: the tracker no longer uses the clock
      player_id: needsPlayer ? aPlayer : null,
      x: loc?.x ?? null,
      y: loc?.y ?? null,
      event_type: aOpp ? `OPP_${type}` : type,
      result,
      points,
      zone: loc && (aKind === "MADE" || aKind === "MISS") ? zoneOf(loc.x, loc.y) : null,
      current_lineup: [],
      related_event_id: null,
      context: stamp(context),
      created_at: new Date().toISOString(),
    };
    setBusy(true);
    try {
      const { error } = await supabase.from("game_events").insert(ev as never);
      if (error) throw error;
      setAdding(false);
      await afterMutation("game_stat_added_postgame", ev.id);
      toast.success("Stat added");
    } catch (err) {
      toast.error((err as Error).message || "Could not add — only team coaches can edit stats");
    } finally {
      setBusy(false);
    }
  };

  const editing = events.find((e) => e.id === editingId) ?? null;
  const showCourt = (editing && picking) || (adding && aPicking);

  const onCourtPoint = (raw: { x: number; y: number }) => {
    const p = { x: Math.min(2, Math.max(0, raw.x * 2)), y: raw.y };
    if (adding && aPicking) {
      setALoc(p);
      setAPicking(false);
    } else if (editing && picking) {
      setPicking(false);
      void saveEdit(editing, { x: p.x, y: p.y, zone: zoneOf(p.x, p.y) });
    }
  };

  return (
    <Panel className="mb-3 flex min-w-0 max-w-full flex-col gap-3 border-flame/50">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Label>Editing final stats</Label>
        <Pill tone="grape">US {score.team}</Pill>
        <Pill tone="flame">OPP {score.opp}</Pill>
        <Pill tone={result === "W" ? "success" : result === "L" ? "danger" : "muted"}>
          {result === "W" ? "WIN" : result === "L" ? "LOSS" : "TIE"}
        </Pill>
        <BubbleButton size="sm" tone="grape" onClick={onDone}>
          Done Editing
        </BubbleButton>
      </div>
      {lastEdited ? (
        <div className="flex justify-center">
          <Pill tone="muted">
            Post-game stats edited {new Date(lastEdited).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </Pill>
        </div>
      ) : null}

      <CoverageEditor game={game} events={events} />
      <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-2/60 p-2">
        <Label>Fix score</Label>
        <Pill tone="muted">Scores come from recorded events — add or correct the scoring event that caused the difference.</Pill>
        <div className="flex flex-wrap gap-1.5">
          <BubbleButton size="sm" tone="grape" onClick={() => openAdd(false, "FT_MADE", 1)}>Our +1</BubbleButton>
          <BubbleButton size="sm" tone="grape" onClick={() => openAdd(false, "MADE", 2)}>Our +2</BubbleButton>
          <BubbleButton size="sm" tone="grape" onClick={() => openAdd(false, "MADE", 3)}>Our +3</BubbleButton>
          <BubbleButton size="sm" tone="flame" onClick={() => openAdd(true, "FT_MADE", 1)}>Opp +1</BubbleButton>
          <BubbleButton size="sm" tone="flame" onClick={() => openAdd(true, "MADE", 2)}>Opp +2</BubbleButton>
          <BubbleButton size="sm" tone="flame" onClick={() => openAdd(true, "MADE", 3)}>Opp +3</BubbleButton>
          <BubbleButton size="sm" tone={scoringOnly ? "flame" : "neutral"} onClick={() => setScoringOnly((v) => !v)}>
            Review scoring events
          </BubbleButton>
        </div>
      </div>

      {!adding ? (
        <BubbleButton size="lg" tone="flame" onClick={() => openAdd(false, "MADE", 2)}>
          + Add Stat
        </BubbleButton>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-flame/60 bg-surface-2/80 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Label>Add stat</Label>
            <BubbleButton size="sm" tone={!aOpp ? "grape" : "neutral"} onClick={() => setAOpp(false)}>Us</BubbleButton>
            <BubbleButton
              size="sm"
              tone={aOpp ? "flame" : "neutral"}
              onClick={() => {
                setAOpp(true);
                if (!OPP_ADD.includes(aKind)) setAKind("MADE");
              }}
            >
              Opponent
            </BubbleButton>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(aOpp ? OPP_ADD : US_ADD).map((k) => (
              <BubbleButton
                key={k}
                size="sm"
                tone={aKind === k ? "grape" : "neutral"}
                onClick={() => {
                  setAKind(k);
                  if ((k === "MADE" || k === "MISS") && aValue === 1) setAValue(2);
                }}
              >
                {ADD_LABEL[k]}
              </BubbleButton>
            ))}
          </div>
          {needsValue ? (
            <div className="flex flex-wrap gap-1.5">
              {(aKind === "ADJUST" ? ([1, 2, 3] as const) : ([2, 3] as const)).map((v) => (
                <BubbleButton key={v} size="sm" tone={aValue === v ? "flame" : "neutral"} onClick={() => setAValue(v)}>
                  {v} PT
                </BubbleButton>
              ))}
              {aKind === "ADJUST" ? <Pill tone="muted">Counts for team score only, no player stats</Pill> : null}
            </div>
          ) : null}
          {aKind === "REBOUND" ? (
            <div className="flex flex-wrap gap-1.5">
              <BubbleButton size="sm" tone={aReb === "OFF" ? "flame" : "neutral"} onClick={() => setAReb("OFF")}>Offensive</BubbleButton>
              <BubbleButton size="sm" tone={aReb === "DEF" ? "grape" : "neutral"} onClick={() => setAReb("DEF")}>Defensive</BubbleButton>
            </div>
          ) : null}
          {needsPlayer ? (
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="muted">Player</Pill>
              {roster.map((p) => (
                <BubbleButton key={p.id} size="sm" tone={aPlayer === p.id ? "grape" : "ghost"} onClick={() => setAPlayer(p.id)}>
                  #{p.jersey}
                </BubbleButton>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <BubbleButton size="sm" tone="neutral" onClick={() => setAQuarter((q) => Math.max(1, q - 1))}>−</BubbleButton>
            <Pill tone="neutral">{periodLabel(aQuarter)}</Pill>
            <BubbleButton size="sm" tone="neutral" onClick={() => setAQuarter((q) => q + 1)}>+</BubbleButton>
            {canLocate ? (
              <BubbleButton size="sm" tone={aPicking ? "flame" : aLoc ? "grape" : "neutral"} onClick={() => setAPicking((v) => !v)}>
                {aPicking ? "Tap the court…" : aLoc ? "Location set" : "Location (optional)"}
              </BubbleButton>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <BubbleButton size="lg" tone="grape" className="flex-1" disabled={busy} onClick={() => void saveAdd()}>
              {busy ? "Saving…" : "Save"}
            </BubbleButton>
            <BubbleButton size="sm" tone="ghost" onClick={() => setAdding(false)}>Cancel</BubbleButton>
          </div>
        </div>
      )}

      {showCourt ? (
        <Court variant="full" zoom="full" className="mx-auto w-full max-w-xl" onCourtPoint={onCourtPoint} />
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <Label>{scoringOnly ? "Scoring events" : "All events"} ({list.length})</Label>
        <BubbleButton size="sm" tone={order === "newest" ? "grape" : "neutral"} onClick={() => setOrder("newest")}>Newest first</BubbleButton>
        <BubbleButton size="sm" tone={order === "chrono" ? "grape" : "neutral"} onClick={() => setOrder("chrono")}>Chronological</BubbleButton>
      </div>
      <div className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto">
        {list.map((e) =>
          editingId === e.id ? (
            <EventEditor
              key={e.id}
              event={e}
              roster={roster}
              picking={picking}
              onPickLocation={() => setPicking((v) => !v)}
              onSave={(patch) => void saveEdit(e, patch)}
              onDelete={() => void remove(e)}
              onClose={() => {
                setEditingId(null);
                setPicking(false);
              }}
            />
          ) : (
            <div
              key={e.id}
              className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-2xl border border-border bg-surface-2/70 px-2 py-1.5 text-xs font-bold"
            >
              <Pill tone="muted">{periodLabel(e.quarter)}</Pill>
              <span className={`rounded-full px-2 py-0.5 ${isOppEvent(e) ? "bg-flame/25" : "bg-grape/25"}`}>{who(e)}</span>
              <span className="min-w-0 truncate rounded-full bg-surface/70 px-2 py-0.5">
                {describeEvent(e)}
                {eventPoints(e) ? ` · +${eventPoints(e)}` : ""}
                {e.x != null ? " · 📍" : ""}
              </span>
              <BubbleButton size="sm" tone="neutral" onClick={() => { setAdding(false); setPicking(false); setEditingId(e.id); }}>
                Edit
              </BubbleButton>
              <BubbleButton size="sm" tone="danger" disabled={busy} onClick={() => void remove(e)}>
                Delete
              </BubbleButton>
            </div>
          ),
        )}
        {!list.length ? <Pill tone="muted">No events recorded</Pill> : null}
      </div>
    </Panel>
  );
}
