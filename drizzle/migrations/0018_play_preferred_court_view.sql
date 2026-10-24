ALTER TABLE public.plays ADD COLUMN IF NOT EXISTS preferred_court_view text;
ALTER TABLE public.plays ADD CONSTRAINT plays_preferred_court_view_check
  CHECK (preferred_court_view IS NULL OR preferred_court_view IN ('right','left','top','bottom','full'));
COMMENT ON COLUMN public.plays.preferred_court_view IS 'Camera-only court view chosen in Play Maker (right|left|top|bottom|full). NULL = automatic fit. Never alters play geometry.';

CREATE OR REPLACE FUNCTION public.copy_play_for_me(_play uuid, _name text DEFAULT NULL::text, _team_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE src public.plays%rowtype;
        uid uuid := auth.uid();
        new_id uuid;
        t uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO src FROM public.plays WHERE id = _play;
  IF NOT FOUND THEN RAISE EXCEPTION 'Play not found'; END IF;
  IF NOT (src.published_to_library
          OR public.team_visible(src.team_id)
          OR EXISTS (SELECT 1 FROM public.play_team_assignments a
                      WHERE a.play_id = src.id AND public.team_visible(a.team_id))) THEN
    RAISE EXCEPTION 'You do not have access to this play';
  END IF;

  INSERT INTO public.plays (
    team_id, name, category, attack_basket, is_shared, share_token,
    published_to_library, published_at, published_by, library_author_name,
    library_version, publish_anonymous,
    created_by, source_play_id, root_play_id, source_creator_id, copied_at,
    preferred_court_view
  ) VALUES (
    NULL, coalesce(nullif(trim(_name), ''), src.name || ' — My Version'),
    src.category, src.attack_basket, false, NULL,
    false, NULL, NULL, NULL,
    1, false,
    uid, src.id, coalesce(src.root_play_id, src.id), src.created_by, now(),
    src.preferred_court_view
  ) RETURNING id INTO new_id;

  INSERT INTO public.play_frames (play_id, idx, tokens, actions, note)
  SELECT new_id, fr.idx, fr.tokens, fr.actions, fr.note
  FROM public.play_frames fr WHERE fr.play_id = src.id ORDER BY fr.idx;

  IF _team_ids IS NOT NULL THEN
    FOREACH t IN ARRAY _team_ids LOOP
      IF public.is_team_coach(t) THEN
        INSERT INTO public.play_team_assignments (play_id, team_id, assigned_by)
        VALUES (new_id, t, uid) ON CONFLICT (play_id, team_id) DO NOTHING;
        UPDATE public.plays SET team_id = coalesce(team_id, t) WHERE id = new_id;
      END IF;
    END LOOP;
  END IF;

  RETURN new_id;
END;
$function$;