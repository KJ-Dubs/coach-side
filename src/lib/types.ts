export type Team = {
  id: string;
  name: string;
  season: string;
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
};

export type EventType =
  | "MADE"
  | "MISS"
  | "REBOUND"
  | "ASSIST"
  | "STEAL"
  | "TURNOVER"
  | "BLOCK"
  | "FOUL"
  | "OPP_REBOUND"
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
};

export type PlayActionType = "pass" | "cut" | "dribble" | "screen";

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

export const PLAY_CATEGORIES = ["Offense", "BLOB", "SLOB", "Press Break"] as const;
