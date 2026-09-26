import { useState } from "react";
import { BubbleButton, Label, Pill } from "@/components/Bubbles";
import { formatClock, zoneOf } from "@/lib/court";
import { shotValueOf } from "@/lib/stats";
import type { GameEvent, Player } from "@/lib/types";

type Kind = "SHOT" | "FT" | "REBOUND" | "ASSIST" | "STEAL" | "TURNOVER" | "BLOCK" | "FOUL" | "OTHER";
const US_KINDS: Kind[] = ["SHOT", "FT", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL"];
const OPP_KINDS: Kind[] = ["SHOT", "FT", "REBOUND", "TURNOVER", "FOUL"];
const KIND_LABEL: Record<Kind, string> = {
  SHOT: "Field goal",
  FT: "Free throw",
  REBOUND: "Rebound",
  ASSIST: "Assist",
  STEAL: "Steal",
  TURNOVER: "Turnover",
  BLOCK: "Block",
  FOUL: "Foul",
  OTHER: "Other",
};

function initial(e: GameEvent) {
  const t = String(e.event_type);
  const opp = t.startsWith("OPP_");
  const base = opp ? t.slice(4) : t;
  let kind: Kind = "OTHER";
  let made = false;
  let value: 1 | 2 | 3 = 2;
  if (base === "MADE" || base === "MISS") {
    kind = "SHOT";
    made = base === "MADE";
    value = shotValueOf(e);
  } else if (base === "FT_MADE" || base === "FT_MISS") {
    kind = "FT";
    made = base === "FT_MADE";
    value = 1;
  } else if (base === "SCORE") {
    made = true;
    value = Math.max(1, Math.min(3, e.points || 1)) as 1 | 2 | 3;
    kind = value === 1 ? "FT" : "SHOT";
  } else if ((US_KINDS as string[]).includes(base)) kind = base as Kind;
  return { opp, kind, made, value };
}

/** Correct or delete a submitted event. Totals re-derive from the saved event. */
export function EventEditor({
  event,
  roster,
  picking,
  onPickLocation,
  onSave,
  onDelete,
  onClose,
}: {
  event: GameEvent;
  roster: Player[];
  picking: boolean;
  onPickLocation: () => void;
  onSave: (patch: Partial<GameEvent>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const init = initial(event);
  const [opp, setOpp] = useState(init.opp);
  const [kind, setKind] = useState<Kind>(init.kind);
  const [made, setMade] = useState(init.made);
  const [value, setValue] = useState<1 | 2 | 3>(init.value);
  const [playerId, setPlayerId] = useState<string | null>(event.player_id);
  const [reb, setReb] = useState<"OFF" | "DEF">(event.result === "OFF" ? "OFF" : "DEF");
  const [quarter, setQuarter] = useState(event.quarter);
  const [clock, setClock] = useState(formatClock(event.clock_seconds));

  const kinds = opp ? OPP_KINDS : US_KINDS;
  const scoring = kind === "SHOT" || kind === "FT";

  const save = () => {
    if (kind === "OTHER") return onClose();
    const [m, sec] = clock.split(":").map((n) => parseInt(n, 10));
    const clockSeconds = Number.isFinite(m) ? m * 60 + (Number.isFinite(sec) ? sec : 0) : event.clock_seconds;
    let type: string;
    let points = 0;
    let result: string | null = null;
    const context: Record<string, unknown> = { ...(event.context ?? {}) };
    delete context.shot_value;
    if (kind === "SHOT") {
      type = made ? "MADE" : "MISS";
      const v = value === 3 ? 3 : 2;
      points = made ? v : 0;
      result = `${v}PT`;
      context.shot_value = v;
    } else if (kind === "FT") {
      type = made ? "FT_MADE" : "FT_MISS";
      points = made ? 1 : 0;
      result = "FT";
    } else if (kind === "REBOUND") {
      type = "REBOUND";
      result = reb;
    } else {
      type = kind;
      result = init.kind === kind ? event.result : null;
    }
    const patch: Partial<GameEvent> = {
      event_type: opp ? `OPP_${type}` : type,
      player_id: opp ? null : playerId,
      points,
      result,
      context,
      quarter,
      clock_seconds: clockSeconds,
    };
    if (kind === "SHOT" && event.x != null && event.y != null) patch.zone = zoneOf(event.x, event.y);
    onSave(patch);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-flame/60 bg-surface-2/80 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label>Edit event</Label>
        <BubbleButton size="sm" tone={!opp ? "grape" : "neutral"} onClick={() => setOpp(false)}>
          US
        </BubbleButton>
        <BubbleButton
          size="sm"
          tone={opp ? "flame" : "neutral"}
          onClick={() => {
            setOpp(true);
            if (!OPP_KINDS.includes(kind)) setKind("SHOT");
          }}
        >
          OPP
        </BubbleButton>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <BubbleButton key={k} size="sm" tone={kind === k ? "grape" : "neutral"} onClick={() => {
            setKind(k);
            if (k === "FT") setValue(1);
            if (k === "SHOT" && value === 1) setValue(2);
          }}>
            {KIND_LABEL[k]}
          </BubbleButton>
        ))}
      </div>
      {scoring ? (
        <div className="flex flex-wrap gap-1.5">
          <BubbleButton size="sm" tone={made ? "flame" : "neutral"} onClick={() => setMade(true)}>
            Made
          </BubbleButton>
          <BubbleButton size="sm" tone={!made ? "grape" : "neutral"} onClick={() => setMade(false)}>
            Missed
          </BubbleButton>
          {([1, 2, 3] as const).map((v) => (
            <BubbleButton
              key={v}
              size="sm"
              tone={value === v ? "flame" : "neutral"}
              onClick={() => {
                setValue(v);
                setKind(v === 1 ? "FT" : "SHOT");
              }}
            >
              {v} PT
            </BubbleButton>
          ))}
        </div>
      ) : null}
      {kind === "REBOUND" ? (
        <div className="flex flex-wrap gap-1.5">
          <BubbleButton size="sm" tone={reb === "OFF" ? "flame" : "neutral"} onClick={() => setReb("OFF")}>
            Offensive
          </BubbleButton>
          <BubbleButton size="sm" tone={reb === "DEF" ? "grape" : "neutral"} onClick={() => setReb("DEF")}>
            Defensive
          </BubbleButton>
        </div>
      ) : null}
      {!opp ? (
        <div className="flex flex-wrap gap-1.5">
          <Pill tone="muted">Player</Pill>
          {roster.map((p) => (
            <BubbleButton key={p.id} size="sm" tone={playerId === p.id ? "grape" : "ghost"} onClick={() => setPlayerId(p.id)}>
              #{p.jersey}
            </BubbleButton>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <BubbleButton size="sm" tone="neutral" onClick={() => setQuarter((q) => Math.max(1, q - 1))}>
          −
        </BubbleButton>
        <Pill tone="neutral">Q{quarter}</Pill>
        <BubbleButton size="sm" tone="neutral" onClick={() => setQuarter((q) => q + 1)}>
          +
        </BubbleButton>
        <input
          aria-label="Game clock"
          value={clock}
          onChange={(e) => setClock(e.target.value)}
          className="w-20 rounded-full border border-border bg-surface px-3 py-2 text-sm font-bold text-foreground"
        />
        {event.x != null || kind === "SHOT" ? (
          <BubbleButton size="sm" tone={picking ? "flame" : "neutral"} onClick={onPickLocation}>
            {picking ? "Tap the court…" : "Move spot"}
          </BubbleButton>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <BubbleButton size="lg" tone="grape" className="flex-1" onClick={save}>
          Save
        </BubbleButton>
        <BubbleButton size="lg" tone="danger" onClick={onDelete}>
          Delete event
        </BubbleButton>
        <BubbleButton size="sm" tone="ghost" onClick={onClose}>
          Cancel
        </BubbleButton>
      </div>
    </div>
  );
}
