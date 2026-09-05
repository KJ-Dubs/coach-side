
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  org_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

alter table public.teams add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.games add column if not exists ended_at timestamptz;

create or replace function public.my_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.team_visible(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _team is null or exists (
    select 1 from public.teams t
    where t.id = _team and (t.org_id is null or t.org_id = public.my_org_id())
  )
$$;

create or replace function public.game_visible(_game uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.games g where g.id = _game and public.team_visible(g.team_id)
  )
$$;

create or replace function public.play_visible(_play uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plays p where p.id = _play and (p.is_shared or public.team_visible(p.team_id))
  )
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into public.organizations (name)
  values (coalesce(nullif(new.raw_user_meta_data->>'org_name',''), 'My Program'))
  returning id into new_org;
  insert into public.profiles (id, email, full_name, org_id)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new_org);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create policy "org members read org" on public.organizations for select to authenticated using (id = public.my_org_id());
create policy "org members update org" on public.organizations for update to authenticated using (id = public.my_org_id()) with check (id = public.my_org_id());

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile write" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "open teams" on public.teams;
drop policy if exists "open players" on public.players;
drop policy if exists "open games" on public.games;
drop policy if exists "open game_events" on public.game_events;
drop policy if exists "open substitutions" on public.substitutions;
drop policy if exists "open plays" on public.plays;
drop policy if exists "open play_frames" on public.play_frames;

create policy "teams visible" on public.teams for select to anon, authenticated using (org_id is null or org_id = public.my_org_id());
create policy "teams write" on public.teams for all to anon, authenticated using (org_id is null or org_id = public.my_org_id()) with check (org_id is null or org_id = public.my_org_id());

create policy "players visible" on public.players for all to anon, authenticated using (public.team_visible(team_id)) with check (public.team_visible(team_id));
create policy "games visible" on public.games for all to anon, authenticated using (public.team_visible(team_id)) with check (public.team_visible(team_id));
create policy "events visible" on public.game_events for all to anon, authenticated using (public.game_visible(game_id)) with check (public.game_visible(game_id));
create policy "subs visible" on public.substitutions for all to anon, authenticated using (public.game_visible(game_id)) with check (public.game_visible(game_id));
create policy "plays visible" on public.plays for all to anon, authenticated using (is_shared or public.team_visible(team_id)) with check (public.team_visible(team_id));
create policy "frames visible" on public.play_frames for all to anon, authenticated using (public.play_visible(play_id)) with check (public.play_visible(play_id));
