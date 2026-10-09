import { useState } from "react";
import { BubbleButton, Label, Panel, Pill, TextInput } from "@/components/Bubbles";
import {
  CONCEPTS,
  DEFENSES,
  OUTCOMES,
  PRIMARY_ACTIONS,
  TIME_PRESSURE,
  type PlayIndex,
} from "@/lib/playIndex";

type Suggestions = { actions: string[]; outcomes: string[]; tags: string[] };

/**
 * Fast multi-select index sheet. CoachSide suggestions from the drawing are
 * additive only — they never replace the coach's own picks.
 */
export function PlayIndexSheet({
  value,
  onChange,
  suggestions,
  compact,
}: {
  value: PlayIndex;
  onChange: (next: PlayIndex) => void;
  suggestions?: Suggestions | undefined;
  compact?: boolean;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const set = (patch: Partial<PlayIndex>) => onChange({ ...value, ...patch });
  const toggle = (key: "concepts" | "defenses" | "outcomes" | "primary_actions", v: string) =>
    set({ [key]: value[key].includes(v) ? value[key].filter((x) => x !== v) : [...value[key], v] });

  const addTag = (t: string) => {
    const clean = t.trim().toLowerCase();
    if (!clean || value.tags.includes(clean)) return;
    set({ tags: [...value.tags, clean] });
  };

  const sugActions = (suggestions?.actions ?? []).filter((a) => !value.primary_actions.includes(a));
  const sugOutcomes = (suggestions?.outcomes ?? []).filter((a) => !value.outcomes.includes(a));
  const sugTags = (suggestions?.tags ?? []).filter((t) => !value.tags.includes(t));

  // Keep legacy picks (e.g. Handoff) visible and removable without offering them as new choices.
  const withLegacy = (opts: readonly string[], picked: string[]) => [
    ...opts,
    ...picked.filter((p) => !opts.includes(p)),
  ];

  return (
    <Panel className={compact ? "flex flex-col gap-2.5 p-3" : "flex flex-col gap-3"}>
      <h3 className="text-center text-lg font-black leading-tight text-foreground">Index this play</h3>
      <Multi label="Play concepts" options={withLegacy(CONCEPTS, value.concepts)} picked={value.concepts} onToggle={(v) => toggle("concepts", v)} />
      <Multi label="Defense faced" options={withLegacy(DEFENSES, value.defenses)} picked={value.defenses} onToggle={(v) => toggle("defenses", v)} />
      <Multi
        label="Intended outcomes"
        options={withLegacy(OUTCOMES, value.outcomes)}
        picked={value.outcomes}
        onToggle={(v) => toggle("outcomes", v)}
        suggested={sugOutcomes}
      />
      <Multi
        label="Primary actions"
        options={withLegacy(PRIMARY_ACTIONS, value.primary_actions)}
        picked={value.primary_actions}
        onToggle={(v) => toggle("primary_actions", v)}
        suggested={sugActions}
      />
      <div className="flex flex-col gap-1">
        <Label>Time pressure</Label>
        <div className="flex flex-wrap gap-1.5">
          {TIME_PRESSURE.map((o) => (
            <Chip key={o} on={value.time_pressure === o} onClick={() => set({ time_pressure: value.time_pressure === o ? null : o })}>
              {o}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label>Tags</Label>
        {value.tags.length || sugTags.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {value.tags.map((t) => (
              <button key={t} type="button" onClick={() => set({ tags: value.tags.filter((x) => x !== t) })}>
                <Pill tone="grape">{t} ✕</Pill>
              </button>
            ))}
            {sugTags.map((t) => (
              <Chip key={t} on={false} suggested onClick={() => addTag(t)}>
                + {t}
              </Chip>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <TextInput
            placeholder="Add a tag"
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
          <BubbleButton size="sm" tone="neutral" onClick={() => { addTag(tagDraft); setTagDraft(""); }}>
            Add
          </BubbleButton>
        </div>
      </div>
    </Panel>
  );
}

function Chip({
  on,
  suggested,
  onClick,
  children,
}: {
  on: boolean;
  suggested?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        "min-h-9 rounded-full border px-3 text-xs font-bold transition-colors " +
        (on
          ? "border-grape bg-grape text-primary-foreground"
          : suggested
            ? "border-dashed border-flame/70 bg-flame/10 text-flame"
            : "border-border bg-surface-2/70 text-foreground hover:border-grape/60")
      }
    >
      {on ? "✓ " : ""}
      {children}
    </button>
  );
}

function Multi({
  label,
  options,
  picked,
  onToggle,
  suggested = [],
}: {
  label: string;
  options: readonly string[];
  picked: string[];
  onToggle: (v: string) => void;
  suggested?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o} on={picked.includes(o)} suggested={suggested.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </Chip>
        ))}
        {suggested
          .filter((s) => !options.includes(s))
          .map((s) => (
            <Chip key={s} on={false} suggested onClick={() => onToggle(s)}>
              + {s}
            </Chip>
          ))}
      </div>
    </div>
  );
}
