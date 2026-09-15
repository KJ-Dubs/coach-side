/**
 * Membership shape only — no billing is wired up yet.
 *
 * These constants exist so pricing copy lives in one place and so contextual
 * upgrade panels can describe a real benefit. Nothing here blocks a coach:
 * `hasModule` returns true for everyone until a real entitlement source exists.
 */

export type ModuleKey = "playbook_plus" | "gameday_plus" | "team_hub_plus" | "complete";

export type ModuleInfo = {
  key: ModuleKey;
  name: string;
  price: number;
  blurb: string;
};

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  playbook_plus: {
    key: "playbook_plus",
    name: "Playbook+",
    price: 6,
    blurb: "Save Library plays, unlimited team playbooks and video exports.",
  },
  gameday_plus: {
    key: "gameday_plus",
    name: "GameDay+",
    price: 6,
    blurb: "Advanced live-game reports, shot charts and season PDF exports.",
  },
  team_hub_plus: {
    key: "team_hub_plus",
    name: "Team Hub+",
    price: 6,
    blurb: "Locker Room messaging, assignments and calendar sync for the whole team.",
  },
  complete: {
    key: "complete",
    name: "CoachSide Complete",
    price: 15,
    blurb: "All three modules on one monthly team charge.",
  },
};

export const PAID_MODULES: ModuleInfo[] = [
  MODULES.playbook_plus,
  MODULES.gameday_plus,
  MODULES.team_hub_plus,
];

export type Entitlement = {
  /** Every module a team currently holds. Empty until billing ships. */
  modules: ModuleKey[];
  /** True once CoachSide Complete is held, which hides membership prompts. */
  complete: boolean;
  /** Billing is not live, so nothing is enforced yet. */
  enforced: boolean;
};

export const NO_ENTITLEMENT: Entitlement = { modules: [], complete: false, enforced: false };

/** Single read point for future gating. Always allows while billing is off. */
export function hasModule(entitlement: Entitlement, key: ModuleKey): boolean {
  if (!entitlement.enforced) return true;
  return entitlement.complete || entitlement.modules.includes(key);
}

/** Memberships are one recurring charge per team, never one charge per module. */
export function useEntitlement(): Entitlement {
  return NO_ENTITLEMENT;
}
