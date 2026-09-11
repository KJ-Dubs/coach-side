ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_created boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare new_org uuid;
        meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
        is_player boolean := coalesce(meta->>'signup_type', '') = 'player'
                             or coalesce(meta->>'invite_token', '') <> '';
begin
  if is_player then
    insert into public.profiles (id, email, full_name, org_id)
    values (new.id, new.email, meta->>'full_name', null)
    on conflict (id) do nothing;
  else
    insert into public.organizations (name, auto_created)
    values (coalesce(nullif(meta->>'org_name',''), 'My Program'), true)
    returning id into new_org;
    insert into public.profiles (id, email, full_name, org_id)
    values (new.id, new.email, meta->>'full_name', new_org);
    insert into public.org_members (org_id, user_id, role)
    values (new_org, new.id, 'head_coach')
    on conflict (org_id, user_id) do nothing;
  end if;
  insert into public.notification_preferences (user_id)
  values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text, _player_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare inv public.team_invites%rowtype;
        uid uuid := auth.uid();
        new_role public.team_role;
        team_org uuid;
        orphan_org uuid;
begin
  if uid is null then raise exception 'Sign in to join this team'; end if;
  select * into inv from public.team_invites where token = _token;
  if not found then raise exception 'This invite link is not valid'; end if;
  if not inv.active then raise exception 'This invite link has been turned off'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'This invite link has expired'; end if;

  new_role := case when inv.invite_type = 'parent' then 'parent'::public.team_role else 'player'::public.team_role end;

  if new_role = 'player' then
    if _player_id is null then
      raise exception 'Pick your name on the roster to join this team';
    end if;
    if not exists (
      select 1 from public.players p
      where p.id = _player_id and p.team_id = inv.team_id and p.active
    ) then
      raise exception 'That player is not on this team roster';
    end if;
    if exists (
      select 1 from public.team_members m
      where m.player_id = _player_id and m.active and m.user_id <> uid
    ) then
      raise exception 'That player has already been claimed';
    end if;
  end if;

  insert into public.team_members (team_id, user_id, role, player_id, active)
  values (inv.team_id, uid, new_role, case when new_role = 'player' then _player_id else null end, true)
  on conflict (team_id, user_id) do update
    set role = excluded.role,
        player_id = coalesce(excluded.player_id, public.team_members.player_id),
        active = true,
        updated_at = now();

  if new_role = 'player' then
    -- Neutralise a program that was auto-created by the broken signup path.
    for orphan_org in
      select om.org_id from public.org_members om
      where om.user_id = uid
    loop
      if exists (select 1 from public.organizations o where o.id = orphan_org and o.auto_created)
         and not exists (select 1 from public.teams t where t.org_id = orphan_org)
         and (select count(*) from public.org_members m2 where m2.org_id = orphan_org) = 1
      then
        update public.profiles set org_id = null where id = uid and org_id = orphan_org;
        delete from public.org_members where org_id = orphan_org and user_id = uid;
        delete from public.organizations where id = orphan_org;
      end if;
    end loop;
  end if;

  select org_id into team_org from public.teams where id = inv.team_id;
  if team_org is not null then
    update public.profiles set org_id = team_org where id = uid and org_id is null;
  end if;

  return jsonb_build_object('team_id', inv.team_id, 'role', new_role::text);
end;
$function$;