/**
 * Older builds cached a role/player id on the device. Authorization must
 * never read those, so remove them whenever the app loads or a session ends.
 */
const LEGACY_ROLE_KEYS = [
  "coachside.role",
  "coachside.player-id",
  "coachside.player-role",
  "coachside.team-role",
  "coachside.active-player",
  "coachside.access",
];

export function purgeDeviceRoleCache() {
  if (typeof window === "undefined") return;
  for (const k of LEGACY_ROLE_KEYS) {
    try {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  }
}
