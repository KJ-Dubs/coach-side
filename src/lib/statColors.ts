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
  OPP_MADE: "#f8fafc",
  OPP_MISS: "#cbd5e1",
  OPP_FT_MADE: "#f8fafc",
  OPP_FT_MISS: "#cbd5e1",
  OPP_TURNOVER: "#fdba74",
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
  OPP_MADE: "Opponent make",
  OPP_MISS: "Opponent miss",
  OPP_FT_MADE: "Opponent FT made",
  OPP_FT_MISS: "Opponent FT missed",
  OPP_REBOUND: "Opponent rebound",
  OPP_TURNOVER: "Opponent turnover",
  OPP_SCORE: "Opponent score",
};

export function statColor(type: string) {
  return STAT_COLORS[type] ?? "#a78bfa";
}
