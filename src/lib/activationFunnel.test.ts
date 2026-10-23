import { describe, expect, it } from "vitest";
import { computeActivationFunnel } from "./activationFunnel";

const count = (steps: ReturnType<typeof computeActivationFunnel>, key: string) =>
  steps.find((s) => s.key === key)!.count;

describe("activation funnel", () => {
  it("counts only coaches in the signup group", () => {
    const steps = computeActivationFunnel({
      cohort: ["a"],
      events: [
        { user_id: "a", event_type: "onboarding_started", created_at: "2026-10-01T10:00:00Z" },
        { user_id: "z", event_type: "onboarding_started", created_at: "2026-10-01T10:00:00Z" },
      ],
    });
    expect(count(steps, "signup")).toBe(1);
    expect(count(steps, "started")).toBe(1);
  });

  it("walks the install path: saw install, installed, notifications", () => {
    const steps = computeActivationFunnel({
      cohort: ["a", "b"],
      events: [
        { user_id: "a", event_type: "install_prompt_shown", created_at: "2026-10-01T10:00:00Z" },
        { user_id: "b", event_type: "install_prompt_shown", created_at: "2026-10-01T10:00:00Z" },
        { user_id: "a", event_type: "pwa_installed", created_at: "2026-10-01T10:05:00Z" },
        { user_id: "a", event_type: "notifications_enabled", created_at: "2026-10-01T10:06:00Z" },
      ],
    });
    expect(count(steps, "saw_install")).toBe(2);
    expect(count(steps, "installed")).toBe(1);
    expect(count(steps, "notifications")).toBe(1);
    expect(steps.find((s) => s.key === "installed")!.pctOfSignups).toBe(50);
  });

  it("returned second session needs activity on two different days", () => {
    const steps = computeActivationFunnel({
      cohort: ["a", "b"],
      events: [
        { user_id: "a", event_type: "session_day", created_at: "2026-10-01T10:00:00Z" },
        { user_id: "a", event_type: "session_day", created_at: "2026-10-03T10:00:00Z" },
        { user_id: "b", event_type: "session_day", created_at: "2026-10-01T10:00:00Z" },
        { user_id: "b", event_type: "signed_in", created_at: "2026-10-01T18:00:00Z" },
      ],
    });
    expect(count(steps, "returned")).toBe(1);
  });

  it("first meaningful action includes a play created even without an event", () => {
    const steps = computeActivationFunnel({ cohort: ["a", "b"], events: [], playCreators: new Set(["b"]) });
    expect(count(steps, "first_action")).toBe(1);
  });

  it("an active push subscription counts as notifications enabled", () => {
    const steps = computeActivationFunnel({ cohort: ["a"], events: [], pushOn: new Set(["a"]) });
    expect(count(steps, "notifications")).toBe(1);
  });
});
