import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  Field,
  Heading,
  Label,
  Note,
  Panel,
  Pill,
  TextInput,
} from "@/components/Bubbles";
import { useCurrentTeam } from "@/lib/teamContext";
import { useAccess, resolveRole } from "@/lib/access";
import {
  ALL_MODULES,
  COMPLETE_BLURB,
  COMPLETE_NAME,
  COMPLETE_PRICE,
  FREE_CORE,
  MODULE_LIST,
  MODULES,
  STATUS_LABEL,
  isComplete,
  priceFor,
  type BillingStatus,
  type ModuleKey,
} from "@/lib/entitlements";
import {
  cancelTeamMembership,
  createAccessCode,
  getBillingConfig,
  getTeamBilling,
  listAccessCodes,
  redeemAccessCode,
  setAccessCodeActive,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/membership")({
  head: () => ({
    meta: [
      { title: "Membership — CoachSide" },
      {
        name: "description",
        content:
          "Choose Playbook+, GameDay+ or Team Hub+ for your team, or CoachSide Complete for all three on one monthly charge.",
      },
      { property: "og:title", content: "Membership — CoachSide" },
      {
        property: "og:description",
        content: "One monthly membership per team. Free Core always stays free.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MembershipPage,
});

function Money({ amount }: { amount: number }) {
  return (
    <span className="rounded-2xl border border-flame/60 bg-flame/15 px-3 py-2 text-2xl font-black leading-tight text-foreground">
      ${amount}
      <span className="text-sm font-bold text-muted-foreground">/month</span>
    </span>
  );
}

/** One grouped, left-aligned feature list inside a single bubble. */
function FeatureList({
  items,
  tone = "neutral",
}: {
  items: string[];
  tone?: "neutral" | "flame";
}) {
  return (
    <ul
      className={`w-full rounded-2xl border p-4 text-left ${
        tone === "flame" ? "border-flame/50 bg-flame/10" : "border-border/70 bg-surface-2/60"
      }`}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 py-1.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-flame" aria-hidden="true" />
          <span className="text-sm font-semibold leading-snug text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AdminCodes() {
  const qc = useQueryClient();
  const list = useServerFn(listAccessCodes);
  const create = useServerFn(createAccessCode);
  const toggle = useServerFn(setAccessCodeActive);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [picked, setPicked] = useState<ModuleKey[]>([...ALL_MODULES]);
  const [maxUses, setMaxUses] = useState("");

  const codes = useQuery({ queryKey: ["access-codes"], queryFn: () => list({}) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["access-codes"] });

  const add = useMutation({
    mutationFn: () =>
      create({
        data: {
          code,
          label: label || undefined,
          modules: picked,
          maxUses: maxUses ? Number(maxUses) : null,
          perTeamLimit: 1,
        },
      }),
    onSuccess: (r) => {
      toast[r.ok ? "success" : "error"](r.message);
      if (r.ok) {
        setCode("");
        setLabel("");
        refresh();
      }
    },
    onError: () => toast.error("Could not create that code."),
  });

  return (
    <Panel className="mb-3 flex flex-col gap-3">
      <Label>Owner tools · complimentary access codes</Label>
      <Note>Codes are stored hashed. Share the plain code privately; it is never shown again.</Note>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Code">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="COACHSIDE-VIP" />
        </Field>
        <Field label="Label">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Pilot coaches" />
        </Field>
        <Field label="Max uses (blank = unlimited)">
          <TextInput value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {MODULE_LIST.map((m) => (
          <BubbleButton
            key={m.key}
            size="sm"
            tone={picked.includes(m.key) ? "grape" : "neutral"}
            onClick={() =>
              setPicked((p) => (p.includes(m.key) ? p.filter((k) => k !== m.key) : [...p, m.key]))
            }
          >
            {m.name}
          </BubbleButton>
        ))}
      </div>
      <BubbleButton
        tone="flame"
        className="w-fit"
        disabled={!code.trim() || !picked.length || add.isPending}
        onClick={() => add.mutate()}
      >
        Create code
      </BubbleButton>

      <div className="flex flex-col gap-2">
        {(codes.data ?? []).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-surface-2/60 px-3 py-2">
            <Pill tone={c.active ? "success" : "muted"}>{c.active ? "Active" : "Off"}</Pill>
            <span className="text-sm font-bold text-foreground">{c.hint}</span>
            {c.label ? <Pill tone="muted">{c.label}</Pill> : null}
            <Pill tone="muted">
              {c.uses}
              {c.maxUses ? ` / ${c.maxUses}` : ""} uses
            </Pill>
            <BubbleButton
              size="sm"
              tone="neutral"
              className="ml-auto"
              onClick={() =>
                void toggle({ data: { id: c.id, active: !c.active } }).then(refresh)
              }
            >
              {c.active ? "Deactivate" : "Reactivate"}
            </BubbleButton>
          </div>
        ))}
        {!codes.data?.length ? <EmptyState>No access codes yet</EmptyState> : null}
      </div>
    </Panel>
  );
}

function MembershipPage() {
  const navigate = useNavigate();
  const { access, loading: accessLoading } = useAccess();
  const role = resolveRole(access);
  const { teams, team, teamId, setTeam } = useCurrentTeam();
  const qc = useQueryClient();

  const billingFn = useServerFn(getTeamBilling);
  const configFn = useServerFn(getBillingConfig);
  const redeemFn = useServerFn(redeemAccessCode);
  const cancelFn = useServerFn(cancelTeamMembership);

  const config = useQuery({ queryKey: ["billing-config"], queryFn: () => configFn({}) });
  const billing = useQuery({
    queryKey: ["team-billing", teamId],
    queryFn: () => billingFn({ data: { teamId: teamId! } }),
    enabled: !!teamId && role.isCoach,
  });

  const owned = useMemo(() => billing.data?.modules ?? [], [billing.data]);
  const [selected, setSelected] = useState<ModuleKey[] | null>(null);
  const picked = selected ?? owned;
  const total = priceFor(picked);
  const complete = isComplete(picked);
  const [codeInput, setCodeInput] = useState("");

  // Players and parents never see membership.
  useEffect(() => {
    if (!accessLoading && role.isPlayerOnly) navigate({ to: "/lockerroom", replace: true });
  }, [accessLoading, role.isPlayerOnly, navigate]);

  const redeem = useMutation({
    mutationFn: () => redeemFn({ data: { teamId: teamId!, code: codeInput } }),
    onSuccess: (r) => {
      toast[r.ok ? "success" : "error"](r.message);
      if (r.ok) {
        setCodeInput("");
        void qc.invalidateQueries({ queryKey: ["team-billing", teamId] });
        void qc.invalidateQueries({ queryKey: ["team-entitlement", teamId] });
      }
    },
    onError: () => toast.error("Could not check that code."),
  });

  const checkout = useMutation({
    mutationFn: async () => {
      const { startTeamCheckout } = await import("@/lib/billing.functions");
      return startTeamCheckout({
        data: { teamId: teamId!, modules: picked, origin: window.location.origin },
      });
    },
    onSuccess: (r) => {
      if (r.ok) window.location.assign(r.url);
      else toast.error(r.reason);
    },
    onError: () => toast.error("Checkout is not available yet."),
  });

  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { teamId: teamId! } }),
    onSuccess: (r) => {
      toast[r.ok ? "success" : "error"](
        r.ok ? "Membership ends at the end of the paid period." : (r.reason ?? "Nothing to cancel."),
      );
      void qc.invalidateQueries({ queryKey: ["team-billing", teamId] });
    },
  });

  const status = (billing.data?.status ?? "free") as BillingStatus;

  return (
    <AppShell title="Membership" subtitle="One monthly membership per team">
      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Buying for</Label>
        <span className="rounded-2xl border border-grape/60 bg-grape/20 px-4 py-2 text-lg font-black leading-tight text-foreground">
          {team ? team.name : "No team yet"}
        </span>
        {team ? <Pill tone="muted">{team.season}</Pill> : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {teams
            .filter((t) => t.id !== teamId)
            .slice(0, 4)
            .map((t) => (
              <BubbleButton key={t.id} size="sm" tone="neutral" onClick={() => setTeam(t.id)}>
                Switch to {t.name}
              </BubbleButton>
            ))}
        </div>
      </Panel>

      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>This team</Label>
        <Pill tone={status === "active" || status === "complimentary" ? "success" : "muted"}>
          {STATUS_LABEL[status]}
        </Pill>
        {owned.length ? (
          owned.map((m) => (
            <Pill key={m} tone="grape">
              {MODULES[m].name}
            </Pill>
          ))
        ) : (
          <Pill tone="muted">Free Core</Pill>
        )}
        {billing.data?.currentPeriodEnd ? (
          <Pill tone="muted">Renews {new Date(billing.data.currentPeriodEnd).toLocaleDateString()}</Pill>
        ) : null}
        {config.data && !config.data.enforcementEnabled ? (
          <Note className="w-full">
            Memberships are not switched on yet — every CoachSide feature stays open for your team.
          </Note>
        ) : null}
      </Panel>

      <Panel className="mb-3 flex flex-col gap-3">
        <div className="flex justify-center">
          <Heading tone="neutral">Free Core — $0</Heading>
        </div>
        <div className="flex justify-center">
          <Note className="text-center">Every team starts here — free forever.</Note>
        </div>
        <FeatureList items={FREE_CORE} />
      </Panel>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        {MODULE_LIST.map((m) => {
          const on = picked.includes(m.key);
          return (
            <div
              key={m.key}
              className={`flex flex-col gap-3 rounded-3xl border p-4 shadow-lg shadow-black/30 transition-all ${
                on ? "border-grape/70 bg-grape/15" : "border-border/70 bg-surface/80"
              }`}
            >
              <div className="flex justify-center">
                <span className="rounded-2xl border border-border bg-surface-2/80 px-4 py-2 text-center text-xl font-black leading-tight text-foreground">
                  {m.name}
                </span>
              </div>
              <div className="flex justify-center">
                <Money amount={m.price} />
              </div>
              <div className="flex justify-center">
                <Note className="text-center">{m.blurb}</Note>
              </div>
              <FeatureList items={m.benefits} />
              <div className="flex justify-center">
                <BubbleButton
                  tone={on ? "grape" : "flame"}
                  onClick={() =>
                    setSelected(on ? picked.filter((k) => k !== m.key) : [...picked, m.key])
                  }
                >
                  {on ? "✓ Selected" : "Add to plan"}
                </BubbleButton>
              </div>
            </div>
          );
        })}
      </div>

      <Panel className="mb-3 flex flex-col gap-3 border-flame/60 bg-flame/10">
        <div className="flex justify-center">
          <Label>Best value</Label>
        </div>
        <div className="flex justify-center">
          <Heading tone="flame">{COMPLETE_NAME}</Heading>
        </div>
        <div className="flex justify-center">
          <Money amount={COMPLETE_PRICE} />
        </div>
        <div className="flex justify-center">
          <Note className="text-center">{COMPLETE_BLURB}</Note>
        </div>
        <FeatureList items={MODULE_LIST.flatMap((m) => m.benefits)} tone="flame" />
        <div className="flex justify-center">
          <BubbleButton tone="grape" size="lg" onClick={() => setSelected([...ALL_MODULES])}>
            Choose Complete
          </BubbleButton>
        </div>
      </Panel>

      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Your plan</Label>
        <Money amount={total} />
        <Pill tone="muted">
          {picked.length === 0
            ? "Free Core only"
            : complete
              ? `${COMPLETE_NAME} — all three modules`
              : picked.map((m) => MODULES[m].name).join(" + ")}
        </Pill>
        <Note className="w-full">
          One monthly charge for {team?.name ?? "this team"}, not one charge per module.
        </Note>
        {config.data && !config.data.checkoutConfigured ? (
          <Note className="w-full">
            Checkout setup is not finished yet, so payment cannot be taken. Nothing is locked in the
            meantime.
          </Note>
        ) : null}
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <BubbleButton
            tone="flame"
            size="lg"
            disabled={!teamId || !picked.length || !config.data?.checkoutConfigured || checkout.isPending}
            onClick={() => checkout.mutate()}
          >
            {checkout.isPending ? "Opening checkout…" : `Continue — $${total}/month`}
          </BubbleButton>
          {billing.data?.subscriptionRef ? (
            <BubbleButton tone="neutral" onClick={() => cancel.mutate()}>
              Cancel at period end
            </BubbleButton>
          ) : null}
        </div>
      </Panel>

      <Panel className="mb-3 flex flex-col gap-2">
        <Label>Have an access code?</Label>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <TextInput
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Enter code"
            className="max-w-xs"
          />
          <BubbleButton
            tone="grape"
            disabled={!teamId || !codeInput.trim() || redeem.isPending}
            onClick={() => redeem.mutate()}
          >
            Apply to this team
          </BubbleButton>
        </div>
        {billing.data?.complimentary ? (
          <Pill tone="success">
            Complimentary access active
            {billing.data.complimentaryExpiresAt
              ? ` until ${new Date(billing.data.complimentaryExpiresAt).toLocaleDateString()}`
              : ""}
          </Pill>
        ) : null}
      </Panel>

      {billing.data?.isAdmin ? (
        <>
          <Panel className="mb-3 flex flex-wrap items-center gap-2">
            <Label>Billing diagnostics</Label>
            <Pill tone="muted">Status {status}</Pill>
            <Pill tone="muted">Subscription {billing.data.subscriptionRef ?? "none"}</Pill>
            <Pill tone="muted">
              Last sync{" "}
              {billing.data.lastWebhookAt
                ? new Date(billing.data.lastWebhookAt).toLocaleString()
                : "never"}
            </Pill>
            {billing.data.lastWebhookError ? (
              <Pill tone="danger">{billing.data.lastWebhookError}</Pill>
            ) : null}
            <Pill tone="muted">
              Enforcement {config.data?.enforcementEnabled ? "on" : "off"}
            </Pill>
          </Panel>
          <AdminCodes />
        </>
      ) : null}

      <Panel className="flex flex-wrap items-center gap-2">
        <Label>Questions</Label>
        <Note>
          Downgrading keeps your access until the end of the paid period, and nothing you created is
          ever deleted.
        </Note>
        <Link to="/dashboard" className="ml-auto">
          <BubbleButton size="sm" tone="neutral">
            Back to dashboard
          </BubbleButton>
        </Link>
      </Panel>
    </AppShell>
  );
}
