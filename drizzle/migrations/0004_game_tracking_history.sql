ALTER TABLE public.games ADD COLUMN IF NOT EXISTS tracking_history jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS tracking_coverage_override jsonb;
COMMENT ON COLUMN public.games.tracking_history IS 'Append-only list of mid-game tracking toggles: {category, enabled, period, event_count, changed_at, changed_by}';
COMMENT ON COLUMN public.games.tracking_coverage_override IS 'Coach corrections to computed coverage: {category: {status: full|partial|none, note}}';

CREATE OR REPLACE FUNCTION public.public_game_report(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _g games%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RETURN NULL; END IF;
  SELECT g.* INTO _g FROM game_share_links l JOIN games g ON g.id = l.game_id
   WHERE l.token = _token AND g.status = 'final';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'game', jsonb_build_object('id', _g.id, 'team_id', _g.team_id, 'opponent', _g.opponent, 'game_date', _g.game_date,
      'periods', _g.periods, 'period_minutes', _g.period_minutes, 'status', _g.status, 'team_score', _g.team_score,
      'opp_score', _g.opp_score, 'quarter', _g.quarter, 'clock_seconds', 0, 'starting_five', '[]'::jsonb,
      'home_away', _g.home_away,
      'stat_tracking_config', _g.stat_tracking_config,
      'tracking_history', (SELECT COALESCE(jsonb_agg(h - 'changed_by'), '[]'::jsonb) FROM jsonb_array_elements(COALESCE(_g.tracking_history, '[]'::jsonb)) h),
      'tracking_coverage_override', _g.tracking_coverage_override),
    'team', (SELECT jsonb_build_object('name', t.name, 'season', t.season) FROM teams t WHERE t.id = _g.team_id),
    'players', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'team_id', p.team_id, 'jersey', p.jersey, 'name', p.name) ORDER BY p.jersey)
       FROM players p WHERE p.team_id = _g.team_id), '[]'::jsonb),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'game_id', e.game_id, 'quarter', e.quarter,
       'clock_seconds', e.clock_seconds, 'player_id', e.player_id, 'x', e.x, 'y', e.y, 'event_type', e.event_type,
       'result', e.result, 'points', e.points, 'zone', e.zone, 'current_lineup', '[]'::jsonb,
       'related_event_id', e.related_event_id, 'context', COALESCE(e.context, '{}'::jsonb), 'created_at', e.created_at) ORDER BY e.created_at)
       FROM game_events e WHERE e.game_id = _g.id), '[]'::jsonb)
  );
END $function$;