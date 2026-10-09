ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS concepts text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS defenses text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS outcomes text[] NOT NULL DEFAULT '{}';

UPDATE public.plays SET
  concepts = CASE situation
    WHEN 'Baseline out of bounds' THEN ARRAY['BLOB']
    WHEN 'Sideline out of bounds' THEN ARRAY['SLOB']
    WHEN 'Half court set' THEN ARRAY['Set']
    WHEN 'Quick hitter' THEN ARRAY['Set']
    WHEN 'After timeout' THEN ARRAY['Set']
    WHEN 'End of quarter' THEN ARRAY['Set']
    ELSE concepts END,
  defenses = CASE WHEN defense_faced IS NOT NULL AND defense_faced <> '' THEN ARRAY[defense_faced] ELSE defenses END,
  outcomes = CASE WHEN outcome IS NOT NULL AND outcome <> '' THEN ARRAY[outcome] ELSE outcomes END
WHERE situation IS NOT NULL OR defense_faced IS NOT NULL OR outcome IS NOT NULL;

COMMENT ON COLUMN public.plays.situation IS 'LEGACY: preserved original value; new UI writes concepts[]';
COMMENT ON COLUMN public.plays.defense_faced IS 'LEGACY: first of defenses[]; new UI writes defenses[]';
COMMENT ON COLUMN public.plays.outcome IS 'LEGACY: first of outcomes[]; new UI writes outcomes[]';

DROP FUNCTION IF EXISTS public.library_feed(text);
CREATE FUNCTION public.library_feed(_creator text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, category text, attack_basket text, share_token text, published_at timestamp with time zone, library_version integer, author_label text, creator_username text, hearts bigint, hearts_recent bigint, featured boolean, situation text, defense_faced text, outcome text, primary_actions text[], time_pressure text, tags text[], concepts text[], defenses text[], outcomes text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.name, p.category, p.attack_basket,
    CASE WHEN p.is_shared THEN p.share_token ELSE NULL END,
    p.published_at, p.library_version,
    CASE WHEN p.publish_anonymous THEN 'Anonymous Coach'
         ELSE COALESCE(NULLIF(pr.public_display_name, ''), NULLIF(p.library_author_name, ''), 'CoachSide Coach') END,
    CASE WHEN p.publish_anonymous THEN NULL ELSE pr.username END,
    COALESCE(h.total, 0), COALESCE(h.recent, 0), (f.play_id = p.id),
    p.situation, p.defense_faced, p.outcome, p.primary_actions, p.time_pressure, p.tags,
    p.concepts, p.defenses, p.outcomes
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
$function$;
GRANT EXECUTE ON FUNCTION public.library_feed(text) TO PUBLIC;