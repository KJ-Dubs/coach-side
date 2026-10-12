import { useEffect, useState, type CSSProperties } from "react";
import { BubbleButton, Field, Note, TextInput } from "@/components/Bubbles";
import { defaultPickerColors, normalizeHex, similarColors, teamThemeVariables } from "@/lib/teamTheme";

export function TeamColorFields({ primary, secondary, onPrimary, onSecondary, teamName }: {
  primary: string; secondary: string; onPrimary: (color: string) => void; onSecondary: (color: string) => void; teamName: string;
}) {
  const [defaults, setDefaults] = useState<[string, string]>(["", ""]);
  useEffect(() => setDefaults(defaultPickerColors()), []);
  const vars = teamThemeVariables({ primary_color: primary, secondary_color: secondary });
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="grid gap-3 sm:grid-cols-2">
      {[["Primary team color", primary, onPrimary, defaults[0]], ["Secondary team color", secondary, onSecondary, defaults[1]]].map(([label, value, change, fallback]) => {
        const name = String(label), input = String(value), update = change as (color: string) => void;
        return <Field key={name} label={name}><div className="flex min-w-0 gap-2">
          {fallback ? <input type="color" aria-label={`${name} picker`} value={normalizeHex(input) ?? String(fallback)} onChange={(e) => update(e.target.value.toUpperCase())} className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-surface-2 p-1" /> : null}
          <TextInput aria-label={`${name} hex`} placeholder={String(fallback)} value={input} maxLength={7} onChange={(e) => update(e.target.value)} aria-invalid={!!input && !normalizeHex(input)} className="min-w-0 flex-1" />
        </div>{input && !normalizeHex(input) ? <Note tone="danger">Use a hex color such as #1D4ED8.</Note> : null}</Field>;
      })}
    </div>
    {similarColors(primary || defaults[0], secondary || defaults[1]) ? <Note>These colors are similar. You can still save them.</Note> : null}
    <div style={vars as CSSProperties} className="team-color-preview flex flex-wrap items-center justify-center gap-2 rounded-xl border border-grape/50 bg-surface-2 p-3" aria-label="Team color preview">
      <span className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-center font-black text-foreground">{teamName}</span>
      <BubbleButton tone="grape" tabIndex={-1}>Primary</BubbleButton><BubbleButton tone="flame" tabIndex={-1}>Secondary</BubbleButton>
    </div>
  </div>;
}