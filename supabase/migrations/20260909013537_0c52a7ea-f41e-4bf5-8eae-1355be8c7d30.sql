create or replace function public.guard_profile_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  -- Server/trigger context (no JWT user) is trusted.
  if uid is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.org_id is not null and not exists (
      select 1 from public.org_members m where m.user_id = new.id and m.org_id = new.org_id
    ) then
      raise exception 'Not allowed to join this organization';
    end if;
    return new;
  end if;

  if new.org_id is distinct from old.org_id then
    if new.org_id is not null and not exists (
      select 1 from public.org_members m where m.user_id = new.id and m.org_id = new.org_id
    ) then
      raise exception 'Organization membership can only be changed by accepting an invitation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_org_id on public.profiles;
create trigger guard_profile_org_id
before insert or update on public.profiles
for each row execute function public.guard_profile_org_id();

-- Ensure invite acceptance creates membership before setting profile org.
create or replace function public.accept_invite(_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare inv public.coach_invites%rowtype;
        uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to accept an invitation';
  end if;
  select * into inv from public.coach_invites where token = _token;
  if not found then
    raise exception 'Invitation not found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'Invitation already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'Invitation expired';
  end if;

  delete from public.org_members where user_id = uid and org_id <> inv.org_id;
  insert into public.org_members (org_id, user_id, role)
  values (inv.org_id, uid, inv.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.profiles set org_id = inv.org_id where id = uid;
  if not found then
    insert into public.profiles (id, org_id) values (uid, inv.org_id);
  end if;

  update public.coach_invites set accepted_by = uid, accepted_at = now() where id = inv.id;
  return jsonb_build_object('org_id', inv.org_id, 'role', inv.role, 'team_id', inv.team_id);
end;
$$;

revoke all on function public.guard_profile_org_id() from public, anon, authenticated;