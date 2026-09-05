import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { DEMO_TEAM_ID, createPlay, fetchPlays, updatePlay } from "@/lib/data";
import { PLAY_CATEGORIES, type Play } from "@/lib/types";

export const Route = createFileRoute("/plays/")({
  head: () => ({
    meta: [
      { title: "Playbook — CourtFlow Coach" },
      {
        name: "description",
        content:
          "Design frame-by-frame basketball plays and share phone-friendly playbooks with your players.",
      },
      { property: "og:title", content: "Playbook — CourtFlow Coach" },
      {
        property: "og:description",
        content: "Frame-by-frame play design and shareable player playbooks.",
      },
    ],
  }),
  component: PlaysPage,
});

function PlaysPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const plays = useQuery({ queryKey: ["plays"], queryFn: fetchPlays });
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Offense");

  const create = useMutation({
    mutationFn: () => createPlay({ team_id: DEMO_TEAM_ID, name, category }),
    onSuccess: (p) => navigate({ to: "/plays/$playId", params: { playId: p.id } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleShare = useMutation({
    mutationFn: (p: Play) => updatePlay(p.id, { is_shared: !p.is_shared }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plays"] }),
  });

  const shareUrl = (p: Play) =>
    typeof window === "undefined" ? "" : `${window.location.origin}/share/${p.share_token}`;

  return (
    <AppShell
      title="Playbook"
      subtitle="Offense, BLOB, SLOB and Press Break"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-2xl border border-input bg-surface-2/70 px-4 py-2 text-sm font-semibold outline-none focus:border-grape"
            placeholder="New play name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {PLAY_CATEGORIES.map((c) => (
            <BubbleButton
              key={c}
              size="sm"
              tone={category === c ? "grape" : "neutral"}
              onClick={() => setCategory(c)}
            >
              {c}
            </BubbleButton>
          ))}
          <BubbleButton tone="flame" size="sm" disabled={!name} onClick={() => create.mutate()}>
            + Create
          </BubbleButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {PLAY_CATEGORIES.map((cat) => {
          const list = plays.data?.filter((p) => p.category === cat) ?? [];
          return (
            <Panel key={cat} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label>{cat}</Label>
                <Pill tone="muted">{list.length}</Pill>
              </div>
              {list.length === 0 ? (
                <Pill tone="muted">No plays in this category yet</Pill>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-2/70 p-3"
                    >
                      <span className="rounded-xl bg-surface/70 px-3 py-1.5 text-sm font-black">
                        {p.name}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Link to="/plays/$playId" params={{ playId: p.id }}>
                          <BubbleButton size="sm" tone="grape">
                            Design
                          </BubbleButton>
                        </Link>
                        <Link to="/plays/$playId/view" params={{ playId: p.id }}>
                          <BubbleButton size="sm" tone="neutral">
                            Slideshow
                          </BubbleButton>
                        </Link>
                        <BubbleButton
                          size="sm"
                          tone={p.is_shared ? "flame" : "ghost"}
                          onClick={() => toggleShare.mutate(p)}
                        >
                          {p.is_shared ? "Shared" : "Private"}
                        </BubbleButton>
                        {p.is_shared ? (
                          <BubbleButton
                            size="sm"
                            tone="ghost"
                            onClick={() => {
                              void navigator.clipboard.writeText(shareUrl(p));
                              toast.success("Share link copied");
                            }}
                          >
                            Copy link
                          </BubbleButton>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}
