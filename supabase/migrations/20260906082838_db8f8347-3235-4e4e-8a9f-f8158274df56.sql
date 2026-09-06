revoke execute on function public.game_visible(uuid) from public, anon;
grant execute on function public.game_visible(uuid) to authenticated;

create or replace function public.get_invite(_token text)
returns table (org_name text, team_name text, role text, email text, status text)
language sql stable security definer set search_path = public
as $$
  select o.name,
         t.name,
         i.role::text,
         case
           when position('@' in i.email) > 1
             then left(i.email, 1) || '***' || substring(i.email from position('@' in i.email))
           else '***'
         end,
         case
           when i.accepted_at is not null then 'accepted'
           when i.expires_at < now() then 'expired'
           else 'pending'
         end
  from public.coach_invites i
  join public.organizations o on o.id = i.org_id
  left join public.teams t on t.id = i.team_id
  where i.token = _token
  limit 1
$$;
grant execute on function public.get_invite(text) to anon, authenticated;