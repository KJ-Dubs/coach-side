DROP FUNCTION IF EXISTS public.invite_roster(text);
CREATE FUNCTION public.invite_roster(_token text)
RETURNS TABLE(id uuid, jersey text, name text, taken boolean, mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select p.id, p.jersey, p.name,
         exists (select 1 from public.team_members m where m.player_id = p.id and m.active and m.user_id is distinct from auth.uid()),
         exists (select 1 from public.team_members m where m.player_id = p.id and m.active and m.user_id = auth.uid())
  from public.team_invites i
  join public.players p on p.team_id = i.team_id and p.active
  where i.token = _token and i.active and (i.expires_at is null or i.expires_at > now())
  order by length(p.jersey), p.jersey
$$;
GRANT EXECUTE ON FUNCTION public.invite_roster(text) TO anon, authenticated;