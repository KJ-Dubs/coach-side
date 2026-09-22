import { useState } from "react";
import { BubbleButton, InfoPanel, Label, Panel, Pill, TextInput } from "@/components/Bubbles";
import {
  DEFENSES,
  OUTCOMES,
  PRIMARY_ACTIONS,
  SITUATIONS,
  TIME_PRESSURE,
  type PlayIndex,
} from "@/lib/playIndex";

/**
 * The short "what is this play for?" sheet. Coaches answer in taps, and any
 * suggestion CoachSide reads from the drawing is clearly marked as a suggestion
 * that the coach's own answer overrides.
 */
export function PlayIndexSheet({
  value,
  onChange,
  suggestions,
  compact,
}: {
  value: PlayIndex;
  onChange: (next: PlayIndex) => void;
  suggestions?: { actions: string[]; outcome: string | null; tags: string[] } | undefined;
  compact?: boolean;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const set = (patch: Partial<PlayIndex>) => onChange({ ...value, ...patch });

  const toggleAction = (a: string) =>
    set({
      primary_actions: value.primary_actions.includes(a)
        ? value.primary_actions.filter((x) => x !== a)
        : [...value.primary_actions, a],
    });

  const addTag = (t: string) => {
    const clean = t.trim().toLowerCase();
    if (!clean || value.tags.includes(clean)) return;
    set({ tags: [...value.tags, clean] });
  };

  const suggestedActions = (suggestions?.actions ?? []).filter(
    (a) => !value.primary_actions.includes(a),
  );
  const suggestedTags = (suggestions?.tags ?? []).filter((t) => !value.tags.includes(t));
  const suggestOutcome = suggestions?.outcome && !value.outcome ? suggestions.outcome : null;

  return (
    <Panel className={compact ? "flex flex-col gap-3 p-3" : "flex flex-col gap-4"}>
      <div className="text-center">
        <h3 className="text-xl font-black leading-tight text-foreground">Index this play</h3>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          A few taps now makes this play findable later.
        </p>
      </div>

      <Choice
        label="Situation"
        options={SITUATIONS as readonly string[]}
        value={value.situation}
        onPick={(v) => set({ situation: v })}
      />
      <Choice
        label="Defense faced"
        options={DEFENSES as readonly string[]}
        value={value.defense_faced}
        onPick={(v) => set({ defense_faced: v })}
      />
      <Choice
        label="Intended outcome"
        options={OUTCOMES as readonly string[]}
        value={value.outcome}
        onPick={(v) => set({ outcome: v })}
      />
      {suggestOutcome ? (
        <InfoPanel tone="flame">
          CoachSide suggests <strong>{suggestOutcome}</strong> from the drawing.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => set({ outcome: suggestOutcome })}
          >
            Use it
          </button>
        </InfoPanel>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label>Primary actions</Label>
        <div className="flex flex-wrap justify-center gap-2">
          {PRIMARY_ACTIONS.map((a) => (
            <BubbleButton
              key={a}
              size="sm"
              tone={value.primary_actions.includes(a) ? "grape" : "neutral"}
              onClick={() => toggleAction(a)}
            >
              {value.primary_actions.includes(a) ? "✓ " : ""}
              {a}
            </BubbleButton>
          ))}
        </div>
        {suggestedActions.length ? (
          <InfoPanel tone="flame">
            <div className="flex flex-wrap items-center gap-2">
              <span>CoachSide suggests:</span>
              {suggestedActions.map((a) => (
                <BubbleButton key={a} size="sm" tone="neutral" onClick={() => toggleAction(a)}>
                  + {a}
                </BubbleButton>
              ))}
            </div>
          </InfoPanel>
        ) : null}
      </div>

      <Choice
        label="Time pressure"
        options={TIME_PRESSURE as readonly string[]}
        value={value.time_pressure}
        onPick={(v) => set({ time_pressure: v })}
      />

      <div className="flex flex-col gap-1.5">
        <Label>Tags</Label>
        <div className="flex flex-wrap items-center gap-2">
          {value.tags.map((t) => (
            <button key={t} type="button" onClick={() => set({ tags: value.tags.filter((x) => x !== t) })}>
              <Pill tone="grape">{t} ✕</Pill>
            </button>
          ))}
          {!value.tags.length ? <Pill tone="muted">No tags yet</Pill> : null}
        </div>
        <div className="flex gap-2">
          <TextInput
            placeholder="Add a tag, e.g. horns"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(tagDraft);
                setTagDraft("");
              }
            }}
          />
          <BubbleButton
            size="sm"
            tone="neutral"
            onClick={() => {
              addTag(tagDraft);
              setTagDraft("");
            }}
          >
            Add
          </BubbleButton>
        </div>
        {suggestedTags.length ? (
          <InfoPanel tone="flame">
            <div className="flex flex-wrap items-center gap-2">
              <span>CoachSide suggests:</span>
              {suggestedTags.map((t) => (
                <BubbleButton key={t} size="sm" tone="neutral" onClick={() => addTag(t)}>
                  + {t}
                </BubbleButton>
              ))}
            </div>
          </InfoPanel>
        ) : null}
      </div>
    </Panel>
  );
}

function Choice({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onPick: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((o) => (
          <BubbleButton
            key={o}
            size="sm"
            tone={value === o ? "grape" : "neutral"}
            onClick={() => onPick(value === o ? null : o)}
          >
            {o}
          </BubbleButton>
        ))}
      </div>
    </div>
  );
}
