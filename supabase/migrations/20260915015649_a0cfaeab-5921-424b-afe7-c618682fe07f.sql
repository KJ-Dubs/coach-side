
-- 1. coach_invites: only head coaches of the org may read invite rows (they contain tokens)
DROP POLICY IF EXISTS "head coach reads invites" ON public.coach_invites;
CREATE POLICY "head coach reads invites"
ON public.coach_invites FOR SELECT TO authenticated
USING (org_id = my_org_id() AND is_head_coach());

-- 2. team_members: self-updates may not move the row to another team or user
CREATE OR REPLACE FUNCTION public.team_member_stored_team(_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.team_members WHERE id = _id
$$;

REVOKE ALL ON FUNCTION public.team_member_stored_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_member_stored_team(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.team_member_stored_user(_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.team_members WHERE id = _id
$$;

REVOKE ALL ON FUNCTION public.team_member_stored_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_member_stored_user(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "coach updates team members" ON public.team_members;
CREATE POLICY "coach updates team members"
ON public.team_members FOR UPDATE TO authenticated
USING (is_team_coach(team_id) OR user_id = auth.uid())
WITH CHECK (
  role = team_member_stored_role(id)
  AND (
    (
      user_id = auth.uid()
      AND user_id = team_member_stored_user(id)
      AND team_id = team_member_stored_team(id)
    )
    OR (role IN ('player','parent') AND is_team_coach(team_id) AND is_team_coach(team_member_stored_team(id)))
    OR (role IN ('head_coach','assistant_coach') AND is_team_head_coach(team_id) AND is_team_head_coach(team_member_stored_team(id)))
  )
);

-- 3. google_calendar_connections: keep owner-only, explicit non-null auth on every command
DROP POLICY IF EXISTS "owner deletes own google calendar connection" ON public.google_calendar_connections;
CREATE POLICY "owner deletes own google calendar connection"
ON public.google_calendar_connections FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

REVOKE ALL ON TABLE public.google_calendar_connections FROM anon;
REVOKE ALL ON TABLE public.coach_invites FROM anon;
