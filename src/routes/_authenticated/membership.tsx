import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  Field,
  Heading,
  InfoList,
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
  COMPLETE_EXCLUSIVES,
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
import { BillingDiagnosticsPanel } from "@/components/admin/BillingDiagnosticsPanel";

export const Route = createFileRoute("/_authenticated/membership")({
  head: () => ({
    meta: [
      { title: "Membership — CoachSide" },
      {
        name: "description",
        content:
          "Choose Playbook+, GameDay+ or Team Hub+ for your team, or CoachSide Complete for all three plus the CoachSide AI Assistant on one monthly charge.",
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
  // Upgrade links (e.g. from the AI Assistant) can preselect Complete and keep
  // the team. Checkout return params are kept as-is for the page to read.
  validateSearch: (s: Record<string, unknown>): MembershipSearch => ({
    plan: s["plan"] === "complete" ? "complete" : undefined,
    team: typeof s["team"] === "string" ? s["team"] : undefined,
    checkout: typeof s["checkout"] === "string" ? s["checkout"] : undefined,
    changed: typeof s["changed"] === "string" ? s["changed"] : undefined,
  }),
  component: MembershipPage,
});

type MembershipSearch = {
  plan?: "complete" | undefined;
  team?: string | undefined;
  checkout?: string | undefined;
  changed?: string | undefined;
};

function Money({ amount }: { amount: number }) {
  return (
    <span className="rounded-2xl border border-flame/60 bg-flame/15 px-3 py-2 text-2xl font-black leading-tight text-foreground">
      ${amount}
      <span className="text-sm font-bold text-muted-foreground">/month</span>
    </span>
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

  // Return from checkout or a plan change. Only the payment webhook unlocks access;
  // this just tells the coach what is happening while we wait for it.
  const [returnState, setReturnState] = useState<null | "checkout" | "now" | "renewal" | "stripe">(null);
  const [waitStarted, setWaitStarted] = useState<number | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const changed = sp.get("changed");
    const next =
      sp.get("checkout") === "complete"
        ? "checkout"
        : changed === "now" || changed === "renewal" || changed === "stripe"
          ? changed
          : null;
    if (!next) return;
    const wanted = sp.get("team");
    if (wanted && teams.some((t) => t.id === wanted) && wanted !== teamId) setTeam(wanted);
    setReturnState(next);
    setWaitStarted(Date.now());
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.length]);

  const config = useQuery({ queryKey: ["billing-config"], queryFn: () => configFn({}) });
  const billing = useQuery({
    queryKey: ["team-billing", teamId],
    queryFn: () => billingFn({ data: { teamId: teamId! } }),
    enabled: !!teamId && role.isCoach,
    refetchInterval: (q) => {
      const waiting =
        returnState === "checkout" &&
        q.state.data?.status !== "active" &&
        waitStarted !== null &&
        Date.now() - waitStarted < 120_000;
      return waiting ? 3000 : false;
    },
  });
  const activated = returnState === "checkout" && billing.data?.status === "active";
  const [, tick] = useState(0);
  useEffect(() => {
    if (returnState !== "checkout") return;
    const t = window.setTimeout(() => tick((x) => x + 1), 121_000);
    return () => window.clearTimeout(t);
  }, [returnState]);
  useEffect(() => {
    if (activated) void qc.invalidateQueries({ queryKey: ["team-entitlement", teamId] });
  }, [activated, qc, teamId]);

  const owned = useMemo(() => billing.data?.modules ?? [], [billing.data]);
  const [selected, setSelected] = useState<ModuleKey[] | null>(null);
  const picked = selected ?? owned;
  const total = priceFor(picked);
  const complete = isComplete(picked);
  const [codeInput, setCodeInput] = useState("");

  // "Upgrade to Complete" links: switch to the team they came from and
  // preselect Complete so checkout is one tap away.
  const search = Route.useSearch();
  useEffect(() => {
    if (search.team && teams.some((t) => t.id === search.team) && search.team !== teamId) {
      setTeam(search.team);
    }
    if (search.plan === "complete") {
      setSelected([...ALL_MODULES]);
      window.setTimeout(
        () => document.getElementById("complete-plan")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        150,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.plan, search.team, teams.length]);

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
    onError: () => toast.error("Checkout is temporarily unavailable."),
  });

  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { teamId: teamId! } }),
    onSuccess: (r) => {
      toast[r.ok ? "success" : "error"](
        r.ok
          ? `Membership ends ${r.endsAt ? `on ${new Date(r.endsAt).toLocaleDateString()}` : "at the end of the paid period"}. Access continues until then.`
          : (r.reason ?? "Nothing to cancel."),
      );
      void qc.invalidateQueries({ queryKey: ["team-billing", teamId] });
    },
    onError: () => toast.error("Could not cancel right now. Please try again."),
  });

  const portal = useMutation({
    mutationFn: async () => {
      const { openBillingPortal } = await import("@/lib/billing.functions");
      return openBillingPortal({ data: { teamId: teamId!, origin: window.location.origin } });
    },
    onSuccess: (r) => {
      if (r.ok) window.location.assign(r.url);
      else toast.error(r.reason);
    },
    onError: () => toast.error("Billing management is temporarily unavailable."),
  });

  const status = (billing.data?.status ?? "free") as BillingStatus;
  const b = billing.data;
  const checkoutAvailable = b ? b.checkoutAvailable : !!config.data?.checkoutConfigured;
  const checkoutReason = b ? b.checkoutReason : (config.data?.checkoutReason ?? null);
  const samePlan =
    picked.length === owned.length && picked.every((m) => owned.includes(m)) && !b?.cancelAtPeriodEnd;

  return (
    <AppShell title="Membership" subtitle="One monthly membership per team" backTo="/dashboard" backLabel="Home">
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
        ) : null}
        {b?.currentPeriodEnd && b.hasSubscription ? (
          <Pill tone={b.cancelAtPeriodEnd ? "danger" : "muted"}>
            {b.cancelAtPeriodEnd ? "Ends" : "Renews"} {new Date(b.currentPeriodEnd).toLocaleDateString()}
          </Pill>
        ) : null}
        {b?.pendingModules?.length && b.hasSubscription && b.pendingEffectiveAt ? (
          <Pill tone="grape">
            Changes to {b.pendingModules.map((m) => MODULES[m].name).join(" + ")} on{" "}
            {new Date(b.pendingEffectiveAt).toLocaleDateString()}
          </Pill>
        ) : null}
        {config.data && !config.data.enforcementEnabled ? (
          <Note className="w-full">
            Memberships are not switched on yet — every CoachSide feature stays open for your team.
          </Note>
        ) : null}
      </Panel>

      {returnState ? (
        <Panel className="mb-3 flex flex-wrap items-center gap-2 border-grape/60 bg-grape/10">
          <Label>{returnState === "checkout" ? "Checkout" : "Plan change"}</Label>
          {returnState === "checkout" ? (
            activated ? (
              <Pill tone="success">Payment confirmed — your membership is active</Pill>
            ) : waitStarted !== null && Date.now() - waitStarted >= 120_000 ? (
              <Note className="w-full">
                We're still waiting for payment confirmation. It usually arrives within a few minutes — refresh this
                page shortly. You won't be charged twice.
              </Note>
            ) : (
              <Pill tone="grape">Confirming your payment…</Pill>
            )
          ) : returnState === "renewal" ? (
            <Note className="w-full">
              Your new plan starts on your next renewal date. Your current features stay on until then.
            </Note>
          ) : (
            <Pill tone="success">Plan updated</Pill>
          )}
          <BubbleButton size="sm" tone="ghost" className="ml-auto" onClick={() => setReturnState(null)}>
            Dismiss
          </BubbleButton>
        </Panel>
      ) : null}

      <Panel className="mb-3 flex flex-col gap-3">
        <div className="flex justify-center">
          <Heading tone="neutral">Free Core — $0</Heading>
        </div>
        <div className="flex justify-center">
          <Note className="text-center">Every team starts here — free forever.</Note>
        </div>
        <InfoList items={FREE_CORE} />
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
              <InfoList items={m.benefits} />
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

      <Panel id="complete-plan" className="mb-3 flex flex-col gap-3 border-flame/60 bg-flame/10">
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
        <InfoList items={[...COMPLETE_EXCLUSIVES, ...MODULE_LIST.flatMap((m) => m.benefits)]} tone="flame" />
        <div className="flex justify-center">
          <Pill tone="grape">AI Assistant is only in Complete — not the $6 or $12 plans</Pill>
        </div>
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
              ? `${COMPLETE_NAME} — all three modules + AI Assistant`
              : picked.map((m) => MODULES[m].name).join(" + ")}
        </Pill>
        <Note className="w-full">
          One monthly charge for {team?.name ?? "this team"}, not one charge per module.
        </Note>
        {!checkoutAvailable && checkoutReason ? (
          <Note className="w-full">
            {checkoutReason}
            {b?.isAdmin ? "" : " Nothing is locked in the meantime."}
          </Note>
        ) : null}
        {b?.hasSubscription && b.provider === "square" && !samePlan ? (
          <Note className="w-full">
            Plan changes start on your next renewal date. Swapping modules at the same price applies right away.
          </Note>
        ) : null}
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <BubbleButton
            tone="flame"
            size="lg"
            disabled={
              !teamId || !picked.length || !checkoutAvailable || checkout.isPending || (b?.hasSubscription && samePlan)
            }
            onClick={() => checkout.mutate()}
          >
            {checkout.isPending
              ? b?.hasSubscription
                ? "Updating…"
                : "Opening checkout…"
              : b?.hasSubscription
                ? b.cancelAtPeriodEnd
                  ? `Keep membership — $${total}/month`
                  : samePlan
                    ? "Current plan"
                    : `Change plan — $${total}/month`
                : `Continue — $${total}/month`}
          </BubbleButton>
          {b?.hasSubscription && b.provider === "stripe" ? (
            <BubbleButton tone="neutral" disabled={portal.isPending} onClick={() => portal.mutate()}>
              {portal.isPending ? "Opening…" : "Manage billing"}
            </BubbleButton>
          ) : null}
          {b?.hasSubscription && !b.cancelAtPeriodEnd ? (
            <BubbleButton
              tone="neutral"
              disabled={cancel.isPending}
              onClick={() => {
                if (window.confirm("Cancel this team's membership at the end of the paid period? Nothing you created is deleted.")) cancel.mutate();
              }}
            >
              Cancel at period end
            </BubbleButton>
          ) : null}
        </div>
        {b?.hasSubscription && b.provider === "square" ? (
          <Note className="w-full text-center">
            Card or receipt questions? Email support@coachside.live.
          </Note>
        ) : null}
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
          <BillingDiagnosticsPanel />
          <Panel className="mb-3 flex flex-wrap items-center gap-2">
            <Label>This team's billing record</Label>
            <Pill tone="muted">Status {status}</Pill>
            <Pill tone="muted">Billed through {billing.data.provider === "stripe" ? "legacy Stripe" : "Square"}</Pill>
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
