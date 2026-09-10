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
  allow_player_posting?: boolean;
  require_ack_default?: boolean;
  locker_enabled?: boolean;
  home_gym?: string | null;
  default_practice_location?: string | null;
  default_arrival_offset_minutes?: number;
  timezone?: string;
  default_practice_reminder_minutes?: number;
  default_game_reminder_minutes?: number;
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

export type PlayActionType =
  | "pass"
  | "cut"
  | "curl"
  | "dribble"
  | "screen"
  | "move"
  | "handoff"
  | "shot";

export type PlayAction = {
  id: string;
  type: PlayActionType;
  seq: number;
  /** Full drawn polyline in normalized court coords (0..1). */
  points: { x: number; y: number }[];
  /** Token that performs the action. */
  actor?: string;
  /** Receiving token for passes and handoffs. */
  target?: string;
  transfersBall?: boolean;
  durationMs?: number;
  label?: string;
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

export const EVENT_TYPES = [
  "practice",
  "game",
  "event",
  "film",
  "workout",
  "meeting",
  "tournament",
  "other",
] as const;

export type CalendarEventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABEL: Record<string, string> = {
  practice: "Practice",
  game: "Game",
  event: "Team Event",
  film: "Film Session",
  workout: "Workout",
  meeting: "Meeting",
  tournament: "Tournament",
  other: "Other",
};

export type TeamEvent = {
  id: string;
  team_id: string;
  kind: TeamEventKind | string;
  event_type: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  opponent: string | null;
  home_away: string | null;
  arrival_at: string | null;
  uniform: string | null;
  visibility: string;
  status: string;
  timezone: string | null;
  game_id: string | null;
  attachments?: Record<string, unknown>;
  created_by?: string | null;
  last_modified_at?: string;
  created_at?: string;
  /** 'coachside' for native events, 'google' for imported ones. */
  source?: string;
  external_provider?: string | null;
  external_event_id?: string | null;
  external_calendar_id?: string | null;
  external_updated_at?: string | null;
};

export type EventReminder = {
  id: string;
  event_id: string;
  reminder_type: string;
  minutes_before: number | null;
  fixed_time: string | null;
  delivery_method: string;
};

export type CalendarConnection = {
  id: string;
  user_id: string;
  provider: string;
  provider_account_email: string | null;
  sync_direction: string;
  enabled: boolean;
};

export type CalendarMapping = {
  id: string;
  team_id: string;
  user_id: string;
  provider: string;
  provider_calendar_id: string;
  provider_calendar_name: string | null;
  sync_direction: string;
};
