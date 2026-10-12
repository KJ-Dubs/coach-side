import { describe, expect, it } from "vitest";
import { contrast, luminance, normalizeHex, readableForeground, safeAccent, similarColors, teamThemeEnabled, teamThemeVariables } from "./teamTheme";

describe("team accent layer", () => {
  it("normalizes valid hex and rejects malformed values", () => {
    expect(normalizeHex(" #abc ")).toBe("#AABBCC");
    expect(normalizeHex("#1d4ed8")).toBe("#1D4ED8");
    for (const value of [null, "red", "#12345678", "url(x)", "#xyzxyz"]) expect(normalizeHex(value)).toBeNull();
  });
  it("leaves defaults completely untouched and falls back individually", () => {
    expect(teamThemeVariables(null)).toEqual({});
    expect(teamThemeVariables({ primary_color: "bad", secondary_color: null })).toEqual({});
    expect(teamThemeVariables({ primary_color: null, secondary_color: "#FFFFFF" })["--grape"]).toBeUndefined();
  });
  it.each(["#FFFFFF", "#000000", "#FFFF00", "#1D4ED8", "#D40000", "#FF00FF", "#00FF00"])("derives visible accents and 4.5:1 control text for %s", (hex) => {
    const safe = safeAccent(hex);
    expect(luminance(safe)).toBeGreaterThanOrEqual(0.179);
    expect(luminance(safe)).toBeLessThanOrEqual(0.381);
    expect(contrast(safe, readableForeground(safe))).toBeGreaterThanOrEqual(4.5);
  });
  it("never overrides base, court, stat or semantic tokens", () => {
    const vars = teamThemeVariables({ primary_color: "#1D4ED8", secondary_color: "#FFD700" });
    for (const name of ["background", "surface", "foreground", "destructive", "green", "court", "court-line", "chart-4", "blue"]) expect(vars[`--${name}`]).toBeUndefined();
    expect(vars["--primary"]).toBe(vars["--grape"]);
    expect(vars["--chart-2"]).toBe(vars["--flame"]);
  });
  it("flags similar colors without disallowing them", () => {
    expect(similarColors("#112233", "#122334")).toBe(true);
    expect(similarColors("#FF0000", "#0000FF")).toBe(false);
  });
  it("keeps non-team public and admin branding default", () => {
    for (const path of ["/", "/auth", "/library", "/library/123", "/coach/kory", "/kpi", "/launch-qa"]) expect(teamThemeEnabled(path)).toBe(false);
    for (const path of ["/settings", "/lockerroom", "/game/1", "/plays"]) expect(teamThemeEnabled(path)).toBe(true);
  });
});