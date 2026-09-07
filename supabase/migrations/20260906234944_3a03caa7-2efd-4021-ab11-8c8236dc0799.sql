
create policy "members read team" on public.teams
  for select to authenticated using (public.is_team_member(id));

create policy "members read roster" on public.players
  for select to authenticated using (public.is_team_member(team_id));

create policy "members read schedule" on public.team_events
  for select to authenticated using (
    public.is_team_member(team_id)
    and (visibility <> 'coaches' or public.is_team_coach(team_id))
  );

create policy "team reads plays" on public.plays
  for select to authenticated using (team_id is not null and public.is_team_staff_or_player(team_id));

create policy "team reads play frames" on public.play_frames
  for select to authenticated using (exists (
    select 1 from public.plays p
    where p.id = play_id and p.team_id is not null and public.is_team_staff_or_player(p.team_id)));

create policy "team reads games" on public.games
  for select to authenticated using (public.is_team_staff_or_player(team_id));

create policy "team reads game events" on public.game_events
  for select to authenticated using (exists (
    select 1 from public.games g where g.id = game_id and public.is_team_staff_or_player(g.team_id)));

create policy "team reads substitutions" on public.substitutions
  for select to authenticated using (exists (
    select 1 from public.games g where g.id = game_id and public.is_team_staff_or_player(g.team_id)));
