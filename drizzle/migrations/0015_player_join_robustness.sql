-- Players/parents updating their own membership row may not reactivate a removed
-- membership or switch roster identity; only coaches or the invite flow can.
CREATE OR REPLACE FUNCTION public.guard_team_member_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(current_setting('coachside.invite_accept', true), '') = '1' THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid() AND NOT public.is_team_coach(OLD.team_id) THEN
    IF NEW.active AND NOT OLD.active THEN
      RAISE EXCEPTION 'Your coach removed your access to this team. Ask them to restore it.';
    END IF;
    IF NEW.player_id IS DISTINCT FROM OLD.player_id THEN
      RAISE EXCEPTION 'Your roster name can only be changed through your team invite or by your coach.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_team_member_self_update ON public.team_members;
CREATE TRIGGER guard_team_member_self_update BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.guard_team_member_self_update();

CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text, _player_id uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare inv public.team_invites%rowtype;
        uid uuid := auth.uid();
        new_role public.team_role;
        mem public.team_members%rowtype;
        orphan_org uuid;
begin
  if uid is null then raise exception 'Sign in to join this team'; end if;
  select * into inv from public.team_invites where token = _token;
  if not found then raise exception 'This invite link is not valid'; end if;
  if not inv.active then raise exception 'This invite link has been turned off'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'This invite link has expired'; end if;

  new_role := case when inv.invite_type = 'parent' then 'parent'::public.team_role else 'player'::public.team_role end;

  select * into mem from public.team_members where team_id = inv.team_id and user_id = uid;
  if found then
    -- A coach removal is never undone by re-opening the link.
    if not mem.active then
      raise exception 'Your coach removed your access to this team. Ask them to restore it.';
    end if;
    -- Coaches (and parents on a parent link) are already in: never downgrade.
    if mem.role in ('head_coach', 'assistant_coach')
       or (mem.role = new_role and new_role = 'parent') then
      return jsonb_build_object('team_id', inv.team_id, 'role', mem.role::text, 'already', true);
    end if;
  end if;

  if new_role = 'player' then
    if _player_id is null then
      raise exception 'Pick your name on the roster to join this team';
    end if;
    -- Idempotent: same account, same team, same roster name.
    if found and mem.role = 'player' and mem.player_id = _player_id then
      return jsonb_build_object('team_id', inv.team_id, 'role', 'player', 'already', true);
    end if;
    -- Roster identity stays stable once linked.
    if found and mem.role = 'player' and mem.player_id is not null and mem.player_id <> _player_id then
      raise exception 'You are already on this team under another roster name. Ask your coach to change it.';
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

  perform set_config('coachside.invite_accept', '1', true);
  insert into public.team_members (team_id, user_id, role, player_id, active)
  values (inv.team_id, uid, new_role, case when new_role = 'player' then _player_id else null end, true)
  on conflict (team_id, user_id) do update
    set role = excluded.role,
        player_id = coalesce(excluded.player_id, public.team_members.player_id),
        updated_at = now();
  perform set_config('coachside.invite_accept', '', true);

  if new_role = 'player' then
    for orphan_org in
      select om.org_id from public.org_members om where om.user_id = uid
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

  return jsonb_build_object('team_id', inv.team_id, 'role', new_role::text, 'already', false);
end;
$function$;