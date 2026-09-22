-- ============ A) PLAY INDEXING ============
ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS situation text,
  ADD COLUMN IF NOT EXISTS defense_faced text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS primary_actions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_pressure text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS indexed_at timestamptz;

-- ============ C) DRILLS ============
CREATE TABLE public.drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Shooting',
  skill_focus text[] NOT NULL DEFAULT '{}',
  group_size text NOT NULL DEFAULT 'Team',
  court_orientation text NOT NULL DEFAULT 'right',
  equipment text[] NOT NULL DEFAULT '{}',
  duration_minutes integer NOT NULL DEFAULT 10,
  repetitions text,
  instructions text NOT NULL DEFAULT '',
  coaching_points text,
  scoring_rules text,
  difficulty text NOT NULL DEFAULT 'All levels',
  style text NOT NULL DEFAULT 'team',
  tags text[] NOT NULL DEFAULT '{}',
  published_to_library boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  library_author_name text,
  creator_username text,
  hearts integer NOT NULL DEFAULT 0,
  source_drill_id uuid,
  root_drill_id uuid,
  source_creator_id uuid,
  copied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drills TO authenticated;
GRANT SELECT ON public.drills TO anon;
GRANT ALL ON public.drills TO service_role;
ALTER TABLE public.drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published drills are public" ON public.drills
  FOR SELECT USING (published_to_library);
CREATE POLICY "Coaches read own and team drills" ON public.drills
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR (team_id IS NOT NULL AND public.team_visible(team_id)));
CREATE POLICY "Coaches create their own drills" ON public.drills
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creators update their drills" ON public.drills
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creators delete their drills" ON public.drills
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.drill_visible(_drill uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drills d
    WHERE d.id = _drill
      AND (d.published_to_library
        OR d.created_by = auth.uid()
        OR (d.team_id IS NOT NULL AND public.team_visible(d.team_id)))
  )
$$;

CREATE OR REPLACE FUNCTION public.drill_owned(_drill uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drills d WHERE d.id = _drill AND d.created_by IS NOT NULL AND d.created_by = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.drill_published(_drill uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.drills d WHERE d.id = _drill AND d.published_to_library)
$$;

CREATE TABLE public.drill_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id uuid NOT NULL REFERENCES public.drills(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  tokens jsonb NOT NULL DEFAULT '[]',
  actions jsonb NOT NULL DEFAULT '[]',
  objects jsonb NOT NULL DEFAULT '[]',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drill_frames TO authenticated;
GRANT SELECT ON public.drill_frames TO anon;
GRANT ALL ON public.drill_frames TO service_role;
ALTER TABLE public.drill_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published drill frames are public" ON public.drill_frames
  FOR SELECT USING (public.drill_published(drill_id));
CREATE POLICY "Visible drill frames" ON public.drill_frames
  FOR SELECT TO authenticated USING (public.drill_visible(drill_id));
CREATE POLICY "Creators write drill frames" ON public.drill_frames
  FOR INSERT TO authenticated WITH CHECK (public.drill_owned(drill_id));
CREATE POLICY "Creators update drill frames" ON public.drill_frames
  FOR UPDATE TO authenticated USING (public.drill_owned(drill_id)) WITH CHECK (public.drill_owned(drill_id));
CREATE POLICY "Creators delete drill frames" ON public.drill_frames
  FOR DELETE TO authenticated USING (public.drill_owned(drill_id));

CREATE TABLE public.drill_hearts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id uuid NOT NULL REFERENCES public.drills(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drill_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.drill_hearts TO authenticated;
GRANT ALL ON public.drill_hearts TO service_role;
ALTER TABLE public.drill_hearts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own drill hearts" ON public.drill_hearts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Heart a drill" ON public.drill_hearts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.drill_published(drill_id));
CREATE POLICY "Unheart a drill" ON public.drill_hearts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.toggle_drill_heart(_drill uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _hearted boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to save a drill'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.drills WHERE id = _drill AND published_to_library) THEN
    RAISE EXCEPTION 'Only published drills can be saved';
  END IF;
  DELETE FROM public.drill_hearts WHERE drill_id = _drill AND user_id = auth.uid();
  IF FOUND THEN _hearted := false; ELSE
    INSERT INTO public.drill_hearts (drill_id, user_id) VALUES (_drill, auth.uid());
    _hearted := true;
  END IF;
  UPDATE public.drills SET hearts = (SELECT count(*) FROM public.drill_hearts WHERE drill_id = _drill)
   WHERE id = _drill;
  RETURN _hearted;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_hearted_drills()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT drill_id FROM public.drill_hearts WHERE user_id = auth.uid();
$$;

CREATE TABLE public.drill_team_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id uuid NOT NULL REFERENCES public.drills(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drill_id, team_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drill_team_assignments TO authenticated;
GRANT ALL ON public.drill_team_assignments TO service_role;
ALTER TABLE public.drill_team_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members read drill assignments" ON public.drill_team_assignments
  FOR SELECT TO authenticated USING (public.team_visible(team_id));
CREATE POLICY "Coaches assign drills" ON public.drill_team_assignments
  FOR INSERT TO authenticated WITH CHECK (public.is_team_coach(team_id));
CREATE POLICY "Coaches update drill assignments" ON public.drill_team_assignments
  FOR UPDATE TO authenticated USING (public.is_team_coach(team_id)) WITH CHECK (public.is_team_coach(team_id));
CREATE POLICY "Coaches remove drill assignments" ON public.drill_team_assignments
  FOR DELETE TO authenticated USING (public.is_team_coach(team_id));

CREATE OR REPLACE FUNCTION public.copy_drill_for_me(_drill uuid, _name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE src public.drills%rowtype; uid uuid := auth.uid(); new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO src FROM public.drills WHERE id = _drill;
  IF NOT FOUND THEN RAISE EXCEPTION 'Drill not found'; END IF;
  IF NOT public.drill_visible(_drill) THEN RAISE EXCEPTION 'You do not have access to this drill'; END IF;

  INSERT INTO public.drills (
    created_by, team_id, name, category, skill_focus, group_size, court_orientation,
    equipment, duration_minutes, repetitions, instructions, coaching_points, scoring_rules,
    difficulty, style, tags, published_to_library, source_drill_id, root_drill_id,
    source_creator_id, copied_at
  ) VALUES (
    uid, NULL, coalesce(nullif(trim(_name), ''), src.name || ' — My Version'),
    src.category, src.skill_focus, src.group_size, src.court_orientation,
    src.equipment, src.duration_minutes, src.repetitions, src.instructions, src.coaching_points,
    src.scoring_rules, src.difficulty, src.style, src.tags, false, src.id,
    coalesce(src.root_drill_id, src.id), src.created_by, now()
  ) RETURNING id INTO new_id;

  INSERT INTO public.drill_frames (drill_id, idx, tokens, actions, objects, note)
  SELECT new_id, f.idx, f.tokens, f.actions, f.objects, f.note
  FROM public.drill_frames f WHERE f.drill_id = src.id ORDER BY f.idx;

  RETURN new_id;
END;
$$;

CREATE TRIGGER update_drills_updated_at BEFORE UPDATE ON public.drills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_drill_team_assignments_updated_at BEFORE UPDATE ON public.drill_team_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ D) PRACTICE PLANS ============
CREATE TABLE public.practice_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid,
  title text NOT NULL DEFAULT 'Practice',
  plan_date date NOT NULL DEFAULT current_date,
  start_time time,
  total_minutes integer NOT NULL DEFAULT 90,
  shared_to_locker boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_plans TO authenticated;
GRANT ALL ON public.practice_plans TO service_role;
ALTER TABLE public.practice_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coaches read team practice plans" ON public.practice_plans
  FOR SELECT TO authenticated
  USING (public.is_team_coach(team_id) OR (shared_to_locker AND public.team_visible(team_id)));
CREATE POLICY "Coaches create practice plans" ON public.practice_plans
  FOR INSERT TO authenticated WITH CHECK (public.is_team_coach(team_id) AND created_by = auth.uid());
CREATE POLICY "Coaches update practice plans" ON public.practice_plans
  FOR UPDATE TO authenticated USING (public.is_team_coach(team_id)) WITH CHECK (public.is_team_coach(team_id));
CREATE POLICY "Coaches delete practice plans" ON public.practice_plans
  FOR DELETE TO authenticated USING (public.is_team_coach(team_id));

CREATE OR REPLACE FUNCTION public.practice_plan_visible(_plan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.practice_plans p
    WHERE p.id = _plan
      AND (public.is_team_coach(p.team_id) OR (p.shared_to_locker AND public.team_visible(p.team_id)))
  )
$$;

CREATE OR REPLACE FUNCTION public.practice_plan_coach(_plan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.practice_plans p WHERE p.id = _plan AND public.is_team_coach(p.team_id)
  )
$$;

CREATE TABLE public.practice_plan_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.practice_plans(id) ON DELETE CASCADE,
  idx integer NOT NULL DEFAULT 0,
  block_type text NOT NULL DEFAULT 'custom',
  ref_id uuid,
  title text NOT NULL,
  minutes integer NOT NULL DEFAULT 10,
  notes text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_plan_blocks TO authenticated;
GRANT ALL ON public.practice_plan_blocks TO service_role;
ALTER TABLE public.practice_plan_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read blocks of visible plans" ON public.practice_plan_blocks
  FOR SELECT TO authenticated USING (public.practice_plan_visible(plan_id));
CREATE POLICY "Coaches add blocks" ON public.practice_plan_blocks
  FOR INSERT TO authenticated WITH CHECK (public.practice_plan_coach(plan_id));
CREATE POLICY "Coaches update blocks" ON public.practice_plan_blocks
  FOR UPDATE TO authenticated USING (public.practice_plan_coach(plan_id)) WITH CHECK (public.practice_plan_coach(plan_id));
CREATE POLICY "Coaches delete blocks" ON public.practice_plan_blocks
  FOR DELETE TO authenticated USING (public.practice_plan_coach(plan_id));

CREATE TRIGGER update_practice_plans_updated_at BEFORE UPDATE ON public.practice_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_practice_plan_blocks_updated_at BEFORE UPDATE ON public.practice_plan_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LIBRARY FEED WITH INDEX FIELDS ============
DROP FUNCTION IF EXISTS public.library_feed(text);
CREATE OR REPLACE FUNCTION public.library_feed(_creator text DEFAULT NULL::text)
RETURNS TABLE(
  id uuid, name text, category text, attack_basket text, share_token text,
  published_at timestamp with time zone, library_version integer, author_label text,
  creator_username text, hearts bigint, hearts_recent bigint, featured boolean,
  situation text, defense_faced text, outcome text, primary_actions text[],
  time_pressure text, tags text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    p.id, p.name, p.category, p.attack_basket,
    CASE WHEN p.is_shared THEN p.share_token ELSE NULL END,
    p.published_at, p.library_version,
    CASE WHEN p.publish_anonymous THEN 'Anonymous Coach'
         ELSE COALESCE(NULLIF(pr.public_display_name, ''), NULLIF(p.library_author_name, ''), 'CoachSide Coach') END,
    CASE WHEN p.publish_anonymous THEN NULL ELSE pr.username END,
    COALESCE(h.total, 0), COALESCE(h.recent, 0), (f.play_id = p.id),
    p.situation, p.defense_faced, p.outcome, p.primary_actions, p.time_pressure, p.tags
  FROM public.plays p
  LEFT JOIN public.profiles pr ON pr.id = p.published_by
  LEFT JOIN LATERAL (
    SELECT count(*) AS total,
           count(*) FILTER (WHERE ph.created_at > now() - interval '14 days') AS recent
    FROM public.play_hearts ph WHERE ph.play_id = p.id
  ) h ON true
  LEFT JOIN public.featured_play f ON f.id
  WHERE p.published_to_library
    AND (_creator IS NULL OR (NOT p.publish_anonymous AND lower(pr.username) = lower(_creator)))
  ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.library_feed(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_drill_heart(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_hearted_drills() TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_drill_for_me(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drill_visible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drill_owned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drill_published(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_plan_visible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_plan_coach(uuid) TO authenticated;
