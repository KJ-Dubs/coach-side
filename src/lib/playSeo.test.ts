import { describe, expect, it } from "vitest";
import {
  PLAY_TITLE_MAX,
  playSeoDescription,
  playSeoKeywords,
  playSeoTerms,
  playSeoTitle,
} from "./playSeo";

const indexed = {
  name: "Box Elevator",
  category: "Offense",
  author_label: "Coach K",
  concepts: ["5 Out", "Motion"],
  defenses: ["Man to man", "2-3 zone"],
  outcomes: ["Rim finish", "3-point look"],
  primary_actions: ["Ball screen", "Backdoor"],
  tags: ["elevator"],
};

describe("play search titles", () => {
  it("puts the play name, lead concept, type and defense in the title", () => {
    expect(playSeoTitle(indexed)).toBe(
      "Box Elevator – 5 Out Offense Basketball Play vs Man to man | CoachSide",
    );
  });

  it("adds the outcome and brand when there is room", () => {
    expect(playSeoTitle({ name: "Zip", category: "Offense", outcomes: ["Rim finish"] })).toBe(
      "Zip – Offense Basketball Play for Rim finish | CoachSide",
    );
  });

  it("names BLOB plays as inbound plays without repeating BLOB as a concept", () => {
    const t = playSeoTitle({ name: "Box 1", category: "BLOB", concepts: ["BLOB"] });
    expect(t).toBe("Box 1 – BLOB Inbound Basketball Play | CoachSide");
  });

  it("never exceeds the title length limit when extras are present", () => {
    const t = playSeoTitle({ ...indexed, name: "A Fairly Long Coach Play Name Here" });
    expect(t.length).toBeLessThanOrEqual(PLAY_TITLE_MAX);
  });

  it("reads legacy scalar index fields from older plays", () => {
    const terms = playSeoTerms({
      name: "Old",
      category: "Offense",
      situation: "Sideline out of bounds",
      defense_faced: "1-3-1 zone",
      outcome: "Mid-range",
    });
    expect(terms.concepts).toEqual(["SLOB"]);
    expect(terms.defenses).toEqual(["1-3-1 zone"]);
    expect(terms.outcomes).toEqual(["Mid-range"]);
  });

  it("files old Press Defense plays as press plays", () => {
    expect(playSeoTitle({ name: "Diamond", category: "Press Defense" })).toBe(
      "Diamond – Press Basketball Play | CoachSide",
    );
  });
});

describe("play search descriptions", () => {
  it("includes every indexed concept, defense, outcome and action", () => {
    expect(playSeoDescription(indexed)).toBe(
      "Box Elevator is an animated 5 Out and motion offense basketball play vs man to man and 2-3 zone, built for a rim finish or 3-point look. Key actions: ball screen and backdoor. Watch it free on CoachSide, published by Coach K.",
    );
  });

  it("lists every term as a keyword", () => {
    expect(playSeoKeywords(indexed)).toEqual([
      "Offense basketball play",
      "5 Out",
      "Motion",
      "vs Man to man",
      "vs 2-3 zone",
      "Rim finish",
      "3-point look",
      "Ball screen",
      "Backdoor",
      "elevator",
      "animated basketball play",
    ]);
  });
});
