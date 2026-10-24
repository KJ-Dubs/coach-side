import { describe, expect, it } from "vitest";
import { DEFAULT_EXPORT_OPTIONS, FORMAT_SIZE, INTRO_SECONDS, VIDEO_COURT_CTA, VIDEO_INTRO_MESSAGE, frameCounts, introState, videoCamera, videoComposition, videoPalette, type ExportModel } from "./playVideo";

describe("play video palette parity", () => {
  const values: Record<string, string> = {
    "--coachside-grape": "purple", "--coachside-flame": "orange",
    "--play-primary": "blue", "--play-secondary": "gold",
    "--play-primary-foreground": "dark", "--play-offense-label": "blue",
    "--basketball": "orange", "--defense-accent": "white",
  };
  const read = (name: string, fallback: string) => values[name] ?? fallback;
  it("uses the screen's play tokens but preserves ball, court and branding", () => {
    const p = videoPalette("play", read);
    expect([p.playPrimary, p.playSecondary, p.playForeground, p.offenseLabel, p.defense]).toEqual(["blue", "gold", "dark", "blue", "white"]);
    expect([p.grape, p.flame, p.basketball]).toEqual(["purple", "orange", "orange"]);
    expect(p.court).toBe("#23232a");
    expect(p.line).toBe("#6b6b78");
  });
  it("leaves drill diagram colors on their existing semantic defaults", () => {
    const p = videoPalette("drill", read);
    expect([p.playPrimary, p.playSecondary, p.defense, p.basketball]).toEqual(["purple", "orange", "orange", "orange"]);
  });
});

describe("play-only intro timeline", () => {
  const model: ExportModel = { name: "Test play", category: "Offense", flip: false, frames: [], steps: [] };

  it("defaults to a fixed 78-frame silent intro and keeps the 54-frame outro", () => {
    expect(DEFAULT_EXPORT_OPTIONS.showIntro).toBe(true);
    expect(INTRO_SECONDS).toBe(2.6);
    expect(VIDEO_INTRO_MESSAGE).toBe("INCOMING BASKETBALL PLAY");
    const on = frameCounts(model, DEFAULT_EXPORT_OPTIONS);
    const off = frameCounts(model, { ...DEFAULT_EXPORT_OPTIONS, showIntro: false });
    expect(on.introFrames).toBe(78);
    expect(on.outroFrames).toBe(54);
    expect(on.total - off.total).toBe(78);
    expect(on.showFrames).toBe(off.showFrames);
    expect(on.doFrames).toBe(off.doFrames);
    expect(on.holdFrames).toBe(off.holdFrames);
  });

  it("never adds an intro to drills, even with the toggle enabled", () => {
    expect(frameCounts({ ...model, kind: "drill" }, DEFAULT_EXPORT_OPTIONS).introFrames).toBe(0);
  });

  it("preserves play defaults for legacy callers without showIntro", () => {
    const { showIntro: _intro, ...legacy } = DEFAULT_EXPORT_OPTIONS;
    expect(frameCounts(model, legacy).introFrames).toBe(78);
  });

  for (const format of ["vertical", "square", "landscape"] as const) {
    for (const speed of ["slow", "normal", "fast"] as const) {
      it(`${format}/${speed}: keeps intro timing independent of animation speed`, () => {
        expect(frameCounts(model, { ...DEFAULT_EXPORT_OPTIONS, format, speed }).introFrames).toBe(78);
      });
    }
  }

  it("shows message first, then exactly 3 → 2 → 1 at the requested boundaries", () => {
    expect(introState(0).numeral).toBeNull();
    expect(introState(23 / 30).numeral).toBeNull();
    expect(introState(0.8).numeral).toBe("3");
    expect(introState(1.4).numeral).toBe("2");
    expect(introState(2).numeral).toBe("1");
    expect(introState(77 / 30).numeral).toBe("1");
    for (let f = 0; f < 78; f++) {
      const state = introState(f / 30);
      expect(state.opacity).toBeGreaterThan(0);
      expect(state.opacity).toBeLessThanOrEqual(1);
      expect(state.scale).toBeGreaterThanOrEqual(0.88);
      expect(state.scale).toBeLessThanOrEqual(1);
    }
  });
});

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
describe("video court view follows the play's saved view", () => {
  const tok = (x: number) => ({ id: `t${x}`, label: "1", x, y: 0.5, ball: false, team: "offense" as const });
  const play = (xs: number[], courtView: string | null): ExportModel => ({
    name: "View", category: "Offense", flip: false, courtView, steps: [],
    frames: [{ id: "f", play_id: "p", idx: 0, tokens: xs.map(tok), actions: [], note: null }],
  });

  it("crops Right/Left halves and rotates Top/Bottom to portrait", () => {
    expect(videoCamera(play([0.7, 0.9], "right"))).toEqual({ view: "right", w: 470, h: 500 });
    expect(videoCamera(play([0.1, 0.3], "left"))).toEqual({ view: "left", w: 470, h: 500 });
    expect(videoCamera(play([0.1, 0.3], "top"))).toEqual({ view: "top", w: 500, h: 470 });
    expect(videoCamera(play([0.7, 0.9], "bottom"))).toEqual({ view: "bottom", w: 500, h: 470 });
    expect(videoCamera(play([0.7, 0.9], "full"))).toEqual({ view: "full", w: 940, h: 500 });
  });

  it("falls back to Full Court when a saved half would hide geometry", () => {
    expect(videoCamera(play([0.2, 0.8], "right")).view).toBe("full");
  });

  it("keeps social format separate from court orientation", () => {
    for (const format of ["vertical", "square", "landscape"] as const) {
      const camera = videoCamera(play([0.1, 0.3], "top"));
      const layout = videoComposition(format, camera.w, camera.h);
      expect(layout.courtH / layout.courtW).toBeCloseTo(470 / 500);
      expect(layout.courtX).toBeGreaterThanOrEqual(layout.pad - 1);
      expect(layout.courtY + layout.courtH).toBeLessThan(layout.ctaY);
    }
  });
});
