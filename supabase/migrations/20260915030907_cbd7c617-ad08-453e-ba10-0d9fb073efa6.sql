-- ---------- columns ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS public_display_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS publish_anonymous_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));

ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS publish_anonymous boolean NOT NULL DEFAULT false;

-- ---------- hearts ----------
CREATE TABLE IF NOT EXISTS public.play_hearts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES public.plays(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (play_id, user_id)
);
CREATE INDEX IF NOT EXISTS play_hearts_play_idx ON public.play_hearts (play_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.play_hearts TO authenticated;
GRANT ALL ON public.play_hearts TO service_role;
ALTER TABLE public.play_hearts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own hearts" ON public.play_hearts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "heart own" ON public.play_hearts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "unheart own" ON public.play_hearts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- follows ----------
CREATE TABLE IF NOT EXISTS public.coach_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid(),
  creator_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, creator_id),
  CHECK (follower_id <> creator_id)
);
GRANT SELECT, INSERT, DELETE ON public.coach_follows TO authenticated;
GRANT ALL ON public.coach_follows TO service_role;
ALTER TABLE public.coach_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own follows" ON public.coach_follows
  FOR SELECT TO authenticated USING (follower_id = auth.uid());
CREATE POLICY "follow own" ON public.coach_follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "unfollow own" ON public.coach_follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- ---------- app owners ----------
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_admins TO authenticated;
GRANT ALL ON public.app_admins TO service_role;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own admin row" ON public.app_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid());
$$;

-- ---------- play of the day ----------
CREATE TABLE IF NOT EXISTS public.featured_play (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  play_id uuid REFERENCES public.plays(id) ON DELETE SET NULL,
  set_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.featured_play TO service_role;
ALTER TABLE public.featured_play ENABLE ROW LEVEL SECURITY;
CREATE POLICY "featured play is service managed" ON public.featured_play
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

INSERT INTO public.featured_play (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_play_of_the_day(_play uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Only CoachSide owners can set the Play of the Day';
  END IF;
  IF _play IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.plays WHERE id = _play AND published_to_library
  ) THEN
    RAISE EXCEPTION 'Only a published Library play can be featured';
  END IF;
  INSERT INTO public.featured_play (id, play_id, set_by, updated_at)
  VALUES (true, _play, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE
    SET play_id = EXCLUDED.play_id, set_by = EXCLUDED.set_by, updated_at = now();
END;
$$;

-- ---------- public library feed ----------
CREATE OR REPLACE FUNCTION public.library_feed(_creator text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  attack_basket text,
  share_token text,
  published_at timestamptz,
  library_version integer,
  author_label text,
  creator_username text,
  hearts bigint,
  hearts_recent bigint,
  featured boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id,
    p.name,
    p.category,
    p.attack_basket,
    CASE WHEN p.is_shared THEN p.share_token ELSE NULL END,
    p.published_at,
    p.library_version,
    CASE
      WHEN p.publish_anonymous THEN 'Anonymous Coach'
      ELSE COALESCE(NULLIF(pr.public_display_name, ''), NULLIF(p.library_author_name, ''), 'CoachSide Coach')
    END,
    CASE WHEN p.publish_anonymous THEN NULL ELSE pr.username END,
    COALESCE(h.total, 0),
    COALESCE(h.recent, 0),
    (f.play_id = p.id)
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

CREATE OR REPLACE FUNCTION public.public_play_frames(_play uuid)
RETURNS TABLE (id uuid, play_id uuid, idx integer, tokens jsonb, actions jsonb, note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fr.id, fr.play_id, fr.idx, fr.tokens, fr.actions, fr.note
  FROM public.play_frames fr
  JOIN public.plays p ON p.id = fr.play_id
  WHERE fr.play_id = _play AND p.published_to_library
  ORDER BY fr.idx;
$$;

CREATE OR REPLACE FUNCTION public.creator_profile(_username text)
RETURNS TABLE (
  username text,
  display_name text,
  bio text,
  published_plays bigint,
  total_hearts bigint,
  followers bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    pr.username,
    COALESCE(NULLIF(pr.public_display_name, ''), 'CoachSide Coach'),
    pr.bio,
    (SELECT count(*) FROM public.plays p
       WHERE p.published_by = pr.id AND p.published_to_library AND NOT p.publish_anonymous),
    (SELECT count(*) FROM public.play_hearts ph
       JOIN public.plays p ON p.id = ph.play_id
      WHERE p.published_by = pr.id AND p.published_to_library AND NOT p.publish_anonymous),
    (SELECT count(*) FROM public.coach_follows cf WHERE cf.creator_id = pr.id)
  FROM public.profiles pr
  WHERE pr.username IS NOT NULL AND lower(pr.username) = lower(_username);
$$;

-- ---------- signed-in actions ----------
CREATE OR REPLACE FUNCTION public.toggle_play_heart(_play uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _hearted boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to heart a play'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plays WHERE id = _play AND published_to_library) THEN
    RAISE EXCEPTION 'Only published Library plays can be hearted';
  END IF;
  DELETE FROM public.play_hearts WHERE play_id = _play AND user_id = auth.uid();
  IF FOUND THEN
    _hearted := false;
  ELSE
    INSERT INTO public.play_hearts (play_id, user_id) VALUES (_play, auth.uid());
    _hearted := true;
  END IF;
  RETURN _hearted;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_hearted_plays()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT play_id FROM public.play_hearts WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.set_follow_creator(_username text, _follow boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to follow a coach'; END IF;
  SELECT id INTO _target FROM public.profiles
   WHERE username IS NOT NULL AND lower(username) = lower(_username);
  IF _target IS NULL THEN RAISE EXCEPTION 'No such coach'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'You cannot follow yourself'; END IF;
  IF _follow THEN
    INSERT INTO public.coach_follows (follower_id, creator_id)
    VALUES (auth.uid(), _target) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.coach_follows WHERE follower_id = auth.uid() AND creator_id = _target;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_followed_creators()
RETURNS TABLE (username text, display_name text, published_plays bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pr.username,
         COALESCE(NULLIF(pr.public_display_name, ''), 'CoachSide Coach'),
         (SELECT count(*) FROM public.plays p
            WHERE p.published_by = pr.id AND p.published_to_library AND NOT p.publish_anonymous)
  FROM public.coach_follows cf
  JOIN public.profiles pr ON pr.id = cf.creator_id
  WHERE cf.follower_id = auth.uid() AND pr.username IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.set_my_username(_username text, _display_name text, _bio text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := lower(trim(COALESCE(_username, '')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF _clean = '' THEN
    UPDATE public.profiles
       SET username = NULL,
           public_display_name = NULLIF(trim(COALESCE(_display_name, '')), ''),
           bio = NULLIF(trim(COALESCE(_bio, '')), '')
     WHERE id = auth.uid();
    RETURN;
  END IF;
  IF _clean !~ '^[a-z0-9_]{3,24}$' THEN
    RAISE EXCEPTION 'Handles use 3-24 letters, numbers or underscores';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = _clean AND id <> auth.uid()) THEN
    RAISE EXCEPTION 'That handle is taken';
  END IF;
  UPDATE public.profiles
     SET username = _clean,
         public_display_name = NULLIF(trim(COALESCE(_display_name, '')), ''),
         bio = NULLIF(trim(COALESCE(_bio, '')), '')
   WHERE id = auth.uid();
END;
$$;

-- ---------- execution grants ----------
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_play_of_the_day(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.library_feed(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_play_frames(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.creator_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_play_heart(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_hearted_plays() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_follow_creator(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_followed_creators() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_username(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.library_feed(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_play_frames(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.creator_profile(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_play_of_the_day(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_play_heart(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_hearted_plays() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_follow_creator(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_followed_creators() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_my_username(text, text, text) TO authenticated, service_role;