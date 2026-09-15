
-- 1) google_calendar_connections: require team coach on delete as well
DROP POLICY IF EXISTS "owner deletes own google calendar connection" ON public.google_calendar_connections;
CREATE POLICY "owner deletes own google calendar connection"
ON public.google_calendar_connections
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid() AND public.is_team_coach(team_id));

-- 2) org_members: client-side writes are never allowed (invite flow uses security definer functions)
REVOKE INSERT, UPDATE, DELETE ON public.org_members FROM authenticated;
REVOKE ALL ON public.org_members FROM anon;
GRANT SELECT ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;

-- 3) team_members: role changes cannot re-point a row to another user or team
DROP POLICY IF EXISTS "coach changes member role" ON public.team_members;
CREATE POLICY "coach changes member role"
ON public.team_members
FOR UPDATE TO authenticated
USING (public.is_team_coach(team_id) AND user_id <> auth.uid())
WITH CHECK (
  user_id <> auth.uid()
  AND user_id = public.team_member_stored_user(id)
  AND team_id = public.team_member_stored_team(id)
  AND public.team_member_stored_user(id) <> auth.uid()
  AND (
    (role = ANY (ARRAY['player'::team_role, 'parent'::team_role]) AND public.is_team_coach(team_id))
    OR (role = ANY (ARRAY['head_coach'::team_role, 'assistant_coach'::team_role]) AND public.is_team_head_coach(team_id))
  )
);
