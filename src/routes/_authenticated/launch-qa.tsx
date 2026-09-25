/**
 * Launch QA — owner-only funnel and billing verification page. Hidden from
 * everyone else; every number comes from server functions that re-check
 * ownership. The persona simulator only changes what this owner sees.
 */
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, Label, Note, Panel, Pill, SelectInput, StatTile, TextInput } from "@/components/Bubbles";
import { useIsAppAdmin } from "@/lib/useIsAppAdmin";
import {
  getLaunchQa,
  grantPilotAccess,
  runDailyNow,
  savePriceMapping,
  schedulePlayOfTheDay,
  sendTestNotification,
  type TestResult,
} from "@/lib/launchqa.functions";
import { setPlayOfTheDayAndNotify } from "@/lib/notifications.functions";
import { PERSONAS, readPersona, writePersona, type PersonaKey } from "@/lib/personas";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { trialMessage, type ModuleKey } from "@/lib/entitlements";

export const Route = createFileRoute("/_authenticated/launch-qa")({
  head: () => ({
    meta: [
      { title: "Launch QA — CoachSide owner tools" },
      { name: "description", content: "Owner-only verification of trials, paywalls, achievements, notifications and Stripe." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Launch QA — CoachSide" },
      { property: "og:description", content: "Owner-only launch verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LaunchQaPage,
});

const FEATURES: { label: string; module: ModuleKey | null }[] = [
  { label: "Coach's Board", module: null },
  { label: "Roster & QR onboarding", module: null },
  { label: "Browse Library", module: null },
  { label: "Create plays in Playmaker", module: null },
  { label: "Add Library play to Playbook", module: "playbook_plus" },
  { label: "Publish play", module: "playbook_plus" },
  { label: "Export MP4", module: "playbook_plus" },
  { label: "Live Game location tracking", module: "gameday_plus" },
  { label: "Shot charts", module: "gameday_plus" },
  { label: "Advanced game history", module: "gameday_plus" },
  { label: "Assignments & resources", module: "team_hub_plus" },
  { label: "Google Calendar sync", module: "team_hub_plus" },
  { label: "Parent sharing", module: "team_hub_plus" },
];

const PLAN_LABEL: Record<string, string> = {
  playbook_plus: "Playbook+ ($6)",
  gameday_plus: "GameDay+ ($6)",
  team_hub_plus: "Team Hub+ ($6)",
  "playbook_plus+gameday_plus": "Playbook+ & GameDay+ ($12)",
  "playbook_plus+team_hub_plus": "Playbook+ & Team Hub+ ($12)",
  "gameday_plus+team_hub_plus": "GameDay+ & Team Hub+ ($12)",
  complete: "Complete ($15)",
};

function OnOff({ on, yes = "ON", no = "OFF" }: { on: boolean; yes?: string; no?: string }) {
  return <Pill tone={on ? "success" : "muted"}>{on ? yes : no}</Pill>;
}

function LaunchQaPage() {
  const { isAdmin, resolved, isError, retry } = useIsAppAdmin();
  const navigate = useNavigate();
  useEffect(() => {
    // Redirect only on a successful, definitive non-admin answer.
    if (resolved && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [resolved, isAdmin, navigate]);

  const fetchQa = useServerFn(getLaunchQa);
  const qa = useQuery({ queryKey: ["launch-qa"], queryFn: () => fetchQa(), enabled: isAdmin });
  const qc = useQueryClient();
  const savePrice = useServerFn(savePriceMapping);
  const testFn = useServerFn(sendTestNotification);
  const pilotFn = useServerFn(grantPilotAccess);
  const scheduleFn = useServerFn(schedulePlayOfTheDay);
  const overrideFn = useServerFn(setPlayOfTheDayAndNotify);
  const dailyFn = useServerFn(runDailyNow);

  const [persona, setPersona] = useState<PersonaKey | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<TestResult[]>([]);
  const [trialDay, setTrialDay] = useState(0);
  const [schedDay, setSchedDay] = useState("");
  const [schedPlay, setSchedPlay] = useState("");

  useEffect(() => setPersona(readPersona()), []);
  useEffect(() => {
    if (qa.data) setPrices(Object.fromEntries(qa.data.priceMap.map((p) => [p.planKey, p.priceId ?? ""])));
  }, [qa.data]);

  if (!isAdmin) {
    return (
      <AppShell title="Launch QA" subtitle="Owner tools" backTo="/dashboard" backLabel="Home">
        <Panel className="flex flex-col items-center gap-3">
          <EmptyState>{isError ? "Could not confirm owner access" : "Checking access…"}</EmptyState>
          {isError ? <BubbleButton tone="grape" onClick={retry}>Retry</BubbleButton> : null}
        </Panel>
      </AppShell>
    );
  }
  const d = qa.data;
  const p = PERSONAS.find((x) => x.key === persona) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["launch-qa"] });

  async function run<T>(fn: () => Promise<T>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const trialLeft = Math.max(0, 14 - trialDay);
  const trialExpired = trialDay >= 14;

  return (
    <AppShell title="Launch QA" subtitle="Confirm trials, paywalls, achievements and billing before enforcement" backTo="/dashboard" backLabel="Home">
      {!d ? (
        <EmptyState>{qa.isError ? "Could not load Launch QA" : "Loading…"}</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <Panel className="flex flex-col gap-2">
            <Label>1 · Current config</Label>
            <div className="flex flex-wrap gap-2">
              <Pill>Billing enforcement</Pill><OnOff on={d.config.enforcementEnabled} />
              <Pill>Stripe</Pill>
              <Pill tone={d.config.stripeMode === "not_configured" ? "danger" : d.config.stripeMode === "live" ? "flame" : "grape"}>
                {d.config.stripeMode === "not_configured" ? "Not configured" : d.config.stripeMode.toUpperCase()}
              </Pill>
              <Pill>Webhook</Pill><OnOff on={d.config.webhookConfigured} yes="Configured" no="Missing" />
              <Pill>Email</Pill><OnOff on={d.config.emailConfigured} yes="Configured" no="Not configured" />
              <Pill>Push</Pill><OnOff on={d.config.pushConfigured} yes="Configured" no="Missing" />
              <Pill>Price map</Pill><OnOff on={d.config.priceMapComplete} yes="Complete" no="Incomplete" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill>Stripe server secret</Pill><OnOff on={d.stripe.secretPresent} yes="Present" no="Not configured" />
              {d.stripe.reason ? <Pill tone="danger">{d.stripe.reason}</Pill> : null}
              <Pill tone="muted">Last webhook: {d.stripe.lastWebhookAt ? new Date(d.stripe.lastWebhookAt).toLocaleString() : "none yet"}</Pill>
              {d.stripe.subscriptions.length === 0 ? <Pill tone="muted">No Stripe subscriptions observed</Pill> : d.stripe.subscriptions.map((x) => (
                <Pill key={x.status} tone="grape">{x.status}: {x.count}</Pill>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="grape">Support: {d.config.supportEmail}</Pill>
              <Pill tone="muted">From: {d.config.fromEmail}</Pill>
              <Pill tone="muted">Webhook path: {d.config.webhookUrl}</Pill>
            </div>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Stripe price IDs</Label>
            <Note>Test prices come from your Stripe sandbox. Saving a value here overrides it — map live-mode IDs here after QA.</Note>
            {d.priceMap.map((row) => (
              <div key={row.planKey} className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-center">
                <Pill tone={row.priceId ? "success" : "danger"}>{PLAN_LABEL[row.planKey]} · {row.source}</Pill>
                <TextInput
                  value={prices[row.planKey] ?? ""}
                  placeholder="price_…"
                  onChange={(e) => setPrices({ ...prices, [row.planKey]: e.target.value })}
                />
                <BubbleButton size="sm" tone="neutral" onClick={() => run(() => savePrice({ data: { planKey: row.planKey, priceId: prices[row.planKey] ?? "" } }), "Saved")}>
                  Save
                </BubbleButton>
              </div>
            ))}
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>2 · Entitlement simulator</Label>
            <Note tone="flame">Preview only — changes what you see in this browser session. Never touches real billing.</Note>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.map((x) => (
                <BubbleButton key={x.key} size="sm" tone={persona === x.key ? "flame" : "neutral"} onClick={() => { writePersona(x.key); setPersona(x.key); }}>
                  {x.label}
                </BubbleButton>
              ))}
              <BubbleButton size="sm" tone="ghost" onClick={() => { writePersona(null); setPersona(null); }}>
                Stop simulating
              </BubbleButton>
            </div>
            {p ? <Pill tone="flame" className="w-fit">Simulating: {p.label} — open Home, Playbook or Membership to see it</Pill> : null}
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>3 · Feature matrix {p ? `· ${p.label}` : "· pick a persona"}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURES.map((f) => {
                const inTrial = !!p && p.trialDaysLeft !== null && !p.trialExpired;
                const state = !f.module ? "Allowed" : !p ? "—" : p.modules.includes(f.module) ? (inTrial ? "Trial" : "Allowed") : "Locked";
                return (
                  <div key={f.label} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface-2/60 px-3 py-2">
                    <span className="text-sm font-semibold text-foreground">{f.label}</span>
                    <Pill tone={state === "Allowed" ? "success" : state === "Trial" ? "grape" : state === "Locked" ? "danger" : "muted"}>{state}</Pill>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>4 · Stripe test checklist</Label>
            {d.checklist.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/60 px-3 py-2">
                <Pill tone={c.status === "pass" ? "success" : c.status === "fail" ? "danger" : "muted"}>
                  {c.status === "waiting" ? "Waiting on config" : c.status.toUpperCase()}
                </Pill>
                <span className="text-sm font-bold text-foreground">{c.label}</span>
                <Note className="ml-auto">{c.detail}</Note>
              </div>
            ))}
            <Label>Recent webhook events</Label>
            {d.webhookEvents.length === 0 ? <EmptyState>No Stripe events received yet</EmptyState> : d.webhookEvents.map((e) => (
              <div key={e.eventId} className="flex flex-wrap gap-2">
                <Pill tone={e.processed ? "success" : "danger"}>{e.type}</Pill>
                <Pill tone="muted">{new Date(e.receivedAt).toLocaleString()}</Pill>
                {e.error ? <Pill tone="danger">{e.error}</Pill> : null}
              </div>
            ))}
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>5 · Notification tests (sent to you)</Label>
            <div className="flex flex-wrap gap-2">
              {(["inapp", "push", "email"] as const).map((ch) => (
                <BubbleButton key={ch} size="sm" tone="grape" onClick={async () => {
                  try {
                    const r = await testFn({ data: { channel: ch } });
                    setTests((t) => [r, ...t].slice(0, 6));
                  } catch (e) {
                    setTests((t) => [{ channel: ch, ok: false, detail: e instanceof Error ? e.message : "Failed" }, ...t]);
                  }
                }}>
                  Test {ch === "inapp" ? "in-app" : ch}
                </BubbleButton>
              ))}
            </div>
            {tests.map((t, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Pill tone={t.ok ? "success" : "danger"}>{t.channel}: {t.ok ? "success" : "failed"}</Pill>
                <Note>{t.detail}</Note>
              </div>
            ))}
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>6 · Trial test (test-only, no data written)</Label>
            <input type="range" min={0} max={16} value={trialDay} onChange={(e) => setTrialDay(Number(e.target.value))} className="w-full accent-[var(--color-flame)]" aria-label="Trial day" />
            <div className="flex flex-wrap gap-2">
              <Pill>Day {trialDay}</Pill>
              <Pill tone={trialExpired ? "danger" : "grape"}>
                {trialExpired ? "Trial expired → Free Core, paid actions locked" : `CoachSide Complete Trial • ${trialLeft} days left`}
              </Pill>
              {trialMessage(trialLeft, trialExpired) ? <Note tone="flame">{trialMessage(trialLeft, trialExpired)}</Note> : <Note>No contextual message at this point</Note>}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Pilot users</Label>
            <Note>Give every existing team complimentary Complete so early users never lose access when enforcement turns on.</Note>
            <BubbleButton size="sm" tone="flame" className="w-fit" onClick={() => run(async () => {
              const r = await pilotFn();
              toast.message(`${r.granted} team(s) granted`);
            }, "Pilot access applied")}>
              Grant pilot Complete to current teams
            </BubbleButton>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Play of the Day</Label>
            <div className="flex flex-wrap gap-2">
              <BubbleButton size="sm" tone="neutral" onClick={() => run(() => dailyFn(), "Today's pick is set")}>Run today's pick now</BubbleButton>
            </div>
            <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto_auto]">
              <TextInput type="date" value={schedDay} onChange={(e) => setSchedDay(e.target.value)} />
              <SelectInput value={schedPlay} onChange={(e) => setSchedPlay(e.target.value)}>
                <option value="">Choose a Library play…</option>
                {d.libraryPlays.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
              </SelectInput>
              <BubbleButton size="sm" tone="grape" disabled={!schedDay || !schedPlay} onClick={() => run(() => scheduleFn({ data: { day: schedDay, playId: schedPlay } }), "Scheduled")}>Schedule day</BubbleButton>
              <BubbleButton size="sm" tone="flame" disabled={!schedPlay} onClick={() => run(() => overrideFn({ data: { playId: schedPlay } }), "Today overridden")}>Override today</BubbleButton>
            </div>
            {d.potd.length === 0 ? <EmptyState>No history yet</EmptyState> : d.potd.map((r) => (
              <div key={r.day} className="flex flex-wrap gap-2">
                <Pill>{r.day}</Pill>
                <Pill tone={r.source === "manual" ? "flame" : r.source === "scheduled" ? "grape" : "muted"}>{r.source}</Pill>
                <Pill tone="neutral">{r.playName ?? "—"}</Pill>
                <Pill tone={r.notifiedAt ? "success" : "muted"}>{r.notifiedAt ? "Notified" : "Not sent"}</Pill>
              </div>
            ))}
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>7 · Achievements</Label>
            <Note>Mapping from real data to each achievement. Read-only — the simulator never awards achievements.</Note>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACHIEVEMENTS.map((a) => {
                const mine = d.myAchievements.find((m) => m.key === a.key);
                const rate = d.achievementRates.find((r) => r.key === a.key)?.pct ?? 0;
                return (
                  <div key={a.key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/60 px-3 py-2">
                    <span className="text-sm font-bold text-foreground">{a.name}</span>
                    <Pill tone="muted">{a.metric} ≥ {a.target}</Pill>
                    <Pill tone="grape">{rate}% of coaches</Pill>
                    {mine ? <Pill tone="success">You: unlocked</Pill> : null}
                  </div>
                );
              })}
            </div>
            <Label>Your recent activity events</Label>
            <div className="flex flex-wrap gap-2">
              {d.myEvents.length === 0 ? <EmptyState>No events</EmptyState> : d.myEvents.map((e, i) => (
                <Pill key={i} tone="muted">{e.type} · {new Date(e.at).toLocaleDateString()}</Pill>
              ))}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>8 · Funnel events</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {d.funnel.map((f) => <StatTile key={f.event} label={f.event} value={f.count} />)}
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
