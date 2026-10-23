-- Server-side mirror of the BILLING_ENFORCEMENT_ENABLED switch so database
-- rules can honour the kill switch. Synced by the server from the secret.
CREATE TABLE IF NOT EXISTS public.billing_runtime (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enforced boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.billing_runtime TO service_role;
ALTER TABLE public.billing_runtime ENABLE ROW LEVEL SECURITY;
INSERT INTO public.billing_runtime (id, enforced) VALUES (true, true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.billing_enforced()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT enforced FROM public.billing_runtime WHERE id), true);
$$;

-- Individual-player and location stat categories are GameDay+. Free teams keep
-- score, periods, team fouls and the clock. Paid keys are switched off (never
-- rejected) so offline-queued writes cannot get stuck.
CREATE OR REPLACE FUNCTION public.enforce_game_tracking_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  paid text[] := ARRAY['players','shotLocations','rebounds','assists','steals','turnovers','blocks','foulDetail','opponent','oppRebounds','oppTurnovers'];
  cfg jsonb;
  k text;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.stat_tracking_config IS NOT DISTINCT FROM OLD.stat_tracking_config THEN
    RETURN NEW;
  END IF;
  IF NOT public.billing_enforced() THEN RETURN NEW; END IF;
  IF 'gameday_plus' = ANY (public.team_modules(NEW.team_id)) THEN RETURN NEW; END IF;

  -- NULL means the original full tracker, so it must become explicit.
  cfg := CASE WHEN jsonb_typeof(NEW.stat_tracking_config) = 'object' THEN NEW.stat_tracking_config ELSE '{}'::jsonb END;
  FOREACH k IN ARRAY paid LOOP
    cfg := cfg || jsonb_build_object(k, false);
  END LOOP;
  NEW.stat_tracking_config := cfg;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS games_tracking_entitlement ON public.games;
CREATE TRIGGER games_tracking_entitlement
  BEFORE INSERT OR UPDATE OF stat_tracking_config ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.enforce_game_tracking_entitlement();