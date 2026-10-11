import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { BubbleButton, Label, Panel, TextInput } from "@/components/Bubbles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DISCOVERY_FILTERS, DISCOVERY_SECTIONS, SORTS, type SortKey } from "@/lib/playbookFilters";

export function DiscoveryBar({ query, onQuery, sort, onSort, selected, onToggle, onClear, counts, total, results }: {
  query: string; onQuery: (value: string) => void;
  sort: SortKey; onSort: (value: SortKey) => void;
  selected: string[]; onToggle: (key: string) => void; onClear: () => void;
  counts: Map<string, number>; total: number; results: number;
}) {
  const [open, setOpen] = useState(false);
  const labels = DISCOVERY_FILTERS.filter((f) => selected.includes(f.key)).map((f) => f.label).join(" · ");
  return (
    <Panel className="flex min-w-0 flex-col gap-2 p-3" aria-label="Playbook search and filters">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <TextInput type="search" aria-label="Search plays" placeholder="Search plays..." value={query}
          onChange={(e) => onQuery(e.target.value)} className="col-span-2 min-w-0 sm:col-span-1" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <BubbleButton size="sm" tone={selected.length ? "grape" : "neutral"} className="shrink-0">
              Filters{selected.length ? ` (${selected.length})` : ""}<ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            </BubbleButton>
          </PopoverTrigger>
          <PopoverContent align="start" collisionPadding={12} className="flex w-96 max-w-[calc(100vw-24px)] flex-col gap-3 rounded-2xl border-grape/50 bg-surface p-3" aria-label="Playbook filters">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border pb-2">
              <Label>Filters ({selected.length})</Label>
              <BubbleButton size="sm" tone="ghost" disabled={!selected.length} onClick={onClear}>Clear</BubbleButton>
              <BubbleButton size="sm" tone="flame" onClick={() => setOpen(false)}>Done</BubbleButton>
            </div>
            <div className="max-h-[min(60dvh,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain">
              {DISCOVERY_SECTIONS.map((section) => (
                <section key={section.label} className="mb-3 last:mb-0" aria-label={section.label}>
                  <Label className="mb-2">{section.label}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {section.choices.map((f) => {
                      const checked = selected.includes(f.key);
                      return <BubbleButton key={f.key} size="sm" tone={checked ? "grape" : "neutral"}
                        role="checkbox" aria-checked={checked} aria-label={f.label} onClick={() => onToggle(f.key)}
                        className="min-w-0 justify-start rounded-lg px-2 text-left tracking-normal shadow-none">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-border" aria-hidden>
                          {checked ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 break-words">{f.label}</span>
                        {f.category ? <span className="shrink-0 text-muted-foreground">{counts.get(f.category) ?? 0}</span> : null}
                      </BubbleButton>;
                    })}
                  </div>
                </section>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <select aria-label="Sort plays" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}
          className="min-h-11 min-w-0 shrink-0 rounded-full border border-border bg-surface-2 px-3 text-xs font-bold text-foreground focus:border-grape focus:outline-none">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      {selected.length ? <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-2">
        <p className="line-clamp-2 min-w-0 text-xs font-semibold text-foreground" title={labels}>
          Filters ({selected.length}) · {labels}
        </p>
        <BubbleButton size="sm" tone="ghost" className="shrink-0 border-transparent bg-transparent shadow-none" onClick={onClear}>Clear</BubbleButton>
      </div> : null}
      <div className="rounded-lg bg-surface-2/60 px-2 py-1 text-xs font-semibold text-muted-foreground" role="status">
        {results} of {total} {total === 1 ? "play" : "plays"}
      </div>
    </Panel>
  );
}