
-- 1) calendar_connections: owner-only, restricted to signed-in users
DROP POLICY IF EXISTS "own calendar connection" ON public.calendar_connections;
CREATE POLICY "own calendar connection"
ON public.calendar_connections
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2) google_calendar_connections: owner AND coach of the referenced team
DROP POLICY IF EXISTS "owner reads own google calendar connections" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "owner inserts own google calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "owner updates own google calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "owner deletes own google calendar connection" ON public.google_calendar_connections;

CREATE POLICY "owner reads own google calendar connections"
ON public.google_calendar_connections
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "owner inserts own google calendar connection"
ON public.google_calendar_connections
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_team_coach(team_id));

CREATE POLICY "owner updates own google calendar connection"
ON public.google_calendar_connections
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.is_team_coach(team_id))
WITH CHECK (user_id = auth.uid() AND public.is_team_coach(team_id));

CREATE POLICY "owner deletes own google calendar connection"
ON public.google_calendar_connections
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 3) team_members: block self role escalation with an explicit stored-role lookup
CREATE OR REPLACE FUNCTION public.team_member_stored_role(_id uuid)
RETURNS team_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.team_members WHERE id = _id
$$;

REVOKE ALL ON FUNCTION public.team_member_stored_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_member_stored_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "coach updates team members" ON public.team_members;
CREATE POLICY "coach updates team members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (is_team_coach(team_id) OR user_id = auth.uid())
WITH CHECK (
  -- never allow anyone to change their own role row's role
  role = public.team_member_stored_role(id)
  AND (
    user_id = auth.uid()
    OR ((role = ANY (ARRAY['player'::team_role, 'parent'::team_role])) AND is_team_coach(team_id))
    OR ((role = ANY (ARRAY['head_coach'::team_role, 'assistant_coach'::team_role])) AND is_team_head_coach(team_id))
  )
);

-- coaches may still change other members' roles through a dedicated policy
CREATE POLICY "coach changes member role"
ON public.team_members
FOR UPDATE
TO authenticated
USING (is_team_coach(team_id) AND user_id <> auth.uid())
WITH CHECK (
  user_id <> auth.uid()
  AND (
    ((role = ANY (ARRAY['player'::team_role, 'parent'::team_role])) AND is_team_coach(team_id))
    OR ((role = ANY (ARRAY['head_coach'::team_role, 'assistant_coach'::team_role])) AND is_team_head_coach(team_id))
  )
);
