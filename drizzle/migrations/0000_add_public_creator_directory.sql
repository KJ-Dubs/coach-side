CREATE OR REPLACE FUNCTION public.creator_directory()
RETURNS TABLE (
  username text,
  display_name text,
  bio text,
  published_plays bigint,
  total_hearts bigint,
  followers bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.username,
    COALESCE(NULLIF(pr.public_display_name, ''), 'CoachSide Coach') AS display_name,
    pr.bio,
    count(DISTINCT p.id)::bigint AS published_plays,
    count(DISTINCT ph.id)::bigint AS total_hearts,
    count(DISTINCT cf.follower_id)::bigint AS followers
  FROM public.profiles pr
  JOIN public.plays p
    ON p.published_by = pr.id
   AND p.published_to_library
   AND NOT p.publish_anonymous
  LEFT JOIN public.play_hearts ph ON ph.play_id = p.id
  LEFT JOIN public.coach_follows cf ON cf.creator_id = pr.id
  WHERE pr.username IS NOT NULL
    AND btrim(pr.username) <> ''
  GROUP BY pr.id, pr.username, pr.public_display_name, pr.bio
  HAVING count(DISTINCT p.id) > 0
  ORDER BY count(DISTINCT cf.follower_id) DESC,
           count(DISTINCT p.id) DESC,
           lower(COALESCE(NULLIF(pr.public_display_name, ''), pr.username));
$$;

REVOKE ALL ON FUNCTION public.creator_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_directory() TO anon, authenticated, service_role;