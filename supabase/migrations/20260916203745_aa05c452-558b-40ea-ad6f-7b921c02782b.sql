
-- 1) Ownership + lineage columns
ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS source_play_id uuid REFERENCES public.plays(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS root_play_id uuid REFERENCES public.plays(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_creator_id uuid,
  ADD COLUMN IF NOT EXISTS copied_at timestamptz;

ALTER TABLE public.plays ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 2) Backfill legacy authorship where it is unambiguous
UPDATE public.plays p
   SET created_by = p.published_by
 WHERE p.created_by IS NULL AND p.published_by IS NOT NULL;

UPDATE public.plays p
   SET created_by = m.user_id
  FROM public.teams t
  JOIN public.org_members m ON m.org_id = t.org_id
 WHERE p.created_by IS NULL
   AND p.team_id = t.id
   AND t.org_id IS NOT NULL
   AND (SELECT count(*) FROM public.org_members m2 WHERE m2.org_id = t.org_id) = 1;

CREATE INDEX IF NOT EXISTS plays_created_by_idx ON public.plays (created_by);
CREATE INDEX IF NOT EXISTS plays_root_play_idx ON public.plays (root_play_id);

-- 3) Ownership helper
CREATE OR REPLACE FUNCTION public.play_owned(_play uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plays p
    WHERE p.id = _play AND p.created_by IS NOT NULL AND p.created_by = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.play_owned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.play_owned(uuid) TO authenticated, service_role;

-- 4) Writes require ownership
DROP POLICY IF EXISTS "plays update" ON public.plays;
DROP POLICY IF EXISTS "plays delete" ON public.plays;
DROP POLICY IF EXISTS "plays write" ON public.plays;

CREATE POLICY "owner updates own play" ON public.plays
  FOR UPDATE TO authenticated
  USING (created_by IS NOT NULL AND created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "owner deletes own play" ON public.plays
  FOR DELETE TO authenticated
  USING (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "coach creates own play" ON public.plays
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND team_visible(team_id));

DROP POLICY IF EXISTS "frames write" ON public.play_frames;
DROP POLICY IF EXISTS "frames update" ON public.play_frames;
DROP POLICY IF EXISTS "frames delete" ON public.play_frames;

CREATE POLICY "owner writes frames" ON public.play_frames
  FOR INSERT TO authenticated WITH CHECK (play_owned(play_id));
CREATE POLICY "owner updates frames" ON public.play_frames
  FOR UPDATE TO authenticated USING (play_owned(play_id)) WITH CHECK (play_owned(play_id));
CREATE POLICY "owner deletes frames" ON public.play_frames
  FOR DELETE TO authenticated USING (play_owned(play_id));

-- 5) Atomic copy for a non-owner
CREATE OR REPLACE FUNCTION public.copy_play_for_me(_play uuid, _name text DEFAULT NULL, _team_ids uuid[] DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    created_by, source_play_id, root_play_id, source_creator_id, copied_at
  ) VALUES (
    NULL, coalesce(nullif(trim(_name), ''), src.name || ' — My Version'),
    src.category, src.attack_basket, false, NULL,
    false, NULL, NULL, NULL,
    1, false,
    uid, src.id, coalesce(src.root_play_id, src.id), src.created_by, now()
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
$$;

REVOKE ALL ON FUNCTION public.copy_play_for_me(uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_play_for_me(uuid, text, uuid[]) TO authenticated;

-- 6) Public creator attribution lookup (no email exposed)
CREATE OR REPLACE FUNCTION public.play_author_label(_user uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(nullif(pr.public_display_name, ''), nullif(pr.full_name, ''), nullif(pr.username, ''), 'CoachSide Coach')
  FROM public.profiles pr WHERE pr.id = _user
$$;

REVOKE ALL ON FUNCTION public.play_author_label(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.play_author_label(uuid) TO authenticated;
