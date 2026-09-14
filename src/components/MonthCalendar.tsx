import { useMemo } from "react";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { cn } from "@/lib/utils";

export type MonthDot = "flame" | "grape" | "neutral";

export function dayKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Simple month grid: marks days that have events and reports the tapped day. */
export function MonthCalendar({
  month,
  onMonthChange,
  marks,
  selected,
  onSelect,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  /** dayKey -> tones of the events on that day */
  marks: Map<string, MonthDot[]>;
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const todayKey = dayKey(new Date());

  return (
    <Panel className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <BubbleButton
          size="sm"
          tone="neutral"
          aria-label="Previous month"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          ◀
        </BubbleButton>
        <span className="rounded-2xl border border-grape/60 bg-grape/20 px-4 py-2 text-lg font-black text-foreground">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <BubbleButton
          size="sm"
          tone="neutral"
          aria-label="Next month"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          ▶
        </BubbleButton>
        <BubbleButton
          size="sm"
          tone="ghost"
          className="ml-auto"
          onClick={() => {
            const now = new Date();
            onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
            onSelect(dayKey(now));
          }}
        >
          Today
        </BubbleButton>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <Label key={`${w}${i}`} className="justify-center px-0 py-1 text-[10px]">
            {w}
          </Label>
        ))}
        {cells.map((d) => {
          const key = dayKey(d);
          const dots = marks.get(key) ?? [];
          const inMonth = d.getMonth() === month.getMonth();
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={d.toDateString()}
              aria-pressed={selected === key}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-bold transition-colors",
                inMonth
                  ? "border-border/70 bg-surface-2/70 text-foreground"
                  : "border-border/40 bg-surface/40 text-muted-foreground",
                key === todayKey && "border-flame/70",
                selected === key && "border-grape bg-grape/25",
              )}
            >
              <span>{d.getDate()}</span>
              <span className="flex h-1.5 items-center gap-0.5">
                {dots.slice(0, 3).map((t, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      t === "flame" && "bg-flame",
                      t === "grape" && "bg-grape",
                      t === "neutral" && "bg-muted-foreground",
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="flame">Games</Pill>
        <Pill tone="grape">Practices</Pill>
        <Pill tone="muted">Team events</Pill>
      </div>
    </Panel>
  );
}
