import { describe, expect, it } from "vitest";
import { DRILL_TITLE_MAX, drillSeoDescription, drillSeoKeywords, drillSeoTitle } from "./drillSeo";

const mikan = {
  name: "Mikan Series",
  category: "Finishing",
  duration_minutes: 6,
  group_size: "Individual",
  difficulty: "All levels",
  skill_focus: ["finishing", "footwork"],
  equipment: ["1 ball"],
  library_author_name: "CoachSide",
};

describe("drill search titles", () => {
  it("uses name, category, minutes and group size", () => {
    expect(drillSeoTitle(mikan)).toBe(
      "Mikan Series – Finishing Basketball Drill, 6 min, Individual | CoachSide",
    );
  });

  it("drops extras that would make the title too long", () => {
    const t = drillSeoTitle({ ...mikan, name: "Wing Close-Out 1v1 Advanced", category: "Defense", group_size: "Small group", duration_minutes: 10 });
    expect(t).toBe("Wing Close-Out 1v1 Advanced – Defense Basketball Drill, 10 min");
    expect(t.length).toBeLessThanOrEqual(DRILL_TITLE_MAX);
  });

  it("skips a missing or zero duration", () => {
    expect(drillSeoTitle({ ...mikan, duration_minutes: 0 })).toBe(
      "Mikan Series – Finishing Basketball Drill, Individual | CoachSide",
    );
  });
});

describe("drill search descriptions", () => {
  it("states minutes, category, group, skills, level and equipment", () => {
    expect(drillSeoDescription(mikan)).toBe(
      "Mikan Series is a 6-minute finishing basketball drill for individual players. Skill focus: finishing and footwork. Level: all levels. Equipment: 1 ball. Includes step-by-step instructions, coaching points and a court diagram. Free on CoachSide, published by CoachSide.",
    );
  });

  it("uses 'an' before 8, 11 and 18 minute drills", () => {
    expect(drillSeoDescription({ ...mikan, duration_minutes: 8 })).toMatch(/^Mikan Series is an 8-minute/);
  });

  it("describes team drills as for a full team", () => {
    expect(drillSeoDescription({ ...mikan, group_size: "Team" })).toContain("for a full team.");
  });

  it("lists category, skills, group and level as keywords", () => {
    expect(drillSeoKeywords(mikan)).toEqual([
      "finishing basketball drill",
      "finishing",
      "footwork",
      "individual basketball drill",
      "all levels basketball drill",
      "basketball drill",
    ]);
  });
});
