import { describe, expect, it } from "vitest";
import { FORMAT_SIZE, VIDEO_COURT_CTA, videoComposition } from "./playVideo";

describe("downloaded video social composition", () => {
  it("uses the exact persistent sideline message", () => {
    expect(VIDEO_COURT_CTA).toBe("Add this to your playbook on CoachSide.live");
  });

  for (const format of ["vertical", "square", "landscape"] as const) {
    for (const viewWidth of [470, 940]) {
      it(`${format} / ${viewWidth}: keeps branding outside the unchanged court geometry`, () => {
        const layout = videoComposition(format, viewWidth);
        const titleTop = layout.courtY - layout.titleGap - layout.titlePreferred * 2.12;
        expect(titleTop).toBeGreaterThan(layout.logoY + layout.logoSize);
        expect(layout.ctaY).toBeGreaterThan(layout.courtY + layout.courtH + 50 * layout.unit);
        expect(layout.ctaY + 20 * layout.unit).toBeLessThan(layout.statusY);
        expect(layout.courtX).toBeGreaterThanOrEqual(layout.pad - 1);
        expect(layout.courtH / layout.courtW).toBeCloseTo(500 / viewWidth);
        expect(layout.courtY + layout.courtH).toBeLessThan(FORMAT_SIZE[format].h);
      });
    }
  }

  it("leaves explicit vertical top and bottom social safe zones", () => {
    const layout = videoComposition("vertical", 470);
    expect(layout.logoY).toBe(110);
    expect(layout.logoSize).toBe(170);
    expect(layout.titlePreferred).toBe(68);
    expect(layout.titleMinimum).toBe(44);
    expect(layout.statusY + 54).toBeLessThanOrEqual(layout.h - 110);
  });
});