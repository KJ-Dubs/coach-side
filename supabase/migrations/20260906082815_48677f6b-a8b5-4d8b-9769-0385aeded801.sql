-- ---------- games: setup details ----------
alter table public.games add column if not exists home_away text not null default 'home';
alter table public.games add column if not exists overtime_minutes integer not null default 4;

-- ---------- teams: settings ----------
alter table public.teams add column if not exists logo_url text;
alter table public.teams add column if not exists head_coach_name text;
alter table public.teams add column if not exists assistant_coaches text;
alter table public.teams add column if not exists default_periods integer not null default 4;
alter table public.teams add column if not exists default_period_minutes integer not null default 8;
alter table public.teams add column if not exists default_overtime_minutes integer not null default 4;

-- ---------- coach roles ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'coach_role') then
    create type public.coach_role as enum ('head_coach', 'assistant_coach');
  end if;
end $$;

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.coach_role not null default 'assistant_coach',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
grant select on public.org_members to authenticated;
grant all on public.org_members to service_role;
alter table public.org_members enable row level security;

create or replace function public.my_role()
returns public.coach_role
language sql stable security definer set search_path = public
as $$
  select m.role from public.org_members m
  where m.user_id = auth.uid() and m.org_id = public.my_org_id()
  limit 1
$$;

create or replace function public.is_head_coach()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() = 'head_coach', false)
$$;

revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;
revoke execute on function public.is_head_coach() from public, anon;
grant execute on function public.is_head_coach() to authenticated;

drop policy if exists "members read org members" on public.org_members;
create policy "members read org members" on public.org_members
  for select to authenticated using (org_id = public.my_org_id());

-- new accounts: org + profile + head coach membership
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $function$
declare new_org uuid;
begin
  insert into public.organizations (name)
  values (coalesce(nullif(new.raw_user_meta_data->>'org_name',''), 'My Program'))
  returning id into new_org;
  insert into public.profiles (id, email, full_name, org_id)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new_org);
  insert into public.org_members (org_id, user_id, role)
  values (new_org, new.id, 'head_coach')
  on conflict (org_id, user_id) do nothing;
  return new;
end;
$function$;

-- backfill: any existing profile with an org becomes head coach of it
insert into public.org_members (org_id, user_id, role)
select p.org_id, p.id, 'head_coach' from public.profiles p
where p.org_id is not null
on conflict (org_id, user_id) do nothing;

-- ---------- coach invites ----------
create table if not exists public.coach_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  email text not null,
  role public.coach_role not null default 'assistant_coach',
  token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.coach_invites to authenticated;
grant all on public.coach_invites to service_role;
alter table public.coach_invites enable row level security;

drop policy if exists "org reads invites" on public.coach_invites;
create policy "org reads invites" on public.coach_invites
  for select to authenticated using (org_id = public.my_org_id());
drop policy if exists "head coach creates invites" on public.coach_invites;
create policy "head coach creates invites" on public.coach_invites
  for insert to authenticated
  with check (org_id = public.my_org_id() and public.is_head_coach() and invited_by = auth.uid());
drop policy if exists "head coach revokes invites" on public.coach_invites;
create policy "head coach revokes invites" on public.coach_invites
  for delete to authenticated using (org_id = public.my_org_id() and public.is_head_coach());

-- public lookup by secret token (no ids leaked)
create or replace function public.get_invite(_token text)
returns table (org_name text, team_name text, role text, email text, status text)
language sql stable security definer set search_path = public
as $$
  select o.name,
         t.name,
         i.role::text,
         i.email,
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

create or replace function public.accept_invite(_token text)
returns jsonb
language plpgsql security definer set search_path = public
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

  update public.profiles set org_id = inv.org_id where id = uid;
  if not found then
    insert into public.profiles (id, org_id) values (uid, inv.org_id);
  end if;

  delete from public.org_members where user_id = uid and org_id <> inv.org_id;
  insert into public.org_members (org_id, user_id, role)
  values (inv.org_id, uid, inv.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.coach_invites set accepted_by = uid, accepted_at = now() where id = inv.id;
  return jsonb_build_object('org_id', inv.org_id, 'role', inv.role, 'team_id', inv.team_id);
end;
$$;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------- profiles: coaches in one program can see each other ----------
drop policy if exists "org members read profiles" on public.profiles;
create policy "org members read profiles" on public.profiles
  for select to authenticated using (org_id is not null and org_id = public.my_org_id());

-- ---------- organizations: only head coach renames ----------
drop policy if exists "org members update org" on public.organizations;
create policy "head coach updates org" on public.organizations
  for update to authenticated
  using (id = public.my_org_id() and public.is_head_coach())
  with check (id = public.my_org_id() and public.is_head_coach());

-- ---------- tighten team data to signed-in coaches ----------
drop policy if exists "teams visible" on public.teams;
drop policy if exists "teams write" on public.teams;
create policy "teams select" on public.teams
  for select to authenticated using (org_id is null or org_id = public.my_org_id());
create policy "teams insert" on public.teams
  for insert to authenticated with check (org_id is null or org_id = public.my_org_id());
create policy "teams update" on public.teams
  for update to authenticated
  using (org_id is null or org_id = public.my_org_id())
  with check (org_id is null or org_id = public.my_org_id());
create policy "teams delete head coach" on public.teams
  for delete to authenticated
  using ((org_id is null or org_id = public.my_org_id()) and public.is_head_coach());

drop policy if exists "players visible" on public.players;
create policy "players all" on public.players
  for all to authenticated using (public.team_visible(team_id)) with check (public.team_visible(team_id));

drop policy if exists "games visible" on public.games;
create policy "games all" on public.games
  for all to authenticated using (public.team_visible(team_id)) with check (public.team_visible(team_id));

drop policy if exists "events visible" on public.game_events;
create policy "events all" on public.game_events
  for all to authenticated using (public.game_visible(game_id)) with check (public.game_visible(game_id));

drop policy if exists "subs visible" on public.substitutions;
create policy "subs all" on public.substitutions
  for all to authenticated using (public.game_visible(game_id)) with check (public.game_visible(game_id));

drop policy if exists "plays visible" on public.plays;
create policy "plays select" on public.plays
  for select to anon, authenticated using (is_shared or public.team_visible(team_id));
create policy "plays write" on public.plays
  for insert to authenticated with check (public.team_visible(team_id));
create policy "plays update" on public.plays
  for update to authenticated using (public.team_visible(team_id)) with check (public.team_visible(team_id));
create policy "plays delete" on public.plays
  for delete to authenticated using (public.team_visible(team_id));

drop policy if exists "frames visible" on public.play_frames;
create policy "frames select" on public.play_frames
  for select to anon, authenticated using (public.play_visible(play_id));
create policy "frames write" on public.play_frames
  for insert to authenticated with check (public.play_visible(play_id));
create policy "frames update" on public.play_frames
  for update to authenticated using (public.play_visible(play_id)) with check (public.play_visible(play_id));
create policy "frames delete" on public.play_frames
  for delete to authenticated using (public.play_visible(play_id));

-- ---------- team logo storage policies (bucket created separately) ----------
drop policy if exists "team logos public read" on storage.objects;
create policy "team logos public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'team-logos');
drop policy if exists "team logos coach upload" on storage.objects;
create policy "team logos coach upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'team-logos');
drop policy if exists "team logos coach update" on storage.objects;
create policy "team logos coach update" on storage.objects
  for update to authenticated using (bucket_id = 'team-logos') with check (bucket_id = 'team-logos');
drop policy if exists "team logos coach delete" on storage.objects;
create policy "team logos coach delete" on storage.objects
  for delete to authenticated using (bucket_id = 'team-logos');