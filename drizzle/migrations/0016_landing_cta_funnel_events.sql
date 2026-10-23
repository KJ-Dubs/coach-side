DROP POLICY IF EXISTS "Anyone records landing views" ON public.anon_funnel_events;
CREATE POLICY "Anyone records landing views" ON public.anon_funnel_events FOR INSERT TO anon, authenticated
  WITH CHECK (event_type IN (
    'landing_view','signup_started',
    'landing_explore_plays','landing_build_play','landing_setup_team',
    'landing_start_free','landing_pricing_view','landing_membership_options'
  ));