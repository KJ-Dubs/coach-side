import { describe, expect, it } from "vitest";
import { hasAiAssistant } from "./aiAccess";
import { ALL_MODULES } from "./entitlements";

describe("CoachSide AI is a Complete-only benefit", () => {
  it("unlocks for CoachSide Complete (all three modules, paid, complimentary or trial)", () => {
    expect(hasAiAssistant(["playbook_plus", "gameday_plus", "team_hub_plus"], true)).toBe(true);
  });

  it("stays locked on Free Core", () => {
    expect(hasAiAssistant([], true)).toBe(false);
    expect(hasAiAssistant(null, true)).toBe(false);
  });

  it("stays locked on any single $6 module", () => {
    for (const m of ALL_MODULES) expect(hasAiAssistant([m], true)).toBe(false);
  });

  it("stays locked on any $12 two-module plan", () => {
    expect(hasAiAssistant(["playbook_plus", "gameday_plus"], true)).toBe(false);
    expect(hasAiAssistant(["playbook_plus", "team_hub_plus"], true)).toBe(false);
    expect(hasAiAssistant(["gameday_plus", "team_hub_plus"], true)).toBe(false);
  });

  it("ignores unknown module names", () => {
    expect(hasAiAssistant(["playbook_plus", "gameday_plus", "ai"], true)).toBe(false);
  });

  it("is open to everyone only while billing enforcement is switched off", () => {
    expect(hasAiAssistant([], false)).toBe(true);
  });

  it("uses the same three modules as membership pricing", () => {
    expect(hasAiAssistant(ALL_MODULES, true)).toBe(true);
  });
});
