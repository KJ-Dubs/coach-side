-- 1. Give the two ownerless teams a real owner so tightened checks do not lock the coach out
update public.teams t
set org_id = 'ea847326-9dd0-43e5-a9ba-12f8e227ee54'
where t.org_id is null;

insert into public.team_members (team_id, user_id, role, active)
select t.id, '41188df2-31a5-49d3-9c60-7b80b679f339', 'head_coach'::public.team_role, true
from public.teams t
where t.org_id = 'ea847326-9dd0-43e5-a9ba-12f8e227ee54'
on conflict (team_id, user_id) do nothing;

-- 2. Coach checks: explicit team membership, or an actual coach seat in the team's organization
create or replace function public.is_team_coach(_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = _team and m.user_id = auth.uid() and m.active
      and m.role in ('head_coach','assistant_coach')
  ) or exists (
    select 1
    from public.teams t
    join public.org_members om on om.org_id = t.org_id
    where t.id = _team and t.org_id is not null and om.user_id = auth.uid()
  )
$$;

create or replace function public.is_team_head_coach(_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = _team and m.user_id = auth.uid() and m.active and m.role = 'head_coach'
  ) or exists (
    select 1
    from public.teams t
    join public.org_members om on om.org_id = t.org_id
    where t.id = _team and t.org_id is not null
      and om.user_id = auth.uid() and om.role = 'head_coach'
  )
$$;

-- 3. Shared plays are served through a token-checked server route, not open to anon
drop policy if exists "plays select" on public.plays;
create policy "plays select" on public.plays
for select to authenticated
using (public.team_visible(team_id));

drop policy if exists "frames select" on public.play_frames;
create policy "frames select" on public.play_frames
for select to authenticated
using (public.play_visible(play_id));

create or replace function public.play_visible(_play uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plays p where p.id = _play and public.team_visible(p.team_id)
  )
$$;

-- 4. Team logos: no public listing; only that team's coaches and members
drop policy if exists "team logos public read" on storage.objects;
create policy "team logos member read" on storage.objects
for select to authenticated
using (
  bucket_id = 'team-logos'
  and exists (
    select 1 from public.teams t
    where t.id = ((storage.foldername(name))[1])::uuid
      and (public.is_team_coach(t.id) or public.is_team_member(t.id))
  )
);
