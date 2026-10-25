import { describe, expect, it } from "vitest";
import { BOARD_SITUATIONS, DISCOVERY_FILTERS, matchesDiscovery, matchesQuery, playsForTeam, sortPlays } from "./playbookFilters";
import type { Play } from "./types";

const play = (patch: Partial<Play> = {}): Play => ({
  id: "test", name: "Horns", category: "Offense", team_id: null,
  attack_basket: "right", is_shared: false, share_token: null, ...patch,
});

describe("grouped Playbook discovery", () => {
  it("matches multiple play types with OR, including legacy Press Defense", () => {
    const keys = ["type:BLOB", "type:SLOB"];
    expect(matchesDiscovery(play({ category: "BLOB" }), keys)).toBe(true);
    expect(matchesDiscovery(play({ category: "SLOB" }), keys)).toBe(true);
    expect(matchesDiscovery(play(), keys)).toBe(false);
    expect(matchesDiscovery(play({ category: "Press Defense" }), ["type:Presses"])).toBe(true);
  });
  it("requires type AND structure AND defense AND outcome", () => {
    const keys = ["type:Offense", "concepts:5 Out", "zone", "three"];
    const p = play({ concepts: ["5 Out"], defenses: ["2-3 zone"], outcomes: ["3-point look"] });
    expect(matchesDiscovery(p, keys)).toBe(true);
    for (const patch of [{ category: "BLOB" }, { concepts: ["Motion"] }, { defenses: ["Man to man"] }, { outcomes: ["Rim finish"] }]) {
      expect(matchesDiscovery({ ...p, ...patch }, keys)).toBe(false);
    }
  });
  it("ORs choices within structure, defenses and outcomes but ANDs actions", () => {
    const keys = ["concepts:Motion", "concepts:5 Out", "defenses:Man to man", "defenses:2-3 zone", "outcomes:Rim finish", "outcomes:Post touch", "actions:Cut"];
    expect(matchesDiscovery(play({ concepts: ["Motion"], defenses: ["2-3 zone"], outcomes: ["Post touch"], primary_actions: ["Cut"] }), keys)).toBe(true);
    expect(matchesDiscovery(play({ concepts: ["Motion"], defenses: ["2-3 zone"], outcomes: ["Post touch"] }), keys)).toBe(false);
  });
  it("reads legacy indexing and searches folders, tags, actions and legacy values", () => {
    const p = play({ situation: "Half court set", defense_faced: "2-3 zone", outcome: "Rim finish", tags: ["special"], primary_actions: ["Handoff"] });
    expect(matchesDiscovery(p, ["concepts:Set", "zone", "outcomes:Rim finish"])).toBe(true);
    for (const query of ["Horns", "Offense", "special", "zone", "Rim", "half court", "handoff", "Scouting"]) {
      expect(matchesQuery(p, query, ["Scouting"])).toBe(true);
    }
  });
  it("uses actual timestamps rather than incoming order for sort", () => {
    const old = play({ id: "old", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-10T00:00:00Z" });
    const recent = play({ id: "recent", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" });
    expect(sortPlays([old, recent], "newest").map((p) => p.id)).toEqual(["recent", "old"]);
    expect(sortPlays([recent, old], "oldest").map((p) => p.id)).toEqual(["old", "recent"]);
    expect(sortPlays([recent, old], "updated").map((p) => p.id)).toEqual(["old", "recent"]);
  });
  it("has unique keys and empty filters preserve the scoped list", () => {
    expect(new Set(DISCOVERY_FILTERS.map((f) => f.key)).size).toBe(DISCOVERY_FILTERS.length);
    expect(matchesDiscovery(play(), [])).toBe(true);
    expect(matchesDiscovery(play(), ["retired-filter"])).toBe(true);
  });
});
describe("Timeout Board playbook picker", () => {
  it("scopes to plays sourced from or assigned to the chosen team only", () => {
    const own = play({ id: "own", team_id: "t1" });
    const shared = play({ id: "shared", team_id: "t2" });
    const other = play({ id: "other", team_id: "t2" });
    const out = playsForTeam([own, shared, other], [{ play_id: "shared", team_id: "t1" }], "t1");
    expect(out.map((p) => p.id)).toEqual(["own", "shared"]);
    expect(playsForTeam([own], [], null)).toEqual([]);
  });
  it("situation shortcuts reuse existing discovery filters", () => {
    for (const s of BOARD_SITUATIONS) expect(DISCOVERY_FILTERS.some((f) => f.key === s.key)).toBe(true);
    expect(matchesDiscovery(play({ category: "BLOB" }), ["type:BLOB"])).toBe(true);
    expect(matchesDiscovery(play({ outcomes: ["3-point look"] }), ["three"])).toBe(true);
    expect(matchesDiscovery(play({ outcomes: ["Rim finish"] }), ["three"])).toBe(false);
  });
});
