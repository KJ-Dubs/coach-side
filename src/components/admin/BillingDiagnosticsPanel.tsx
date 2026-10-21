import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyState, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { getSquareBillingDiagnostics } from "@/lib/billing.functions";

function YesNo({ label, on }: { label: string; on: boolean }) {
  return (
    <Pill tone={on ? "success" : "danger"}>
      {label}: {on ? "yes" : "no"}
    </Pill>
  );
}

/** Owner-only membership processor status. Shows yes/no only — never a secret. */
export function BillingDiagnosticsPanel() {
  const fn = useServerFn(getSquareBillingDiagnostics);
  const q = useQuery({ queryKey: ["square-billing-diagnostics"], queryFn: () => fn() });
  const d = q.data;
  return (
    <Panel className="mb-3 flex flex-col gap-2">
      <Label>Billing diagnostics · owner only</Label>
      {!d ? (
        <EmptyState>{q.isError ? "Could not load billing diagnostics" : "Loading…"}</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Pill tone="grape">Provider: {d.provider}</Pill>
            <Pill tone={d.environment === "production" ? "flame" : "muted"}>
              Environment: {d.environment}
              {d.environmentExplicit ? "" : " (default)"}
            </Pill>
            <Pill tone={d.configured ? "success" : "danger"}>{d.configured ? "Checkout ready" : "Setup incomplete"}</Pill>
            <Pill tone="muted">Enforcement {d.enforcementEnabled ? "on" : "off"}</Pill>
          </div>
          <div className="flex flex-wrap gap-2">
            <YesNo label="Access token" on={d.accessToken} />
            <YesNo label="Location" on={d.location} />
            <YesNo label="Webhook signature key" on={d.webhookSignature} />
            <YesNo label="$6 plan (one module)" on={d.variations.single} />
            <YesNo label="$12 plan (two modules)" on={d.variations.duo} />
            <YesNo label="$15 plan (Complete)" on={d.variations.complete} />
            <Pill tone="muted">App ID (optional): {d.appId ? "yes" : "no"}</Pill>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="neutral" className="break-all">Webhook URL: {d.webhookUrl}</Pill>
          </div>
          <Note>
            In Square, subscribe this exact URL to subscription.created, subscription.updated, invoice.payment_made and
            invoice.scheduled_charge_failed.
          </Note>
          <div className="flex flex-wrap gap-2">
            {d.squareTeams.length === 0 ? (
              <Pill tone="muted">No Square memberships yet</Pill>
            ) : (
              d.squareTeams.map((s) => (
                <Pill key={s.status} tone="grape">
                  {s.status}: {s.count}
                </Pill>
              ))
            )}
            <Pill tone="muted">Open checkouts: {d.openCheckouts}</Pill>
            <Pill tone="muted">Legacy Stripe live: {d.legacyStripeLive}</Pill>
            <Pill tone="muted">
              Last webhook: {d.lastWebhookAt ? new Date(d.lastWebhookAt).toLocaleString() : "none yet"}
            </Pill>
          </div>
          {d.recentEvents.length ? (
            <div className="flex flex-col gap-1">
              {d.recentEvents.map((e, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <Pill tone={e.processed ? "success" : "danger"}>{e.type}</Pill>
                  <Pill tone="muted">{new Date(e.receivedAt).toLocaleString()}</Pill>
                  {e.error ? <Pill tone="danger">{e.error}</Pill> : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}
