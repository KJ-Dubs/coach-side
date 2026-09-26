-- ---------- film_jobs ----------
CREATE TABLE public.film_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'upload',
  storage_path text,
  source_url text,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'uploading',
  status_detail text,
  progress integer NOT NULL DEFAULT 0,
  our_color text,
  opp_color text,
  attack_basket_first_half text NOT NULL DEFAULT 'right',
  periods integer NOT NULL DEFAULT 4,
  roster_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text NOT NULL DEFAULT 'none',
  provider_job_id text,
  consent_acknowledged_at timestamptz,
  consent_acknowledged_by uuid,
  retention_until timestamptz NOT NULL DEFAULT (now() + interval '180 days'),
  error text,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.film_jobs TO authenticated;
GRANT ALL ON public.film_jobs TO service_role;
ALTER TABLE public.film_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read film jobs" ON public.film_jobs FOR SELECT TO authenticated USING (public.is_team_coach(team_id));
CREATE POLICY "coaches create film jobs" ON public.film_jobs FOR INSERT TO authenticated WITH CHECK (public.is_team_coach(team_id) AND created_by = auth.uid());
CREATE POLICY "coaches update film jobs" ON public.film_jobs FOR UPDATE TO authenticated USING (public.is_team_coach(team_id)) WITH CHECK (public.is_team_coach(team_id));
CREATE POLICY "coaches delete film jobs" ON public.film_jobs FOR DELETE TO authenticated USING (public.is_team_coach(team_id));
CREATE TRIGGER update_film_jobs_updated_at BEFORE UPDATE ON public.film_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- film_job_events (staging; never auto-promoted) ----------
CREATE TABLE public.film_job_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.film_jobs(id) ON DELETE CASCADE,
  external_id text,
  video_ts_ms integer NOT NULL DEFAULT 0,
  quarter integer NOT NULL DEFAULT 1,
  clock_seconds integer NOT NULL DEFAULT 0,
  event_type text NOT NULL,
  side text NOT NULL DEFAULT 'us',
  jersey_detected text,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  x double precision,
  y double precision,
  result text,
  points integer NOT NULL DEFAULT 0,
  confidence real,
  related_proposed_id uuid REFERENCES public.film_job_events(id) ON DELETE SET NULL,
  lineup_guess jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_state text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  promoted_event_id uuid REFERENCES public.game_events(id) ON DELETE SET NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.film_job_events TO authenticated;
GRANT ALL ON public.film_job_events TO service_role;
ALTER TABLE public.film_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read film events" ON public.film_job_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));
CREATE POLICY "coaches write film events" ON public.film_job_events FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));
CREATE POLICY "coaches update film events" ON public.film_job_events FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));
CREATE POLICY "coaches delete film events" ON public.film_job_events FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));
CREATE TRIGGER update_film_job_events_updated_at BEFORE UPDATE ON public.film_job_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- film_job_substitutions (staging) ----------
CREATE TABLE public.film_job_substitutions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.film_jobs(id) ON DELETE CASCADE,
  external_id text,
  video_ts_ms integer NOT NULL DEFAULT 0,
  quarter integer NOT NULL DEFAULT 1,
  clock_seconds integer NOT NULL DEFAULT 0,
  player_out uuid REFERENCES public.players(id) ON DELETE SET NULL,
  player_in uuid REFERENCES public.players(id) ON DELETE SET NULL,
  lineup_after jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence real,
  review_state text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  promoted_sub_id uuid REFERENCES public.substitutions(id) ON DELETE SET NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.film_job_substitutions TO authenticated;
GRANT ALL ON public.film_job_substitutions TO service_role;
ALTER TABLE public.film_job_substitutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read film subs" ON public.film_job_substitutions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));
CREATE POLICY "coaches write film subs" ON public.film_job_substitutions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));
CREATE POLICY "coaches update film subs" ON public.film_job_substitutions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));
CREATE POLICY "coaches delete film subs" ON public.film_job_substitutions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));

-- ---------- film_job_logs (audit; service_role writes, coaches read) ----------
CREATE TABLE public.film_job_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.film_jobs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.film_job_logs TO authenticated;
GRANT ALL ON public.film_job_logs TO service_role;
ALTER TABLE public.film_job_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read film logs" ON public.film_job_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.film_jobs j WHERE j.id = job_id AND public.is_team_coach(j.team_id)));

-- ---------- finalize: promote accepted/edited/coach_added staged rows ----------
CREATE OR REPLACE FUNCTION public.finalize_film_job(_job uuid, _mode text DEFAULT 'merge')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.film_jobs%ROWTYPE;
  ev RECORD;
  sub RECORD;
  new_id uuid;
  n_events integer := 0;
  n_subs integer := 0;
BEGIN
  SELECT * INTO j FROM public.film_jobs WHERE id = _job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'film job not found'; END IF;
  IF NOT public.is_team_coach(j.team_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF j.game_id IS NULL THEN RAISE EXCEPTION 'job has no game'; END IF;

  -- Idempotent re-run: remove only rows this job previously promoted.
  DELETE FROM public.game_events WHERE context->>'film_job_id' = _job::text;
  DELETE FROM public.substitutions s USING public.film_job_substitutions fs
    WHERE fs.job_id = _job AND s.id = fs.promoted_sub_id;
  UPDATE public.film_job_events SET promoted_event_id = NULL WHERE job_id = _job;
  UPDATE public.film_job_substitutions SET promoted_sub_id = NULL WHERE job_id = _job;

  FOR ev IN
    SELECT * FROM public.film_job_events
    WHERE job_id = _job AND review_state IN ('accepted','edited','coach_added')
    ORDER BY video_ts_ms, created_at
  LOOP
    INSERT INTO public.game_events (game_id, quarter, clock_seconds, player_id, x, y, event_type, result, points, zone, current_lineup, related_event_id, context)
    VALUES (
      j.game_id, ev.quarter, ev.clock_seconds, ev.player_id, ev.x, ev.y,
      ev.event_type, ev.result, ev.points, NULL,
      COALESCE(ev.lineup_guess, '[]'::jsonb), NULL,
      jsonb_build_object('source','film_ai','film_job_id',_job,'video_ts_ms',ev.video_ts_ms,'confidence',ev.confidence,'reviewed_by',ev.reviewed_by)
    )
    RETURNING id INTO new_id;
    UPDATE public.film_job_events SET promoted_event_id = new_id WHERE id = ev.id;
    n_events := n_events + 1;
  END LOOP;

  FOR sub IN
    SELECT * FROM public.film_job_substitutions
    WHERE job_id = _job AND review_state IN ('accepted','edited','coach_added')
    ORDER BY video_ts_ms, created_at
  LOOP
    INSERT INTO public.substitutions (game_id, quarter, clock_seconds, player_out, player_in, lineup_after)
    VALUES (j.game_id, sub.quarter, sub.clock_seconds, sub.player_out, sub.player_in, COALESCE(sub.lineup_after,'[]'::jsonb))
    RETURNING id INTO new_id;
    UPDATE public.film_job_substitutions SET promoted_sub_id = new_id WHERE id = sub.id;
    n_subs := n_subs + 1;
  END LOOP;

  UPDATE public.film_jobs SET status = 'complete', finalized_at = now(), updated_at = now() WHERE id = _job;
  INSERT INTO public.film_job_logs (job_id, message, data) VALUES (_job, 'finalized', jsonb_build_object('events', n_events, 'subs', n_subs, 'mode', _mode));
  RETURN jsonb_build_object('events', n_events, 'subs', n_subs);
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_film_job(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_film_job(uuid, text) TO authenticated;

-- ---------- game-film storage policies (path: {team_id}/{job_id}/...) ----------
CREATE POLICY "coaches read game film" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'game-film' AND public.is_team_coach((storage.foldername(name))[1]::uuid));
CREATE POLICY "coaches upload game film" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-film' AND public.is_team_coach((storage.foldername(name))[1]::uuid));
CREATE POLICY "coaches update game film" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'game-film' AND public.is_team_coach((storage.foldername(name))[1]::uuid));
CREATE POLICY "coaches delete game film" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'game-film' AND public.is_team_coach((storage.foldername(name))[1]::uuid));