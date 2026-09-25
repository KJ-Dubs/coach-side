import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  Field,
  InfoPanel,
  Panel,
  Pill,
  PrimaryCTA,
  TextInput,
  actionCardCls,
} from "@/components/Bubbles";
import { fetchTeams } from "@/lib/data";
import { createPracticePlan, fetchPracticePlans } from "@/lib/practice";

export const Route = createFileRoute("/_authenticated/practice/")({
  head: () => ({
    meta: [
      { title: "Practice Planner — CoachSide" },
      {
        name: "description",
        content: "Build a timed practice plan from your drills, plays and custom blocks, then share it with the team.",
      },
      { property: "og:title", content: "Practice Planner — CoachSide" },
      { property: "og:description", content: "Plan practice in minutes: drills, plays and timed blocks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PracticeIndexPage,
});

function PracticeIndexPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [teamId, setTeamId] = useState<string>("");
  const [title, setTitle] = useState("Practice");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState(90);

  useEffect(() => {
    if (!teamId && teams.data?.length) setTeamId(teams.data[0]!.id);
  }, [teams.data, teamId]);

  const plans = useQuery({
    queryKey: ["practice-plans", teamId],
    queryFn: () => fetchPracticePlans(teamId || null),
    enabled: !!teamId,
  });

  const create = useMutation({
    mutationFn: () =>
      createPracticePlan({
        team_id: teamId,
        title: title.trim() || "Practice",
        plan_date: date,
        total_minutes: minutes,
      }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["practice-plans"] });
      navigate({ to: "/practice/$planId", params: { planId: p.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Practice Planner"
      subtitle="Build the plan, then run it in the gym"
      backTo="/tools"
      backLabel="Tools"
      actions={
        <Link to="/drills">
          <BubbleButton size="sm" tone="ghost">
            My Drills
          </BubbleButton>
        </Link>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <Panel className="flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-2xl font-black leading-tight text-foreground">New plan</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Pick the team, date and length.</p>
          </div>
          <Field label="Team">
            <div className="flex flex-wrap justify-center gap-2">
              {(teams.data ?? []).map((t) => (
                <BubbleButton key={t.id} size="sm" tone={teamId === t.id ? "grape" : "neutral"} onClick={() => setTeamId(t.id)}>
                  {t.name}
                </BubbleButton>
              ))}
            </div>
          </Field>
          <Field label="Title">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Total minutes">
            <TextInput
              type="number"
              min={15}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(15, Number(e.target.value) || 90))}
            />
          </Field>
          <PrimaryCTA>
            <BubbleButton tone="flame" size="lg" disabled={!teamId || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Creating…" : "Create plan"}
            </BubbleButton>
          </PrimaryCTA>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel>
            <InfoPanel>Plans stay private to your coaching staff until you share them to the Locker Room.</InfoPanel>
          </Panel>
          {plans.isLoading ? <EmptyState>Loading plans…</EmptyState> : null}
          {!plans.isLoading && !plans.data?.length ? <EmptyState>No practice plans yet.</EmptyState> : null}
          {(plans.data ?? []).map((p) => (
            <Link key={p.id} to="/practice/$planId" params={{ planId: p.id }} className={actionCardCls}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-black text-foreground">{p.title}</span>
                <Pill tone="muted">{p.plan_date}</Pill>
                <Pill tone="neutral">{p.total_minutes} min</Pill>
                {p.shared_to_locker ? <Pill tone="flame">Shared</Pill> : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
