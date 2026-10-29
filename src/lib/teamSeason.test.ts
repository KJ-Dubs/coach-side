import { describe, expect, it } from "vitest";
import {
  attendanceEligibleTeam,
  pickCurrentTeam,
  splitSeasons,
  suggestNextSeason,
  suppressTeamAlert,
  teamAfterArchive,
} from "./teamSeason";

const active = { id: "a", season_status: "active", is_training_team: false };
const archived = { id: "b", season_status: "archived", is_training_team: false };
const training = { id: "c", season_status: "active", is_training_team: true };

describe("team seasons", () => {
  it("archived and training teams get no attendance prompts", () => {
    expect(attendanceEligibleTeam(active)).toBe(true);
    expect(attendanceEligibleTeam(archived)).toBe(false);
    expect(attendanceEligibleTeam(training)).toBe(false);
  });

  it("quiet teams suppress automatic schedule/game alerts but not chat-style alerts", () => {
    expect(suppressTeamAlert(training, "schedule")).toBe(true);
    expect(suppressTeamAlert(archived, "game")).toBe(true);
    expect(suppressTeamAlert(training, "announcement")).toBe(false);
    expect(suppressTeamAlert(active, "schedule")).toBe(false);
  });

  it("groups archived seasons separately; training teams stay active", () => {
    const { active: a, archived: b } = splitSeasons([archived, active, training]);
    expect(a.map((t) => t.id)).toEqual(["a", "c"]);
    expect(b.map((t) => t.id)).toEqual(["b"]);
  });

  it("defaults to an active season but honors an explicit past-season choice", () => {
    expect(pickCurrentTeam([archived, active], null)?.id).toBe("a");
    expect(pickCurrentTeam([archived, active], "b")?.id).toBe("b");
    expect(pickCurrentTeam([archived, active], "gone")?.id).toBe("a");
  });

  it("after archiving, lands on the new season, else another active team", () => {
    expect(teamAfterArchive([archived, active], "b", "new")).toBe("new");
    expect(teamAfterArchive([{ ...archived }, active], "b", null)).toBe("a");
    expect(teamAfterArchive([archived], "b", null)).toBe("b");
  });

  it("suggests the next season name", () => {
    expect(suggestNextSeason("2025-26")).toBe("2026-27");
    expect(suggestNextSeason("Fall 2025")).toBe("Fall 2026");
    expect(suggestNextSeason("Spring")).toBe("");
  });
});
