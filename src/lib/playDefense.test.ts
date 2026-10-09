import { describe, expect, it } from "vitest";
import { addHalfCourtDefense } from "./playDefense";
import type { PlayToken } from "./types";

const offense = (xs: number[]): PlayToken[] => xs.map((x, i) => ({
  id: `p${i + 1}`, label: String(i + 1), x, y: 0.5, ball: i === 0, team: "offense",
}));
const makeId = () => crypto.randomUUID();
const defenders = (tokens: PlayToken[]) => tokens.filter((t) => t.team === "defense");

describe("Playmaker initial defense shell", () => {
  for (const view of ["right", "left", "top", "bottom"] as const) {
    for (const flip of [false, true]) {
      it(`${view}, flip=${flip}: all five are visible and spaced in logical coordinates`, () => {
        const original = offense([0.6, 0.65, 0.7, 0.8, 0.85]);
        const result = addHalfCourtDefense(original, view, flip, makeId);
        const seeded = defenders(result);
        expect(result.slice(0, 5)).toEqual(original);
        expect(seeded).toHaveLength(5);
        expect(new Set(seeded.map((t) => t.id)).size).toBe(5);
        expect(new Set(seeded.map((t) => `${t.x},${t.y}`)).size).toBe(5);
        for (const token of seeded) {
          const x = flip ? 1 - token.x : token.x;
          const y = flip ? 1 - token.y : token.y;
          const right = view === "right" || view === "bottom";
          expect(x).toBeGreaterThan(right ? 0.5 : 0);
          expect(x).toBeLessThan(right ? 1 : 0.5);
          expect(y).toBeGreaterThan(0);
          expect(y).toBeLessThan(1);
          // Top/Bottom rotate the same logical halves, not logical y slices.
          if (view === "top" || view === "bottom") {
            const localY = (x - (right ? 0.5 : 0)) * 2;
            expect(localY).toBeGreaterThan(0);
            expect(localY).toBeLessThan(1);
          }
        }
      });
    }
  }

  for (const flip of [false, true]) {
    for (const xs of [[0.6, 0.7, 0.8, 0.2, 0.5], [0.2, 0.3, 0.4, 0.8, 0.5]]) {
      it(`Full follows offense majority ${xs[0]}, flip=${flip}`, () => {
        const result = defenders(addHalfCourtDefense(offense(xs), "full", flip, makeId));
        expect(result.every((t) => xs[0] > 0.5 ? t.x > 0.5 : t.x < 0.5)).toBe(true);
      });
    }
    it(`Full ambiguous offense defaults to attack half, flip=${flip}`, () => {
      for (const xs of [[], [0.2, 0.8, 0.5], [0.5, 0.5]]) {
        expect(defenders(addHalfCourtDefense(offense(xs), "full", flip, makeId)).every((t) => t.x > 0.5)).toBe(true);
      }
    });
  }

  it("Full uses the currently projected offense rather than its old starting half", () => {
    const result = addHalfCourtDefense(offense([0.2, 0.3]), "full", false, makeId, offense([0.7, 0.8]));
    expect(defenders(result).every((t) => t.x > 0.5)).toBe(true);
  });

  it("existing/partial legacy defense survives every view unchanged without generating IDs", () => {
    const legacy: PlayToken = { id: "old-x", label: "1", x: 0.12, y: 0.91, ball: false, team: "defense" };
    const tokens = [...offense([0.7]), legacy];
    for (const view of ["right", "left", "top", "bottom", "full"] as const) {
      for (const flip of [false, true]) {
        expect(addHalfCourtDefense(tokens, view, flip, () => { throw new Error("Must not reseed"); })).toBe(tokens);
        expect(tokens[tokens.length - 1]).toBe(legacy);
        expect(legacy).toEqual({ id: "old-x", label: "1", x: 0.12, y: 0.91, ball: false, team: "defense" });
      }
    }
  });
});