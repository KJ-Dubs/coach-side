ALTER TABLE public.team_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS opponent text,
  ADD COLUMN IF NOT EXISTS home_away text,
  ADD COLUMN IF NOT EXISTS arrival_at timestamptz,
  ADD COLUMN IF NOT EXISTS uniform text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz NOT NULL DEFAULT now();

UPDATE public.team_events SET event_type = kind WHERE event_type = 'practice' AND kind <> 'practice';

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS home_gym text,
  ADD COLUMN IF NOT EXISTS default_practice_location text,
  ADD COLUMN IF NOT EXISTS default_arrival_offset_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS default_practice_reminder_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS default_game_reminder_minutes integer NOT NULL DEFAULT 60;

CREATE TABLE IF NOT EXISTS public.event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.team_events(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'relative',
  minutes_before integer,
  fixed_time time,
  delivery_method text NOT NULL DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_reminders TO authenticated;
GRANT ALL ON public.event_reminders TO service_role;
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event reminders all" ON public.event_reminders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_events e WHERE e.id = event_id AND public.team_visible(e.team_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_events e WHERE e.id = event_id AND public.team_visible(e.team_id)));

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  provider_account_email text,
  connection_ref text,
  sync_direction text NOT NULL DEFAULT 'push',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO authenticated;
GRANT ALL ON public.calendar_connections TO service_role;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar connection" ON public.calendar_connections FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.calendar_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  provider_calendar_id text NOT NULL,
  provider_calendar_name text,
  sync_direction text NOT NULL DEFAULT 'push',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_mappings TO authenticated;
GRANT ALL ON public.calendar_mappings TO service_role;
ALTER TABLE public.calendar_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar mapping" ON public.calendar_mappings FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.team_visible(team_id))
  WITH CHECK (user_id = auth.uid() AND public.team_visible(team_id));

CREATE TABLE IF NOT EXISTS public.event_sync_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_event_id uuid NOT NULL REFERENCES public.team_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  provider_calendar_id text,
  provider_event_id text NOT NULL,
  sync_source text NOT NULL DEFAULT 'coachside',
  sync_status text NOT NULL DEFAULT 'synced',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_event_id, user_id, provider)
);
CREATE UNIQUE INDEX IF NOT EXISTS event_sync_links_provider_event
  ON public.event_sync_links (user_id, provider, provider_event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_sync_links TO authenticated;
GRANT ALL ON public.event_sync_links TO service_role;
ALTER TABLE public.event_sync_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own event sync link" ON public.event_sync_links FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_event_reminders_updated_at BEFORE UPDATE ON public.event_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_calendar_connections_updated_at BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_calendar_mappings_updated_at BEFORE UPDATE ON public.calendar_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_event_sync_links_updated_at BEFORE UPDATE ON public.event_sync_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS team_events_team_start_idx ON public.team_events (team_id, starts_at);