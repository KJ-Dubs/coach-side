import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, InfoList, Label, Note, Panel, Pill, TextInput } from "@/components/Bubbles";
import { HELP_SECTIONS, SUPPORT_EMAIL } from "@/lib/helpContent";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "CoachSide Help & FAQ" },
      { name: "description", content: "How to get the most from Playmaker, Live Game, Locker Room, Practice Planner and more." },
      { property: "og:title", content: "CoachSide Help & FAQ" },
      { property: "og:description", content: "Real basketball use cases and quick steps for every CoachSide feature." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return HELP_SECTIONS;
    return HELP_SECTIONS.filter((s) =>
      [s.title, s.what, s.when, ...s.useCases, ...s.steps, ...(s.faq ?? []).flatMap((f) => [f.q, f.a])]
        .join(" ")
        .toLowerCase()
        .includes(t),
    );
  }, [q]);

  return (
    <AppShell title="CoachSide Help" subtitle="Get the most out of your CoachSide account" backTo="/dashboard" backLabel="Home">
      <Panel className="mb-3 flex flex-col gap-2">
        <Label>Search help</Label>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “press break”, “QR”, “push”…" />
        <div className="flex flex-wrap gap-2">
          {HELP_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              <Pill tone="muted">{s.title}</Pill>
            </a>
          ))}
        </div>
      </Panel>

      {list.length === 0 ? <EmptyState>No matches — email {SUPPORT_EMAIL}</EmptyState> : null}

      {list.map((s) => (
        <Panel key={s.id} id={s.id} className="mb-3 flex scroll-mt-24 flex-col gap-3">
          <Label>{s.title}</Label>
          <Note tone="grape">{s.what}</Note>
          <Note>When to use it: {s.when}</Note>
          <InfoList items={s.useCases} tone="flame" />
          <div className="flex flex-col gap-1">
            <Pill tone="neutral" className="w-fit">Quick steps</Pill>
            <InfoList items={s.steps.map((x, i) => `${i + 1}. ${x}`)} />
          </div>
          {s.faq?.map((f) => (
            <div key={f.q} className="rounded-2xl border border-border bg-surface-2/60 p-3">
              <span className="block text-sm font-black text-foreground">{f.q}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{f.a}</span>
            </div>
          ))}
        </Panel>
      ))}

      <Panel className="flex flex-wrap items-center justify-center gap-2">
        <Label>Contact support</Label>
        <a href={`mailto:${SUPPORT_EMAIL}`}>
          <Pill tone="grape">{SUPPORT_EMAIL}</Pill>
        </a>
      </Panel>
    </AppShell>
  );
}
