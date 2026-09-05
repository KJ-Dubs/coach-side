/** Shared colour language for every location map (screen + PDF). */
export const STAT_COLORS: Record<string, string> = {
  MADE: "#22c55e",
  MISS: "#ef4444",
  FT_MADE: "#15803d",
  FT_MISS: "#b91c1c",
  REBOUND: "#3b82f6",
  ASSIST: "#eab308",
  STEAL: "#06b6d4",
  TURNOVER: "#f97316",
  BLOCK: "#a855f7",
  FOUL: "#ec4899",
  OPP_FOUL: "#94a3b8",
  OPP_REBOUND: "#64748b",
  OUT_OF_BOUNDS: "#64748b",
};

export const STAT_LABELS: Record<string, string> = {
  MADE: "Made shot",
  MISS: "Missed shot",
  FT_MADE: "Free throw made",
  FT_MISS: "Free throw missed",
  REBOUND: "Rebound",
  ASSIST: "Assist",
  STEAL: "Steal",
  TURNOVER: "Turnover",
  BLOCK: "Block",
  FOUL: "Foul",
  OPP_FOUL: "Opponent foul",
};

export function statColor(type: string) {
  return STAT_COLORS[type] ?? "#a78bfa";
}
