import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BubbleButton, EmptyState, Label, Panel, Pill, TextInput } from "@/components/Bubbles";
import {
  addCoachNote,
  deleteCoachNote,
  fetchCoachNotes,
  setCoachNoteDone,
  type CoachNote,
} from "@/lib/notes";

/** Lightweight private checklist for the signed-in coach. */
export function CoachNotes() {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const notes = useQuery({ queryKey: ["coach-notes"], queryFn: fetchCoachNotes });

  const refresh = () => qc.invalidateQueries({ queryKey: ["coach-notes"] });

  const add = useMutation({
    mutationFn: (text: string) => addCoachNote(text),
    onSuccess: () => {
      setBody("");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (n: CoachNote) => setCoachNoteDone(n.id, !n.completed),
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (n: CoachNote) => deleteCoachNote(n.id),
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = notes.data ?? [];
  const open = rows.filter((n) => !n.completed);
  const done = rows.filter((n) => n.completed).slice(0, 4);

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label>Coach notes</Label>
        <Pill tone="muted">{open.length} open</Pill>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate(body);
        }}
      >
        <TextInput
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add an action item…"
          aria-label="New coach note"
          className="min-w-0 flex-1"
        />
        <BubbleButton type="submit" tone="grape" disabled={!body.trim() || add.isPending}>
          Add
        </BubbleButton>
      </form>

      {!rows.length ? (
        <EmptyState>Nothing on your list yet</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...open, ...done].map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/70 p-2"
            >
              <BubbleButton
                size="sm"
                tone={n.completed ? "grape" : "neutral"}
                aria-label={n.completed ? "Mark not done" : "Mark complete"}
                onClick={() => toggle.mutate(n)}
              >
                {n.completed ? "✓" : "○"}
              </BubbleButton>
              <span
                className={
                  n.completed
                    ? "min-w-0 flex-1 rounded-2xl border border-border/50 bg-surface/70 px-3 py-2 text-sm font-semibold text-muted-foreground line-through"
                    : "min-w-0 flex-1 rounded-2xl border border-border/60 bg-surface/80 px-3 py-2 text-sm font-bold text-foreground"
                }
              >
                {n.body}
              </span>
              <BubbleButton
                size="sm"
                tone="ghost"
                aria-label={`Delete note ${n.body}`}
                onClick={() => remove.mutate(n)}
              >
                Delete
              </BubbleButton>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
