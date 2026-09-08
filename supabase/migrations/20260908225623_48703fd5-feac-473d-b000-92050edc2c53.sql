-- 1. Coach checks require a team-specific coaching role
CREATE OR REPLACE FUNCTION public.is_team_coach(_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.team_members m
    where m.team_id = _team and m.user_id = auth.uid() and m.active
      and m.role in ('head_coach','assistant_coach')
  )
$function$;

-- 2. Team visibility requires explicit membership (or org membership for org teams)
CREATE OR REPLACE FUNCTION public.team_visible(_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select _team is null or exists (
    select 1 from public.team_members m
    where m.team_id = _team and m.user_id = auth.uid() and m.active
  ) or exists (
    select 1 from public.teams t
    join public.org_members om on om.org_id = t.org_id
    where t.id = _team and t.org_id is not null and om.user_id = auth.uid()
  )
$function$;

-- 3. Team logo storage writes require team coach membership
DROP POLICY IF EXISTS "team logos coach upload" ON storage.objects;
DROP POLICY IF EXISTS "team logos coach update" ON storage.objects;
DROP POLICY IF EXISTS "team logos coach delete" ON storage.objects;

CREATE POLICY "team logos coach upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND public.is_team_coach(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "team logos coach update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'team-logos'
  AND public.is_team_coach(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'team-logos'
  AND public.is_team_coach(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "team logos coach delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'team-logos'
  AND public.is_team_coach(((storage.foldername(name))[1])::uuid)
);