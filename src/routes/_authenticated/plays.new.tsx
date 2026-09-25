import { TipInterstitial } from "@/components/TipInterstitial";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  Field,
  InfoList,
  InfoPanel,
  Panel,
  Pill,
  PrimaryCTA,
  TextInput,
} from "@/components/Bubbles";
import { PlayIndexSheet } from "@/components/PlayIndexSheet";
import { createPlay, fetchTeams } from "@/lib/data";
import { EMPTY_INDEX, type PlayIndex } from "@/lib/playIndex";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (<><TipInterstitial dest="playmaker" /><CreatePlayPage /></>),
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
  const [index, setIndex] = useState<PlayIndex>(EMPTY_INDEX);

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
        situation: index.situation,
        defense_faced: index.defense_faced,
        outcome: index.outcome,
        primary_actions: index.primary_actions,
        time_pressure: index.time_pressure,
        tags: index.tags,
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
      backTo="/plays"
      backLabel="Playbook"
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
          <div className="text-center">
            <h2 className="text-2xl font-black leading-tight text-foreground">New play</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Set the essentials, then start drawing.
            </p>
          </div>
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
            <div className="flex flex-wrap justify-center gap-2">
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
            <InfoPanel>{CATEGORY_HINT[category]}</InfoPanel>
          </Field>

          <Field label="Available to">
            <div className="flex flex-wrap justify-center gap-2">
              {teams.data?.map((t) => (
                <BubbleButton
                  key={t.id}
                  size="sm"
                  tone={teamIds.includes(t.id) ? "grape" : "neutral"}
                  onClick={() => toggleTeam(t.id)}
                >
                  {teamIds.includes(t.id) ? "✓ " : ""}
                  {t.name}
                </BubbleButton>
              ))}
              <BubbleButton
                size="sm"
                tone="neutral"
                onClick={() => setTeamIds((teams.data ?? []).map((t) => t.id))}
              >
                Select all
              </BubbleButton>
              {teams.isLoading ? <Pill tone="muted">Loading teams…</Pill> : null}
            </div>
            <InfoPanel>The same play can live in more than one team playbook.</InfoPanel>
          </Field>


          <Field label="Attack basket">
            <div className="flex flex-wrap justify-center gap-2">
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

          <PlayIndexSheet value={index} onChange={setIndex} compact />

          <PrimaryCTA>
            <BubbleButton
              tone="flame"
              size="lg"
              className="w-full sm:w-auto"
              disabled={!ready || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating…" : "Create & open designer"}
            </BubbleButton>
          </PrimaryCTA>
        </Panel>

        <Panel className="flex flex-col items-center gap-3">
          <div className="text-center">
            <h2 className="text-2xl font-black leading-tight text-foreground">What happens next</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              The designer opens with five offensive players ready to move.
            </p>
          </div>
          <InfoPanel tone="grape">
            Drag players into position, then draw actions frame by frame.
          </InfoPanel>
          <InfoList
            items={[
              "Dotted arrow = pass",
              "Solid arrow = cut / movement",
              "Curved arrow = curl cut",
              "Bumpy line = dribble",
              "Bar end = screen",
              "Presses: add defense (X1–X5) from the Press Maker panel",
            ]}
            tone="flame"
          />
          <InfoPanel>You can flip the attack basket at any time inside the designer.</InfoPanel>
        </Panel>
      </div>
    </AppShell>
  );
}
