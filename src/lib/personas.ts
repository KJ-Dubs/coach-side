/**
 * Launch QA entitlement personas. Preview-only: stored in the owner's own
 * browser session and applied only when the signed-in account is an app admin.
 * Never written to billing.
 */
import type { BillingStatus, ModuleKey } from "./entitlements";

export type PersonaKey =
  | "free"
  | "trial_14"
  | "trial_3"
  | "trial_expired"
  | "playbook"
  | "gameday"
  | "teamhub"
  | "playbook_gameday"
  | "playbook_teamhub"
  | "gameday_teamhub"
  | "complete"
  | "past_due"
  | "cancel_at_period_end";

export type Persona = {
  key: PersonaKey;
  label: string;
  modules: ModuleKey[];
  status: BillingStatus;
  trialDaysLeft: number | null;
  trialExpired?: boolean;
  cancelAtPeriodEnd?: boolean;
};

const ALL: ModuleKey[] = ["playbook_plus", "gameday_plus", "team_hub_plus"];

export const PERSONAS: Persona[] = [
  { key: "free", label: "Free", modules: [], status: "free", trialDaysLeft: null },
  { key: "trial_14", label: "Trial day 1 (14 left)", modules: ALL, status: "free", trialDaysLeft: 14 },
  { key: "trial_3", label: "Trial — 3 days left", modules: ALL, status: "free", trialDaysLeft: 3 },
  { key: "trial_expired", label: "Trial expired", modules: [], status: "free", trialDaysLeft: 0, trialExpired: true },
  { key: "playbook", label: "Playbook+ ($6)", modules: ["playbook_plus"], status: "active", trialDaysLeft: null },
  { key: "gameday", label: "GameDay+ ($6)", modules: ["gameday_plus"], status: "active", trialDaysLeft: null },
  { key: "teamhub", label: "Team Hub+ ($6)", modules: ["team_hub_plus"], status: "active", trialDaysLeft: null },
  { key: "playbook_gameday", label: "Playbook+ & GameDay+ ($12)", modules: ["playbook_plus", "gameday_plus"], status: "active", trialDaysLeft: null },
  { key: "playbook_teamhub", label: "Playbook+ & Team Hub+ ($12)", modules: ["playbook_plus", "team_hub_plus"], status: "active", trialDaysLeft: null },
  { key: "gameday_teamhub", label: "GameDay+ & Team Hub+ ($12)", modules: ["gameday_plus", "team_hub_plus"], status: "active", trialDaysLeft: null },
  { key: "complete", label: "Complete ($15)", modules: ALL, status: "active", trialDaysLeft: null },
  { key: "past_due", label: "Past due", modules: ALL, status: "past_due", trialDaysLeft: null },
  { key: "cancel_at_period_end", label: "Canceled at period end", modules: ALL, status: "active", trialDaysLeft: null, cancelAtPeriodEnd: true },
];

const KEY = "coachside.qa.persona";
export const PERSONA_EVENT = "coachside-persona-change";

export function readPersona(): PersonaKey | null {
  if (typeof window === "undefined") return null;
  try {
    return (sessionStorage.getItem(KEY) as PersonaKey | null) ?? null;
  } catch {
    return null;
  }
}

export function writePersona(key: PersonaKey | null) {
  try {
    if (key) sessionStorage.setItem(KEY, key);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PERSONA_EVENT));
}
