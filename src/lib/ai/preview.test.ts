import { describe, expect, it } from "vitest";
import { buildEventPreview, buildRosterPreview, normalizeTime, previewCounts } from "./preview";
import { AI_LIMITS, dataUrlBytes, isAllowedAttachmentType } from "./limits";

describe("schedule extraction preview", () => {
  it("never invents a missing time: the row needs review and is not included", () => {
    const [row] = buildEventPreview([{ event_type: "game", date: "2026-11-20", starts_at: null, opponent: "Mission Viejo", confidence: 0.9 }]);
    expect(row!.status).toBe("review");
    expect(row!.include).toBe(false);
    expect(row!.start_time).toBeNull();
  });

  it("flags low-confidence rows for review", () => {
    const [row] = buildEventPreview([{ event_type: "practice", date: "2026-10-22", starts_at: "16:30", confidence: 0.4 }]);
    expect(row!.status).toBe("review");
  });

  it("marks an event already on the schedule as a duplicate", () => {
    const [row] = buildEventPreview(
      [{ event_type: "practice", date: "2026-10-22", starts_at: "4:30 PM", confidence: 0.95 }],
      [{ event_type: "practice", title: "Practice", starts_local: "2026-10-22T16:30" }],
    );
    expect(row!.status).toBe("duplicate");
    expect(row!.include).toBe(false);
  });

  it("warns about a nearby event without blocking it", () => {
    const [row] = buildEventPreview(
      [{ event_type: "game", date: "2026-10-22", starts_at: "17:00", opponent: "East High", confidence: 0.9 }],
      [{ event_type: "practice", title: "Practice", starts_local: "2026-10-22T16:30" }],
    );
    expect(row!.status).toBe("ready");
    expect(row!.conflict).toContain("Practice");
  });

  it("keeps opponent wording and titles games from it", () => {
    const [row] = buildEventPreview([{ event_type: "game", date: "2026-12-01", starts_at: "19:00", opponent: "Capistrano Valley", confidence: 1 }]);
    expect(row!.title).toBe("vs Capistrano Valley");
    expect(row!.opponent).toBe("Capistrano Valley");
  });

  it("caps an upload at the event limit", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ event_type: "game" as const, date: "2026-12-01", starts_at: `${10 + (i % 10)}:00`, confidence: 1 }));
    expect(buildEventPreview(many)).toHaveLength(AI_LIMITS.maxExtractedEvents);
  });

  it("reads common time formats and rejects a bare number", () => {
    expect(normalizeTime("4:30 PM")).toBe("16:30");
    expect(normalizeTime("12 am")).toBe("00:00");
    expect(normalizeTime("2026-10-22T09:05")).toBe("09:05");
    expect(normalizeTime("4")).toBeNull();
  });
});

describe("roster extraction preview", () => {
  const roster = [
    { jersey: "12", name: "Marcus Lee" },
    { jersey: "5", name: "Devon Hall" },
  ];

  it("flags a jersey already on the roster as a duplicate", () => {
    const [row] = buildRosterPreview([{ jersey: "12", name: "Chris Park", confidence: 0.9 }], roster);
    expect(row!.status).toBe("duplicate");
    expect(row!.issues[0]).toContain("#12 is already Marcus Lee");
  });

  it("flags a name already on the roster under another jersey for review", () => {
    const [row] = buildRosterPreview([{ jersey: "23", name: "Devon Hall", confidence: 0.9 }], roster);
    expect(row!.status).toBe("review");
  });

  it("flags a jersey repeated within the same upload", () => {
    const rows = buildRosterPreview([
      { jersey: "4", name: "John Smith", confidence: 0.9 },
      { jersey: "4", name: "Sam Ortiz", confidence: 0.9 },
    ]);
    expect(rows[0]!.status).toBe("ready");
    expect(rows[1]!.status).toBe("review");
  });

  it("counts ready / review / duplicate rows", () => {
    const rows = buildRosterPreview(
      [
        { jersey: "4", name: "John Smith", confidence: 0.9 },
        { jersey: "12", name: "Chris Park", confidence: 0.9 },
        { jersey: "?", name: "Unknown", confidence: 0.9 },
      ],
      roster,
    );
    expect(previewCounts(rows)).toEqual({ total: 3, ready: 1, review: 1, duplicate: 1 });
  });
});

describe("upload guards", () => {
  it("accepts only JPEG, PNG, WebP and PDF", () => {
    expect(isAllowedAttachmentType("image/png")).toBe(true);
    expect(isAllowedAttachmentType("application/pdf")).toBe(true);
    expect(isAllowedAttachmentType("image/gif")).toBe(false);
  });

  it("measures decoded data-URL size", () => {
    expect(dataUrlBytes("data:image/png;base64,AAAA")).toBe(3);
  });
});
