/**
 * Pure rules for when CoachSide asks a coach to install the app.
 *
 * "Later" is a snooze, never a permanent dismissal: the prompt comes back
 * after SNOOZE_MS until the app is installed. Once installed (or running from
 * the home screen) we stop asking for good.
 */
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

export const SNOOZE_KEY = "coachside.install.snoozedUntil";
/** Old permanent dismissal flag; cleared so those coaches see the prompt again. */
export const LEGACY_DISMISS_KEY = "coachside.install.dismissed";
/** Set once this browser has installed CoachSide or opened it from the home screen. */
export const INSTALLED_KEY = "coachside.install.done";

export function snoozeUntil(now: number): number {
  return now + SNOOZE_MS;
}

export function isSnoozed(until: number | null | undefined, now: number): boolean {
  return typeof until === "number" && Number.isFinite(until) && until > now;
}

export type InstallPlatform = "prompt" | "ios" | "android" | "none";

/** Which install path this device can actually take. */
export function installPlatform(o: { hasPrompt: boolean; ios: boolean; android: boolean }): InstallPlatform {
  if (o.hasPrompt) return "prompt";
  if (o.ios) return "ios";
  if (o.android) return "android";
  return "none";
}

/** Whether an install prompt should be visible right now. */
export function shouldShowInstall(o: {
  installed: boolean;
  platform: InstallPlatform;
  snoozedUntil: number | null;
  now: number;
  /** Onboarding's own install step ignores the snooze (it is a step, not a nag). */
  ignoreSnooze?: boolean;
}): boolean {
  if (o.installed) return false;
  if (o.platform === "none") return false;
  if (!o.ignoreSnooze && isSnoozed(o.snoozedUntil, o.now)) return false;
  return true;
}
