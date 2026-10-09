/**
 * Live Game scoreboard tile editors. game_events stay canonical: every
 * correction becomes (or removes) an event, never a stored-score overwrite.
 * Team-only adjustments reuse the post-game SCORE event pattern.
 */
import { useState, type ReactNode } from "react";
import { BubbleButton, Label, Pill } from "@/components/Bubbles";
import type { GameEvent, Player } from "@/lib/types";
import { eventPoints, scoreFromEvents } from "@/lib/stats";
import type { TrackingConfig } from "@/lib/gameConfig";
import { cn } from "@/lib/utils";

export type TileKind = "us" | "opp" | "period" | "fouls" | "oppFouls";
type NewEvent = Partial<GameEvent> & { event_type: string };

const correction = (userId: string | null, source: string) => ({
  manual_score_adjustment: true,
  team_adjustment: true,
  corrected_by: userId,
  corrected_at: new Date().toISOString(),
  correction_source: source,
});

/** Team-only score adjustment as SCORE events (max 3 points each). */
export function teamAdjustEvents(opp: boolean, points: number, userId: string | null, source: string): NewEvent[] {
  const out: NewEvent[] = [];
  let left = points;
  while (left > 0) {
    const p = Math.min(3, left);
    out.push({ event_type: opp ? "OPP_SCORE" : "SCORE", points: p, context: correction(userId, source) });
    left -= p;
  }
  return out;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 p-2 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col gap-2 overflow-y-auto rounded-3xl border border-grape/60 bg-surface p-3 shadow-2xl shadow-black/60 bubble-pop"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center">
          <span aria-hidden />
          <Label className="justify-self-center bg-grape/25 px-3 text-sm text-foreground">{title}</Label>
          <BubbleButton size="sm" tone="ghost" className="h-11 min-h-11 w-11 px-0 text-lg" aria-label="Close" onClick={onClose}>×</BubbleButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-14 w-full rounded-2xl border border-input bg-surface-2 px-3 text-center text-3xl font-black text-foreground outline-none focus:border-grape"
    />
  );
}

const label = (p: Player) => `#${p.jersey} · ${p.name.trim().split(/\s+/)[0] ?? ""}`;

export function TileEditor(props: {
  kind: TileKind;
  events: GameEvent[];
  onFloor: Player[];
  bench: Player[];
  tracking: TrackingConfig;
  quarter: number;
  periods: number;
  teamFouls: number;
  oppFouls: number;
  inFoulWindow: (q: number) => boolean;
  userId: string | null;
  onAdd: (e: NewEvent) => void;
  onDelete: (id: string) => void;
  onSetQuarter: (q: number) => void;
  onClose: () => void;
}) {
  const { kind, events, tracking } = props;
  const isScore = kind === "us" || kind === "opp";
  const opp = kind === "opp" || kind === "oppFouls";
  const score = scoreFromEvents(events);
  const current = kind === "us" ? score.team : kind === "opp" ? score.opp : kind === "fouls" ? props.teamFouls : props.oppFouls;
  const [input, setInput] = useState(String(current));
  const [target, setTarget] = useState<number | null>(null);
  const [scorer, setScorer] = useState<string | null>(null);
  const [showBench, setShowBench] = useState(false);

  if (kind === "period") {
    const opts = [...Array.from({ length: props.periods }, (_, i) => i + 1), props.periods + 1, props.periods + 2, props.periods + 3];
    return (
      <Sheet title="Set period" onClose={props.onClose}>
        <div className="grid grid-cols-4 gap-1.5">
          {opts.map((q) => (
            <BubbleButton key={q} size="md" tone={q === props.quarter ? "grape" : "neutral"} className="min-h-12" onClick={() => { props.onSetQuarter(q); props.onClose(); }}>
              {q > props.periods ? `OT${q - props.periods}` : props.periods === 2 ? `H${q}` : `Q${q}`}
            </BubbleButton>
          ))}
        </div>
        <Pill tone="muted">Past events keep their recorded period</Pill>
      </Sheet>
    );
  }

  const title = kind === "us" ? "Our score" : kind === "opp" ? "Opponent score" : kind === "fouls" ? "Team fouls" : "Opponent fouls";
  if (target == null) {
    return (
      <Sheet title={title} onClose={props.onClose}>
        <NumberInput value={input} onChange={setInput} />
        <Pill tone="muted">CoachSide has {current} from recorded {isScore ? "plays" : "fouls"}</Pill>
        <BubbleButton tone="flame" size="lg" className="min-h-12" onClick={() => {
          const v = Math.max(0, Math.floor(Number(input)));
          if (!Number.isFinite(v)) return;
          if (v === current) return props.onClose();
          setTarget(v);
        }}>Save</BubbleButton>
      </Sheet>
    );
  }

  const diff = target - current;
  if (diff === 0) {
    return (
      <Sheet title={title} onClose={props.onClose}>
        <Pill tone="grape">✓ Reconciled at {current}</Pill>
        <BubbleButton tone="flame" size="lg" className="min-h-12" onClick={props.onClose}>Done</BubbleButton>
      </Sheet>
    );
  }

  const players = [...props.onFloor, ...(showBench ? props.bench : [])];
  const playerPicker = (onPick: (id: string) => void, selected?: string | null) => (
    <div className="grid grid-cols-3 gap-1">
      {players.map((p) => (
        <BubbleButton key={p.id} size="sm" tone={selected === p.id ? "flame" : "grape"} className="min-h-11 min-w-0 truncate px-1 text-[11px]" onClick={() => onPick(p.id)}>{label(p)}</BubbleButton>
      ))}
      {!showBench && props.bench.length ? <BubbleButton size="sm" tone="neutral" className="min-h-11 text-[11px]" onClick={() => setShowBench(true)}>Other Player</BubbleButton> : null}
    </div>
  );

  // Lower than recorded: remove/correct specific events (no negative points).
  if (diff < 0) {
    const list = [...events].reverse().filter((e) =>
      isScore
        ? eventPoints(e) > 0 && String(e.event_type).startsWith("OPP_") === opp
        : e.event_type === (opp ? "OPP_FOUL" : "FOUL") && props.inFoulWindow(e.quarter),
    );
    return (
      <Sheet title={title} onClose={props.onClose}>
        <Pill tone="flame">Remove {isScore ? `${-diff} point${diff === -1 ? "" : "s"}` : `${-diff} foul${diff === -1 ? "" : "s"}`} to reach {target}</Pill>
        <div className="flex max-h-[45dvh] flex-col gap-1 overflow-y-auto">
          {list.slice(0, 40).map((e) => {
            const pl = [...props.onFloor, ...props.bench].find((p) => p.id === e.player_id);
            return (
              <div key={e.id} className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border bg-surface-2/70 px-2 py-1">
                <Pill tone="muted">Q{e.quarter}</Pill>
                <span className="min-w-0 truncate text-xs font-bold">{pl ? `#${pl.jersey}` : opp ? "OPP" : "TEAM"} · {e.event_type}{isScore ? ` +${eventPoints(e)}` : ""}</span>
                <BubbleButton size="sm" tone="danger" className="min-h-11" onClick={() => props.onDelete(e.id)}>Remove</BubbleButton>
              </div>
            );
          })}
        </div>
        <BubbleButton tone="ghost" size="sm" className="min-h-11" onClick={() => setTarget(null)}>Go back</BubbleButton>
      </Sheet>
    );
  }

  // Higher than recorded: add the missing events.
  const source = `scoreboard_tile_${kind}`;
  if (isScore) {
    const needPlayer = kind === "us" && tracking.players;
    return (
      <Sheet title={title} onClose={props.onClose}>
        <Pill tone="flame">Missing {diff} point{diff === 1 ? "" : "s"} to reach {target}</Pill>
        {needPlayer ? (
          <>
            <Label>Who scored?</Label>
            {playerPicker(setScorer, scorer)}
          </>
        ) : null}
        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3].filter((v) => v <= diff).map((v) => (
            <BubbleButton key={v} size="md" tone="flame" className="min-h-12" disabled={needPlayer && !scorer} onClick={() => {
              const pid = needPlayer ? scorer : null;
              const ctx = { shot_value: v, correction_source: source, corrected_by: props.userId, corrected_at: new Date().toISOString() };
              if (v === 1) props.onAdd({ event_type: opp ? "OPP_FT_MADE" : "FT_MADE", player_id: pid, points: 1, result: "FT", context: ctx });
              else props.onAdd({ event_type: opp ? "OPP_MADE" : "MADE", player_id: pid, points: v, result: `${v}PT`, context: ctx });
              setScorer(null);
            }}>+{v}{v === 3 ? " 3PT" : v === 1 ? " FT" : ""}</BubbleButton>
          ))}
        </div>
        <BubbleButton size="sm" tone="neutral" className="min-h-11" onClick={() => { teamAdjustEvents(opp, diff, props.userId, source).forEach(props.onAdd); }}>
          Team-only adjustment +{diff}
        </BubbleButton>
        <BubbleButton tone="ghost" size="sm" className="min-h-11" onClick={() => setTarget(null)}>Go back</BubbleButton>
      </Sheet>
    );
  }

  const needFouler = !opp && tracking.players;
  const teamFoul = () => props.onAdd({ event_type: opp ? "OPP_FOUL" : "FOUL", context: correction(props.userId, source) });
  return (
    <Sheet title={title} onClose={props.onClose}>
      <Pill tone="flame">Missing {diff} foul{diff === 1 ? "" : "s"} to reach {target}</Pill>
      {needFouler ? (
        <>
          <Label>Who committed it?</Label>
          {playerPicker((id) => props.onAdd({ event_type: "FOUL", player_id: id, context: { correction_source: source, corrected_by: props.userId, corrected_at: new Date().toISOString() } }))}
        </>
      ) : null}
      <BubbleButton size="sm" tone={needFouler ? "neutral" : "flame"} className="min-h-11" onClick={teamFoul}>{needFouler ? "Team-only foul" : "+1 foul"}</BubbleButton>
      <BubbleButton tone="ghost" size="sm" className="min-h-11" onClick={() => setTarget(null)}>Go back</BubbleButton>
    </Sheet>
  );
}

/** Before final save: confirm the official scoreboard matches recorded plays. */
export function EndGameCheck(props: {
  teamScore: number;
  oppScore: number;
  userId: string | null;
  onAdd: (e: NewEvent) => void;
  onReconcile: (k: TileKind) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [us, setUs] = useState(String(props.teamScore));
  const [them, setThem] = useState(String(props.oppScore));
  const u = Math.max(0, Math.floor(Number(us) || 0));
  const o = Math.max(0, Math.floor(Number(them) || 0));
  const du = u - props.teamScore;
  const dO = o - props.oppScore;
  const mismatch = du !== 0 || dO !== 0;
  return (
    <Sheet title="Final scoreboard check" onClose={props.onClose}>
      <div className="grid grid-cols-2 gap-2">
        {([["Us", us, setUs, props.teamScore], ["Opp", them, setThem, props.oppScore]] as const).map(([l, v, set, rec]) => (
          <div key={l} className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface-2/60 p-2">
            <Label>{l} · scoreboard</Label>
            <NumberInput value={v} onChange={set} />
            <Pill tone="muted">Recorded {rec}</Pill>
          </div>
        ))}
      </div>
      {mismatch ? (
        <>
          <Pill tone="flame">Scoreboard differs from recorded plays</Pill>
          <BubbleButton size="sm" tone="grape" className="min-h-11" onClick={() => props.onReconcile(du !== 0 ? "us" : "opp")}>Add / fix scoring events</BubbleButton>
          <BubbleButton
            size="sm"
            tone="neutral"
            className={cn("min-h-11", (du < 0 || dO < 0) && "hidden")}
            onClick={() => {
              if (du > 0) teamAdjustEvents(false, du, props.userId, "end_game_reconcile").forEach(props.onAdd);
              if (dO > 0) teamAdjustEvents(true, dO, props.userId, "end_game_reconcile").forEach(props.onAdd);
              setTimeout(props.onConfirm, 60);
            }}
          >
            Team-only adjustment & save
          </BubbleButton>
          {du < 0 || dO < 0 ? <Pill tone="muted">Lower scores: remove the extra scoring events</Pill> : null}
          <BubbleButton size="sm" tone="ghost" className="min-h-11" onClick={props.onClose}>Go back</BubbleButton>
          <BubbleButton size="sm" tone="ghost" className="min-h-11" onClick={props.onConfirm}>Save with recorded score</BubbleButton>
        </>
      ) : (
        <BubbleButton size="lg" tone="danger" className="min-h-14" onClick={props.onConfirm}>End Game & Save</BubbleButton>
      )}
    </Sheet>
  );
}
