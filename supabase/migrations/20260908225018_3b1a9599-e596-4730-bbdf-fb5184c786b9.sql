CREATE TABLE public.play_team_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES public.plays(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  assigned_by uuid,
  is_visible boolean NOT NULL DEFAULT true,
  category_override text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (play_id, team_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.play_team_assignments TO authenticated;
GRANT ALL ON public.play_team_assignments TO service_role;

ALTER TABLE public.play_team_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments select" ON public.play_team_assignments
  FOR SELECT TO authenticated
  USING (public.is_team_staff_or_player(team_id) OR public.team_visible(team_id));

CREATE POLICY "assignments insert" ON public.play_team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_coach(team_id) AND public.play_visible(play_id));

CREATE POLICY "assignments update" ON public.play_team_assignments
  FOR UPDATE TO authenticated
  USING (public.is_team_coach(team_id))
  WITH CHECK (public.is_team_coach(team_id));

CREATE POLICY "assignments delete" ON public.play_team_assignments
  FOR DELETE TO authenticated
  USING (public.is_team_coach(team_id));

CREATE INDEX play_team_assignments_team_idx ON public.play_team_assignments(team_id);
CREATE INDEX play_team_assignments_play_idx ON public.play_team_assignments(play_id);

CREATE TRIGGER update_play_team_assignments_updated_at
  BEFORE UPDATE ON public.play_team_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.play_team_assignments (play_id, team_id)
SELECT p.id, p.team_id FROM public.plays p WHERE p.team_id IS NOT NULL
ON CONFLICT (play_id, team_id) DO NOTHING;

-- plays remain readable when shared with a team the user can see
CREATE POLICY "assigned team reads plays" ON public.plays
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.play_team_assignments a
    WHERE a.play_id = plays.id
      AND (public.is_team_staff_or_player(a.team_id) OR public.team_visible(a.team_id))
  ));

CREATE POLICY "assigned team reads play frames" ON public.play_frames
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.play_team_assignments a
    WHERE a.play_id = play_frames.play_id
      AND (public.is_team_staff_or_player(a.team_id) OR public.team_visible(a.team_id))
  ));