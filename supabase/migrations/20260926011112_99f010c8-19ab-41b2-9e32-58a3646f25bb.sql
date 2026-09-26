ALTER TABLE public.play_team_assignments ADD COLUMN IF NOT EXISTS share_token text UNIQUE, ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.play_share_link(_play uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _p record; _a record; _tok text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to share plays'; END IF;
  SELECT id, created_by, share_token INTO _p FROM plays WHERE id = _play;
  IF NOT FOUND THEN RAISE EXCEPTION 'Play not found'; END IF;
  IF _p.created_by = _uid THEN
    _tok := coalesce(_p.share_token, replace(gen_random_uuid()::text,'-',''));
    UPDATE plays SET is_shared = true, share_token = _tok WHERE id = _play;
    RETURN _tok;
  END IF;
  SELECT id, share_token INTO _a FROM play_team_assignments
   WHERE play_id = _play AND is_team_coach(team_id)
   ORDER BY share_token IS NULL, created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only coaches of a team with this play in its playbook can share it'; END IF;
  _tok := coalesce(_a.share_token, replace(gen_random_uuid()::text,'-',''));
  UPDATE play_team_assignments SET share_token = _tok, share_enabled = true WHERE id = _a.id;
  RETURN _tok;
END $$;
REVOKE ALL ON FUNCTION public.play_share_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.play_share_link(uuid) TO authenticated;