CREATE TABLE public.product_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_activity_events TO authenticated;
GRANT ALL ON public.product_activity_events TO service_role;

ALTER TABLE public.product_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users record their own activity"
ON public.product_activity_events
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners read product activity"
ON public.product_activity_events
FOR SELECT TO authenticated
USING (public.is_app_admin());

CREATE INDEX product_activity_events_created_idx ON public.product_activity_events (created_at DESC);
CREATE INDEX product_activity_events_user_idx ON public.product_activity_events (user_id, created_at DESC);