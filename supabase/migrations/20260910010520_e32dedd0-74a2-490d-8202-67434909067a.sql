DROP INDEX IF EXISTS public.team_events_external_unique;
CREATE UNIQUE INDEX IF NOT EXISTS team_events_external_unique
  ON public.team_events (team_id, external_calendar_id, external_event_id);