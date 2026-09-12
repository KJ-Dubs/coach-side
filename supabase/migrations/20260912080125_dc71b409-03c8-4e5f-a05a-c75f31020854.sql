-- 1) google_calendar_connections: explicit owner/coach-scoped read policy (writes stay service-role only)
grant select on public.google_calendar_connections to authenticated;
create policy "owner reads own google calendar connections"
on public.google_calendar_connections for select to authenticated
using (user_id = auth.uid() or public.is_team_coach(team_id));

-- 2) team_members: prevent self role escalation on update
drop policy "coach updates team members" on public.team_members;
create policy "coach updates team members"
on public.team_members for update to authenticated
using (public.is_team_coach(team_id))
with check (
  public.is_team_coach(team_id)
  and (
    user_id <> auth.uid()
    or role = (select m.role from public.team_members m where m.id = team_members.id)
  )
);