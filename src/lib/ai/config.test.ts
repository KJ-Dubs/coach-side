import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/coachside/service";
import { readAssistantEnabled } from "./config.server";

const dbReturning = (data: unknown, error: unknown = null) =>
  ({ rpc: async () => ({ data, error }) }) as unknown as Db;

describe("CoachSide AI launch switch fails closed", () => {
  it("is on only when the switch is explicitly true", async () => {
    expect(await readAssistantEnabled(dbReturning(true))).toBe(true);
  });

  it("is off when the switch is false", async () => {
    expect(await readAssistantEnabled(dbReturning(false))).toBe(false);
  });

  it("is off when no setting exists yet", async () => {
    expect(await readAssistantEnabled(dbReturning(null))).toBe(false);
  });

  it("is off when the setting cannot be read", async () => {
    expect(await readAssistantEnabled(dbReturning(null, { message: "boom" }))).toBe(false);
  });
});
