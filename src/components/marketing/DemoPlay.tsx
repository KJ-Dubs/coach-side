import { PlayCanvas } from "@/components/court/PlayCanvas";
import type { PlayFrame } from "@/lib/types";

/**
 * A hand-written demo frame for the public sales page. No team data, no auth,
 * no database — just the real court/play renderer showing a generic action.
 */
const DEMO_FRAME: PlayFrame = {
  id: "demo",
  play_id: "demo",
  idx: 0,
  note: "1 dribbles right, 5 sets the ball screen, 3 curls off the down screen.",
  tokens: [
    { id: "o1", label: "1", x: 0.5, y: 0.86, ball: true, team: "offense" },
    { id: "o2", label: "2", x: 0.12, y: 0.62, ball: false, team: "offense" },
    { id: "o3", label: "3", x: 0.86, y: 0.66, ball: false, team: "offense" },
    { id: "o4", label: "4", x: 0.24, y: 0.3, ball: false, team: "offense" },
    { id: "o5", label: "5", x: 0.62, y: 0.52, ball: false, team: "offense" },
    { id: "d1", label: "1", x: 0.5, y: 0.74, ball: false, team: "defense" },
    { id: "d5", label: "5", x: 0.58, y: 0.4, ball: false, team: "defense" },
  ],
  actions: [
    {
      id: "a1",
      type: "dribble",
      seq: 1,
      actor: "o1",
      points: [
        { x: 0.5, y: 0.86 },
        { x: 0.66, y: 0.7 },
      ],
    },
    {
      id: "a2",
      type: "screen",
      seq: 1,
      actor: "o5",
      points: [
        { x: 0.62, y: 0.52 },
        { x: 0.66, y: 0.62 },
      ],
    },
    {
      id: "a3",
      type: "curl",
      seq: 2,
      actor: "o3",
      points: [
        { x: 0.86, y: 0.66 },
        { x: 0.78, y: 0.42 },
        { x: 0.6, y: 0.3 },
      ],
    },
    {
      id: "a4",
      type: "pass",
      seq: 3,
      actor: "o1",
      target: "o3",
      transfersBall: true,
      points: [
        { x: 0.66, y: 0.7 },
        { x: 0.6, y: 0.3 },
      ],
    },
  ],
};

export function DemoPlay({ className }: { className?: string }) {
  return <PlayCanvas frame={DEMO_FRAME} zoom="full" className={className} />;
}
