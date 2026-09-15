/**
 * CoachSide memberships.
 *
 * Money rules live here so every screen quotes the same price:
 *  - one module  = $6 / month
 *  - two modules = $12 / month
 *  - all three   = CoachSide Complete, $15 / month (never $18)
 *
 * A membership belongs to a TEAM, never to a person, and a team always has
 * exactly one recurring charge. Enforcement is decided by the server
 * (BILLING_ENFORCEMENT_ENABLED) and is OFF until we switch it on, so nothing
 * in the app is locked today.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ModuleKey = "playbook_plus" | "gameday_plus" | "team_hub_plus";

export type ModuleInfo = {
  key: ModuleKey;
  name: string;
  price: number;
  blurb: string;
  /** Short, concrete benefits used by contextual upgrade prompts. */
  benefits: string[];
};

export const MODULE_LIST: ModuleInfo[] = [
  {
    key: "playbook_plus",
    name: "Playbook+",
    price: 6,
    blurb: "Save Library plays, unlimited team playbooks and social video export.",
    benefits: [
      "Save CoachSide Library plays into your team Playbook",
      "Unlimited saved and custom team plays",
      "Publish your own plays to the Library",
      "Download plays as MP4 for social",
    ],
  },
  {
    key: "gameday_plus",
    name: "GameDay+",
    price: 6,
    blurb: "Court-location stat tracking, shot charts and deeper game analytics.",
    benefits: [
      "Tap-the-court location stat tracking",
      "Shot charts built from real shot locations",
      "Substitution tracking and lineup insight",
      "Advanced game history and reports",
    ],
  },
  {
    key: "team_hub_plus",
    name: "Team Hub+",
    price: 6,
    blurb: "Deeper Locker Room, assignments, resources and Google Calendar sync.",
    benefits: [
      "Advanced Locker Room messaging and assignments",
      "Team resources and staff collaboration",
      "Google Calendar sync",
      "Richer parent and family sharing",
    ],
  },
];

export const MODULES: Record<ModuleKey, ModuleInfo> = Object.fromEntries(
  MODULE_LIST.map((m) => [m.key, m]),
) as Record<ModuleKey, ModuleInfo>;

export const ALL_MODULES: ModuleKey[] = MODULE_LIST.map((m) => m.key);

export const COMPLETE_PRICE = 15;
export const COMPLETE_NAME = "CoachSide Complete";
export const COMPLETE_BLURB = "All three modules on one monthly team charge — $3 off.";

/** Free Core features, listed so the membership page can be honest about them. */
export const FREE_CORE: string[] = [
  "Coach's Board / Timeout Board",
  "Roster and player QR onboarding",
  "Schedule and calendar viewing",
  "Browse the public CoachSide Play Library",
  "Create plays in Playmaker",
  "Basic stat entry and basic Locker Room",
];

/** One monthly price for the whole selection. Three modules become Complete. */
export function priceFor(modules: ModuleKey[]): number {
  const n = new Set(modules).size;
  if (n >= 3) return COMPLETE_PRICE;
  return n * 6;
}

export function isComplete(modules: ModuleKey[]): boolean {
  return ALL_MODULES.every((m) => modules.includes(m));
}

/** Plan tier the billing provider charges: one recurring plan per team. */
export type PlanTier = "free" | "single" | "duo" | "complete";

export function planTier(modules: ModuleKey[]): PlanTier {
  const n = new Set(modules).size;
  if (n >= 3) return "complete";
  if (n === 2) return "duo";
  if (n === 1) return "single";
  return "free";
}

export type BillingStatus =
  | "free"
  | "pending"
  | "active"
  | "grace"
  | "past_due"
  | "canceled"
  | "complimentary";

export const STATUS_LABEL: Record<BillingStatus, string> = {
  free: "Free Core",
  pending: "Awaiting payment confirmation",
  active: "Active",
  grace: "Payment issue — access continues",
  past_due: "Payment past due",
  canceled: "Canceled",
  complimentary: "Complimentary",
};

export type Entitlement = {
  teamId: string | null;
  modules: ModuleKey[];
  status: BillingStatus;
  complete: boolean;
  complimentary: boolean;
  currentPeriodEnd: string | null;
  /** False while BILLING_ENFORCEMENT_ENABLED is off: nothing is locked. */
  enforced: boolean;
  loading: boolean;
};

export const NO_ENTITLEMENT: Entitlement = {
  teamId: null,
  modules: [],
  status: "free",
  complete: false,
  complimentary: false,
  currentPeriodEnd: null,
  enforced: false,
  loading: false,
};

/** Single read point for gating. Always allows while enforcement is off. */
export function hasModule(entitlement: Entitlement, key: ModuleKey): boolean {
  if (!entitlement.enforced) return true;
  return entitlement.modules.includes(key);
}

type RawEntitlement = {
  team_id: string | null;
  modules: string[] | null;
  status: string | null;
  current_period_end: string | null;
  complimentary: boolean | null;
};

async function fetchTeamEntitlement(teamId: string): Promise<RawEntitlement | null> {
  const { data, error } = await supabase.rpc(
    "my_team_entitlement" as never,
    { _team: teamId } as never,
  );
  if (error) throw error;
  return (data ?? null) as RawEntitlement | null;
}

/** Server-owned switch. Kept separate so no client value can turn locks on. */
async function fetchEnforcement(): Promise<boolean> {
  const { getBillingConfig } = await import("./billing.functions");
  const cfg = await getBillingConfig();
  return cfg.enforcementEnabled;
}

/** Everything a screen needs to decide what this team can use. */
export function useEntitlement(teamId: string | null): Entitlement {
  const ent = useQuery({
    queryKey: ["team-entitlement", teamId],
    queryFn: () => fetchTeamEntitlement(teamId!),
    enabled: !!teamId,
    staleTime: 60_000,
  });
  const enforcement = useQuery({
    queryKey: ["billing-enforcement"],
    queryFn: fetchEnforcement,
    staleTime: 300_000,
  });

  const modules = ((ent.data?.modules ?? []) as string[]).filter((m): m is ModuleKey =>
    ALL_MODULES.includes(m as ModuleKey),
  );
  return {
    teamId,
    modules,
    status: ((ent.data?.status as BillingStatus) ?? "free") as BillingStatus,
    complete: isComplete(modules),
    complimentary: !!ent.data?.complimentary,
    currentPeriodEnd: ent.data?.current_period_end ?? null,
    enforced: enforcement.data === true,
    loading: ent.isLoading || enforcement.isLoading,
  };
}
