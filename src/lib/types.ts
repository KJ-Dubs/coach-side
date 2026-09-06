export type Team = {
  id: string;
  name: string;
  season: string;
  org_id?: string | null;
  logo_url?: string | null;
  head_coach_name?: string | null;
  assistant_coaches?: string | null;
  default_periods?: number;
  default_period_minutes?: number;
  default_overtime_minutes?: number;
  locker_token?: string;
  locker_enabled?: boolean;
  created_at?: string;
};

export type Player = {
  id: string;
  team_id: string;
  jersey: string;
  name: string;
  position: string | null;
  active: boolean;
};

export type Game = {
  id: string;
  team_id: string;
  opponent: string;
  game_date: string;
  periods: number;
  period_minutes: number;
  status: string;
  team_score: number;
  opp_score: number;
  quarter: number;
  clock_seconds: number;
  starting_five: string[];
  home_away?: "home" | "away" | string;
  overtime_minutes?: number;
  ended_at?: string | null;
  created_at?: string;
};

export type EventType =
  | "MADE"
  | "MISS"
  | "FT_MADE"
  | "FT_MISS"
  | "REBOUND"
  | "ASSIST"
  | "STEAL"
  | "TURNOVER"
  | "BLOCK"
  | "FOUL"
  | "OPP_FOUL"
  | "OPP_REBOUND"
  | "OUT_OF_BOUNDS"
  | "OPP_SCORE";

export type GameEvent = {
  id: string;
  game_id: string;
  quarter: number;
  clock_seconds: number;
  player_id: string | null;
  x: number | null;
  y: number | null;
  event_type: EventType | string;
  result: string | null;
  points: number;
  zone: string | null;
  current_lineup: string[];
  related_event_id: string | null;
  context: Record<string, unknown>;
  created_at: string;
};

export type Substitution = {
  id: string;
  game_id: string;
  quarter: number;
  clock_seconds: number;
  player_out: string | null;
  player_in: string | null;
  lineup_after: string[];
  created_at: string;
};

export type PlayToken = {
  id: string;
  label: string;
  x: number;
  y: number;
  ball: boolean;
  /** Which side this token belongs to. Defaults to offense for older plays. */
  team?: "offense" | "defense";
};

export type PlayActionType = "pass" | "cut" | "curl" | "dribble" | "screen";

export type PlayAction = {
  id: string;
  type: PlayActionType;
  seq: number;
  points: { x: number; y: number }[];
};

export type Play = {
  id: string;
  team_id: string | null;
  name: string;
  category: string;
  attack_basket: "left" | "right" | string;
  is_shared: boolean;
  share_token: string | null;
  created_at?: string;
};

export type PlayFrame = {
  id: string;
  play_id: string;
  idx: number;
  tokens: PlayToken[];
  actions: PlayAction[];
  note: string | null;
};

export const PLAY_CATEGORIES = [
  "Offense",
  "BLOB",
  "SLOB",
  "Defense",
  "Press Break",
  "Presses",
] as const;

export type PlayCategory = (typeof PLAY_CATEGORIES)[number];

/** Older plays were filed under "Press Defense"; they live in "Presses" now. */
export function normalizeCategory(category: string): string {
  if (category === "Press Defense") return "Presses";
  return category;
}

export type CoachRole = "head_coach" | "assistant_coach";

export type OrgMember = {
  id: string;
  org_id: string;
  user_id: string;
  role: CoachRole;
  created_at: string;
};

export type CoachInvite = {
  id: string;
  org_id: string;
  team_id: string | null;
  email: string;
  role: CoachRole;
  token: string;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

export const ROLE_LABEL: Record<CoachRole, string> = {
  head_coach: "Head Coach",
  assistant_coach: "Assistant Coach",
};

export type TeamEventKind = "game" | "practice" | "event";

export type TeamEvent = {
  id: string;
  team_id: string;
  kind: TeamEventKind | string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  created_at?: string;
};
