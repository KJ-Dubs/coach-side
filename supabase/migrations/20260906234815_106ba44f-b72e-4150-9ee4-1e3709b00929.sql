
create or replace function public.team_directory(_team uuid)
returns table(user_id uuid, full_name text, email text, role text, player_id uuid, jersey text, player_name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.full_name, p.email, m.role::text, m.player_id, pl.jersey, pl.name
  from public.team_members m
  left join public.profiles p on p.id = m.user_id
  left join public.players pl on pl.id = m.player_id
  where m.team_id = _team and m.active and public.is_team_member(_team)
  order by m.role, coalesce(p.full_name, p.email, '')
$$;
revoke all on function public.team_directory(uuid) from public, anon;
grant execute on function public.team_directory(uuid) to authenticated;

create or replace function public.ensure_team_conversation(_team uuid, _type text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if _type not in ('team','staff') then raise exception 'Unknown conversation type'; end if;
  if _type = 'staff' and not public.is_team_coach(_team) then raise exception 'Staff chat is coaches only'; end if;
  if _type = 'team' and not public.is_team_staff_or_player(_team) then raise exception 'You are not on this team'; end if;

  select id into cid from public.conversations where team_id = _team and type = _type;
  if cid is null then
    insert into public.conversations (team_id, type, created_by, title)
    values (_team, _type, uid, case when _type = 'staff' then 'Staff Chat' else 'Team Chat' end)
    returning id into cid;
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values (cid, uid) on conflict (conversation_id, user_id) do nothing;
  return cid;
end;
$$;
revoke all on function public.ensure_team_conversation(uuid, text) from public, anon;
grant execute on function public.ensure_team_conversation(uuid, text) to authenticated;

create or replace function public.ensure_direct_conversation(_team uuid, _other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; uid uuid := auth.uid(); my_role text; other_role text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  my_role := public.my_team_role(_team);
  select m.role::text into other_role from public.team_members m
    where m.team_id = _team and m.user_id = _other and m.active;
  if my_role is null or other_role is null then raise exception 'Both people must be on this team'; end if;
  if my_role = 'parent' or other_role = 'parent' then raise exception 'Private messages are for coaches and players'; end if;
  if my_role = 'player' and other_role = 'player' then raise exception 'Players cannot message each other yet'; end if;

  select c.id into cid from public.conversations c
   where c.team_id = _team and c.type = 'direct'
     and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = uid)
     and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = _other)
     and (select count(*) from public.conversation_members d where d.conversation_id = c.id) = 2
   limit 1;

  if cid is null then
    insert into public.conversations (team_id, type, created_by, title)
    values (_team, 'direct', uid, null) returning id into cid;
    insert into public.conversation_members (conversation_id, user_id) values (cid, uid), (cid, _other);
  end if;
  return cid;
end;
$$;
revoke all on function public.ensure_direct_conversation(uuid, uuid) from public, anon;
grant execute on function public.ensure_direct_conversation(uuid, uuid) to authenticated;
