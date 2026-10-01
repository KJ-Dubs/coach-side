CREATE OR REPLACE FUNCTION public.my_achievement_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _u uuid := auth.uid(); _teams uuid[];
BEGIN
  IF _u IS NULL THEN RETURN '{}'::jsonb; END IF;
  SELECT COALESCE(array_agg(id), '{}') INTO _teams FROM public.teams t WHERE public.is_team_coach(t.id);
  RETURN jsonb_build_object(
    'plays_created', (SELECT count(*) FROM plays WHERE created_by = _u AND source_play_id IS NULL),
    'plays_published', (SELECT count(*) FROM plays WHERE created_by = _u AND published_to_library),
    'library_saved', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'library_play_added_to_playbook'),
    'play_shared', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'play_shared') + (SELECT count(*) FROM plays WHERE created_by = _u AND is_shared),
    'play_exported', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'play_exported_video'),
    'hearts', (SELECT count(*) FROM play_hearts WHERE user_id = _u),
    'follows', (SELECT count(*) FROM coach_follows WHERE follower_id = _u),
    'teams', COALESCE(array_length(_teams, 1), 0),
    'max_roster', COALESCE((SELECT max(c) FROM (SELECT count(*) c FROM players WHERE team_id = ANY(_teams) GROUP BY team_id) s), 0),
    'qr_joins', (SELECT count(*) FROM team_members WHERE team_id = ANY(_teams) AND role = 'player'),
    'announcements', (SELECT count(*) FROM announcements WHERE created_by = _u)
      + (SELECT count(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
          WHERE c.team_id = ANY(_teams) AND (m.sender_id = _u OR m.pinned_by = _u) AND m.deleted_at IS NULL),
    'assignments', (SELECT count(*) FROM assignments WHERE created_by = _u),
    'parent_link_shared', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'parent_link_shared'),
    'calendar_connected', (SELECT count(*) FROM google_calendar_connections WHERE user_id = _u),
    'events', (SELECT count(*) FROM team_events WHERE created_by = _u),
    'games', (SELECT count(*) FROM games WHERE team_id = ANY(_teams)),
    'max_team_games', COALESCE((SELECT max(c) FROM (SELECT count(*) c FROM games WHERE team_id = ANY(_teams) GROUP BY team_id) s), 0),
    'stats_exported', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'stats_exported'),
    'season_completed', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'season_completed'),
    'board_in_game', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'board_used_in_game'),
    'shot_locations', (SELECT count(*) FROM game_events e JOIN games g ON g.id = e.game_id WHERE g.team_id = ANY(_teams) AND e.x IS NOT NULL),
    'drills_created', (SELECT count(*) FROM drills WHERE created_by = _u AND source_drill_id IS NULL),
    'drills_published', (SELECT count(*) FROM drills WHERE created_by = _u AND published_to_library),
    'drills_saved', (SELECT count(*) FROM drills WHERE created_by = _u AND source_drill_id IS NOT NULL),
    'practice_plans', (SELECT count(*) FROM practice_plans WHERE created_by = _u),
    'practice_shared', (SELECT count(*) FROM practice_plans WHERE created_by = _u AND shared_to_locker),
    'pwa_installed', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'pwa_installed'),
    'push_enabled', (SELECT count(*) FROM push_subscriptions WHERE user_id = _u AND active),
    'potd_views', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'potd_viewed'),
    'profile_complete', (SELECT count(*) FROM profiles WHERE id = _u AND username IS NOT NULL AND full_name IS NOT NULL)
  );
END $function$;