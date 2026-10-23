import { describe, expect, it } from "vitest";
import { SNOOZE_MS, installPlatform, isSnoozed, shouldShowInstall, snoozeUntil } from "./installPrompt";

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

describe("install prompt snooze", () => {
  it("Later hides the prompt for about 24 hours, not forever", () => {
    expect(SNOOZE_MS).toBe(24 * HOUR);
    const until = snoozeUntil(NOW);
    expect(shouldShowInstall({ installed: false, platform: "prompt", snoozedUntil: until, now: NOW + 23 * HOUR })).toBe(false);
    expect(shouldShowInstall({ installed: false, platform: "prompt", snoozedUntil: until, now: NOW + 25 * HOUR })).toBe(true);
  });

  it("an installed app is never prompted, even after the snooze ends", () => {
    expect(shouldShowInstall({ installed: true, platform: "ios", snoozedUntil: null, now: NOW })).toBe(false);
  });

  it("onboarding's install step still shows while snoozed", () => {
    expect(
      shouldShowInstall({ installed: false, platform: "ios", snoozedUntil: snoozeUntil(NOW), now: NOW, ignoreSnooze: true }),
    ).toBe(true);
  });

  it("devices with no install path are not prompted", () => {
    expect(shouldShowInstall({ installed: false, platform: "none", snoozedUntil: null, now: NOW })).toBe(false);
  });

  it("garbage snooze values do not hide the prompt", () => {
    expect(isSnoozed(Number.NaN, NOW)).toBe(false);
    expect(isSnoozed(null, NOW)).toBe(false);
  });
});

describe("install platform", () => {
  it("prefers the native Chrome/Android prompt, then iPhone steps, then Android menu steps", () => {
    expect(installPlatform({ hasPrompt: true, ios: false, android: true })).toBe("prompt");
    expect(installPlatform({ hasPrompt: false, ios: true, android: false })).toBe("ios");
    expect(installPlatform({ hasPrompt: false, ios: false, android: true })).toBe("android");
    expect(installPlatform({ hasPrompt: false, ios: false, android: false })).toBe("none");
  });
});
