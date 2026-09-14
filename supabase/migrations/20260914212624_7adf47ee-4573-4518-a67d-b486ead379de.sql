
CREATE TABLE public.coach_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_notes TO authenticated;
GRANT ALL ON public.coach_notes TO service_role;

ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach notes select own" ON public.coach_notes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "coach notes insert own" ON public.coach_notes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "coach notes update own" ON public.coach_notes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "coach notes delete own" ON public.coach_notes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_coach_notes_updated_at
  BEFORE UPDATE ON public.coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX coach_notes_user_idx ON public.coach_notes (user_id, completed, created_at DESC);

-- ---------- CoachSide play library ----------

ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS published_to_library boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS library_author_name text,
  ADD COLUMN IF NOT EXISTS library_version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS plays_library_idx
  ON public.plays (published_to_library, category, created_at DESC);

ALTER TABLE public.play_team_assignments
  ADD COLUMN IF NOT EXISTS library_version integer;

CREATE OR REPLACE FUNCTION public.play_published(_play uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plays p
    WHERE p.id = _play AND p.published_to_library
  )
$$;

REVOKE ALL ON FUNCTION public.play_published(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.play_published(uuid) TO authenticated;

CREATE POLICY "published library plays are readable" ON public.plays
  FOR SELECT TO authenticated USING (published_to_library);

CREATE POLICY "published library frames are readable" ON public.play_frames
  FOR SELECT TO authenticated USING (public.play_published(play_id));

DROP POLICY IF EXISTS "assignments insert" ON public.play_team_assignments;
CREATE POLICY "assignments insert" ON public.play_team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_team_coach(team_id)
    AND (play_visible(play_id) OR public.play_published(play_id))
  );
