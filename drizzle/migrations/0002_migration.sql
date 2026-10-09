CREATE TABLE public.game_share_links (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_share_links TO authenticated;
GRANT ALL ON public.game_share_links TO service_role;
ALTER TABLE public.game_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coaches read game share links" ON public.game_share_links
  FOR SELECT TO authenticated USING (public.is_game_coach(game_id));

-- Coach-only create/rotate/revoke. _action: 'ensure' | 'rotate' | 'revoke'
CREATE OR REPLACE FUNCTION public.set_game_share(_game uuid, _action text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tok text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_game_coach(_game) THEN
    RAISE EXCEPTION 'Only team coaches can share this game';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM games WHERE id = _game AND status = 'final') THEN
    RAISE EXCEPTION 'Only completed games can be shared';
  END IF;
  IF _action = 'revoke' THEN
    DELETE FROM game_share_links WHERE game_id = _game;
    RETURN NULL;
  END IF;
  IF _action = 'ensure' THEN
    SELECT token INTO _tok FROM game_share_links WHERE game_id = _game;
    IF _tok IS NOT NULL THEN RETURN _tok; END IF;
  END IF;
  _tok := replace(replace(rtrim(encode(extensions.gen_random_bytes(24), 'base64'), '='), '+', '-'), '/', '_');
  INSERT INTO game_share_links(game_id, token, created_by) VALUES (_game, _tok, auth.uid())
  ON CONFLICT (game_id) DO UPDATE SET token = EXCLUDED.token, created_by = EXCLUDED.created_by, created_at = now();
  RETURN _tok;
END $$;
REVOKE ALL ON FUNCTION public.set_game_share(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_game_share(uuid, text) TO authenticated;

-- Token-scoped, minimal, live read of the canonical event ledger.
CREATE OR REPLACE FUNCTION public.public_game_report(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
      'home_away', _g.home_away),
    'team', (SELECT jsonb_build_object('name', t.name, 'season', t.season) FROM teams t WHERE t.id = _g.team_id),
    'players', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'team_id', p.team_id, 'jersey', p.jersey, 'name', p.name) ORDER BY p.jersey)
       FROM players p WHERE p.team_id = _g.team_id), '[]'::jsonb),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'game_id', e.game_id, 'quarter', e.quarter,
       'clock_seconds', e.clock_seconds, 'player_id', e.player_id, 'x', e.x, 'y', e.y, 'event_type', e.event_type,
       'result', e.result, 'points', e.points, 'zone', e.zone, 'current_lineup', '[]'::jsonb,
       'related_event_id', e.related_event_id, 'context', COALESCE(e.context, '{}'::jsonb), 'created_at', e.created_at) ORDER BY e.created_at)
       FROM game_events e WHERE e.game_id = _g.id), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.public_game_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_game_report(text) TO anon, authenticated;