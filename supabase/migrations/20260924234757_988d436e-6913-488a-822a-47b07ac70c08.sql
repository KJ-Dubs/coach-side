
-- ===== Trials =====
ALTER TABLE public.team_billing
  ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_webhook_event_id text;

CREATE TABLE public.team_trials (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  source text NOT NULL DEFAULT 'new_team',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_trials TO authenticated;
GRANT ALL ON public.team_trials TO service_role;
ALTER TABLE public.team_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members read trial" ON public.team_trials FOR SELECT TO authenticated
  USING (public.team_visible(team_id) OR public.is_app_admin());

CREATE TABLE public.trial_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  org_id uuid,
  team_id uuid,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trial_claims TO authenticated;
GRANT ALL ON public.trial_claims TO service_role;
ALTER TABLE public.trial_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trial claim" ON public.trial_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE OR REPLACE FUNCTION public.start_team_trial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.trial_claims WHERE user_id = _uid) THEN RETURN NEW; END IF;
  IF NEW.org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.trial_claims WHERE org_id = NEW.org_id) THEN RETURN NEW; END IF;
  INSERT INTO public.trial_claims (user_id, org_id, team_id) VALUES (_uid, NEW.org_id, NEW.id);
  INSERT INTO public.team_trials (team_id, created_by) VALUES (NEW.id, _uid) ON CONFLICT DO NOTHING;
  INSERT INTO public.product_activity_events (user_id, event_type, team_id) VALUES (_uid, 'trial_started', NEW.id);
  INSERT INTO public.product_activity_events (user_id, event_type, team_id) VALUES (_uid, 'team_created', NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.start_team_trial() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER teams_start_trial AFTER INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION public.start_team_trial();

-- Existing teams: record claims so nobody gets a surprise trial later
INSERT INTO public.trial_claims (user_id, org_id, team_id)
SELECT DISTINCT ON (tm.user_id) tm.user_id, t.org_id, t.id
FROM public.team_members tm JOIN public.teams t ON t.id = tm.team_id
WHERE tm.role = 'head_coach'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.team_modules(_team uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT array_agg(DISTINCT m) FROM (
      SELECT unnest(b.modules) AS m FROM public.team_billing b
      WHERE b.team_id = _team AND b.status IN ('active','grace','past_due','complimentary')
      UNION
      SELECT unnest(g.modules) FROM public.complimentary_grants g
      WHERE g.team_id = _team AND g.active AND (g.expires_at IS NULL OR g.expires_at > now())
      UNION
      SELECT unnest(ARRAY['playbook_plus','gameday_plus','team_hub_plus']) FROM public.team_trials tt
      WHERE tt.team_id = _team AND tt.ends_at > now()
    ) s), '{}'::text[]);
$$;

CREATE OR REPLACE FUNCTION public.my_team_entitlement(_team uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.team_visible(_team) THEN jsonb_build_object(
    'team_id', _team,
    'modules', to_jsonb(public.team_modules(_team)),
    'status', COALESCE((SELECT status FROM public.team_billing WHERE team_id = _team), 'free'),
    'current_period_end', (SELECT current_period_end FROM public.team_billing WHERE team_id = _team),
    'cancel_at_period_end', COALESCE((SELECT cancel_at_period_end FROM public.team_billing WHERE team_id = _team), false),
    'complimentary', EXISTS (SELECT 1 FROM public.complimentary_grants g WHERE g.team_id = _team AND g.active AND (g.expires_at IS NULL OR g.expires_at > now())),
    'trial_started_at', (SELECT started_at FROM public.team_trials WHERE team_id = _team),
    'trial_ends_at', (SELECT ends_at FROM public.team_trials WHERE team_id = _team)
  ) ELSE NULL END;
$$;

-- ===== Stripe-ready billing =====
CREATE TABLE public.billing_price_map (
  plan_key text PRIMARY KEY,
  stripe_price_id text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_price_map TO authenticated;
GRANT ALL ON public.billing_price_map TO service_role;
ALTER TABLE public.billing_price_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read price map" ON public.billing_price_map FOR SELECT TO authenticated USING (public.is_app_admin());
INSERT INTO public.billing_price_map (plan_key) VALUES
 ('playbook_plus'),('gameday_plus'),('team_hub_plus'),
 ('playbook_plus+gameday_plus'),('playbook_plus+team_hub_plus'),('gameday_plus+team_hub_plus'),('complete');

CREATE TABLE public.billing_webhook_events (
  event_id text PRIMARY KEY,
  provider text NOT NULL,
  event_type text NOT NULL,
  livemode boolean,
  team_id uuid,
  processed boolean NOT NULL DEFAULT false,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_webhook_events TO authenticated;
GRANT ALL ON public.billing_webhook_events TO service_role;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read webhook log" ON public.billing_webhook_events FOR SELECT TO authenticated USING (public.is_app_admin());

-- ===== Achievements =====
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own achievements" ON public.user_achievements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE OR REPLACE FUNCTION public.my_achievement_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    'announcements', (SELECT count(*) FROM announcements WHERE created_by = _u),
    'assignments', (SELECT count(*) FROM assignments WHERE created_by = _u),
    'parent_link_shared', (SELECT count(*) FROM product_activity_events WHERE user_id = _u AND event_type = 'parent_link_shared'),
    'calendar_connected', (SELECT count(*) FROM google_calendar_connections WHERE user_id = _u),
    'events', (SELECT count(*) FROM team_events WHERE created_by = _u),
    'games', (SELECT count(*) FROM games WHERE team_id = ANY(_teams)),
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
END $$;
REVOKE EXECUTE ON FUNCTION public.my_achievement_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_achievement_metrics() TO authenticated;

-- ===== Play of the Day history =====
CREATE TABLE public.play_of_the_day (
  day date PRIMARY KEY,
  play_id uuid REFERENCES public.plays(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'auto',
  set_by uuid,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.play_of_the_day TO authenticated;
GRANT ALL ON public.play_of_the_day TO service_role;
ALTER TABLE public.play_of_the_day ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read potd" ON public.play_of_the_day FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_play_of_the_day(_play uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Only CoachSide owners can set the Play of the Day'; END IF;
  IF _play IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.plays WHERE id = _play AND published_to_library) THEN
    RAISE EXCEPTION 'Only a published Library play can be featured';
  END IF;
  INSERT INTO public.featured_play (id, play_id, set_by, updated_at) VALUES (true, _play, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET play_id = EXCLUDED.play_id, set_by = EXCLUDED.set_by, updated_at = now();
  INSERT INTO public.play_of_the_day (day, play_id, source, set_by) VALUES ((now() AT TIME ZONE 'America/Los_Angeles')::date, _play, 'manual', auth.uid())
  ON CONFLICT (day) DO UPDATE SET play_id = EXCLUDED.play_id, source = 'manual', set_by = EXCLUDED.set_by, notified_at = NULL, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.schedule_play_of_the_day(_day date, _play uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Owners only'; END IF;
  IF _play IS NULL THEN DELETE FROM public.play_of_the_day WHERE day = _day AND source = 'scheduled'; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plays WHERE id = _play AND published_to_library) THEN RAISE EXCEPTION 'Only a published Library play can be scheduled'; END IF;
  INSERT INTO public.play_of_the_day (day, play_id, source, set_by) VALUES (_day, _play, 'scheduled', auth.uid())
  ON CONFLICT (day) DO UPDATE SET play_id = EXCLUDED.play_id, source = 'scheduled', set_by = EXCLUDED.set_by, updated_at = now();
END $$;
REVOKE EXECUTE ON FUNCTION public.schedule_play_of_the_day(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_play_of_the_day(date, uuid) TO authenticated;

-- ===== Nurture =====
CREATE TABLE public.nurture_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid,
  day integer NOT NULL,
  message_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT ON public.nurture_deliveries TO authenticated;
GRANT ALL ON public.nurture_deliveries TO service_role;
ALTER TABLE public.nurture_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own nurture log" ON public.nurture_deliveries FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_app_admin());

ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS onboarding_tips boolean NOT NULL DEFAULT true;

-- ===== Anonymous landing views =====
CREATE TABLE public.anon_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.anon_funnel_events TO anon, authenticated;
GRANT SELECT ON public.anon_funnel_events TO authenticated;
GRANT ALL ON public.anon_funnel_events TO service_role;
ALTER TABLE public.anon_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone records landing views" ON public.anon_funnel_events FOR INSERT TO anon, authenticated
  WITH CHECK (event_type IN ('landing_view','signup_started'));
CREATE POLICY "Owners read anon funnel" ON public.anon_funnel_events FOR SELECT TO authenticated USING (public.is_app_admin());
