import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  Field,
  Heading,
  Label,
  Note,
  Panel,
  Pill,
  TextInput,
} from "@/components/Bubbles";
import { createPlay, fetchTeams } from "@/lib/data";
import { PLAY_CATEGORIES, type PlayCategory } from "@/lib/types";

const searchSchema = z.object({ category: z.string().optional() });

export const Route = createFileRoute("/_authenticated/plays/new")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Create a Play — CoachSide" },
      {
        name: "description",
        content:
          "Name a new play, file it in the right folder, pick the team and attack basket, then open the frame-by-frame designer.",
      },
      { property: "og:title", content: "Create a Play — CoachSide" },
      {
        property: "og:description",
        content: "Quick new-play flow that drops you straight into the play designer.",
      },
    ],
  }),
  component: CreatePlayPage,
});

const CATEGORY_HINT: Record<PlayCategory, string> = {
  Offense: "Half-court set, motion or quick hitter",
  BLOB: "Baseline out of bounds",
  SLOB: "Sideline out of bounds",
  Defense: "Half-court defensive scheme",
  "Press Break": "Breaking full-court pressure",
  Presses: "Full-court press — both teams are placed on the floor",
};

function isCategory(v: string | undefined): v is PlayCategory {
  return !!v && (PLAY_CATEGORIES as readonly string[]).includes(v);
}

function CreatePlayPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });

  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlayCategory>(
    isCategory(search.category) ? search.category : "Offense",
  );
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [basket, setBasket] = useState<"left" | "right">("right");

  useEffect(() => {
    if (!teamIds.length && teams.data?.length) setTeamIds([teams.data[0]!.id]);
  }, [teams.data, teamIds.length]);

  const toggleTeam = (id: string) =>
    setTeamIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const create = useMutation({
    mutationFn: () =>
      createPlay({
        team_id: teamIds[0] ?? null,
        name: name.trim(),
        category,
        attack_basket: basket,
        team_ids: teamIds,
      }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ["plays"] });
      void queryClient.invalidateQueries({ queryKey: ["play-assignments"] });
      toast.success("Play created — opening the designer");
      navigate({ to: "/plays/$playId", params: { playId: p.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = name.trim().length > 0 && teamIds.length > 0;


  return (
    <AppShell
      title="Create a Play"
      subtitle="Name it, file it, then draw it"
      actions={
        <Link to="/plays">
          <BubbleButton size="sm" tone="ghost">
            Playbook
          </BubbleButton>
        </Link>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Panel className="flex flex-col gap-4">
          <Heading>New play</Heading>
          <Field label="Play name">
            <TextInput
              autoFocus
              placeholder="e.g. Horns Flare, Box 1, 1-2-1-1 Diamond"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ready) create.mutate();
              }}
            />
          </Field>

          <Field label="Folder">
            <div className="flex flex-wrap gap-2">
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
            </div>
            <Note>{CATEGORY_HINT[category]}</Note>
          </Field>

          <Field label="Team">
            <div className="flex flex-wrap gap-2">
              {teams.data?.map((t) => (
                <BubbleButton
                  key={t.id}
                  size="sm"
                  tone={teamId === t.id ? "grape" : "neutral"}
                  onClick={() => setTeamId(t.id)}
                >
                  {t.name}
                </BubbleButton>
              ))}
              {teams.isLoading ? <Pill tone="muted">Loading teams…</Pill> : null}
            </div>
          </Field>

          <Field label="Attack basket">
            <div className="flex flex-wrap gap-2">
              <BubbleButton
                size="sm"
                tone={basket === "right" ? "flame" : "neutral"}
                onClick={() => setBasket("right")}
              >
                Attack right →
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone={basket === "left" ? "flame" : "neutral"}
                onClick={() => setBasket("left")}
              >
                ← Attack left
              </BubbleButton>
            </div>
          </Field>

          <BubbleButton
            tone="flame"
            size="lg"
            disabled={!ready || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating…" : "Create & open designer"}
          </BubbleButton>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <Label>What happens next</Label>
          <Note tone="grape">
            The designer opens with five offensive players placed. Drag players, then drag
            to draw actions frame by frame.
          </Note>
          <div className="flex flex-col gap-2">
            <Pill tone="neutral">Dotted arrow = pass</Pill>
            <Pill tone="neutral">Solid arrow = cut / movement</Pill>
            <Pill tone="neutral">Curved arrow = curl cut</Pill>
            <Pill tone="neutral">Bumpy line = dribble</Pill>
            <Pill tone="neutral">Bar end = screen</Pill>
            <Pill tone="flame">Presses: add the defense (X1–X5) from the Press Maker panel</Pill>
          </div>
          <Note>You can flip the attack basket at any time inside the designer.</Note>
        </Panel>
      </div>
    </AppShell>
  );
}
