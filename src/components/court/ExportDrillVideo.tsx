import { useMemo } from "react";
import { ExportPlayVideo } from "@/components/court/ExportPlayVideo";
import { buildSteps } from "@/lib/playAnimation";
import type { Drill, DrillFrame } from "@/lib/drills";
import type { PlayFrame } from "@/lib/types";

function asPlayFrame(frame: DrillFrame): PlayFrame {
  return {
    id: frame.id,
    play_id: frame.drill_id,
    idx: frame.idx,
    tokens: frame.tokens.map((token) => ({ ...token, ball: false })),
    actions: frame.actions,
    note: frame.note,
  };
}

export function ExportDrillVideo({
  drill,
  frames,
}: {
  drill: Pick<Drill, "name" | "category">;
  frames: DrillFrame[];
}) {
  const model = useMemo(() => {
    const sorted = frames.slice().sort((a, b) => a.idx - b.idx);
    const playFrames = sorted.map(asPlayFrame);
    return {
      name: drill.name,
      category: drill.category,
      flip: false,
      kind: "drill" as const,
      frames: playFrames,
      drillFrames: sorted,
      steps: playFrames.flatMap((frame, frameIdx) =>
        buildSteps(frame).map((step) => ({ step, frameIdx, note: frame.note })),
      ),
    };
  }, [drill.category, drill.name, frames]);

  return <ExportPlayVideo model={model} />;
}