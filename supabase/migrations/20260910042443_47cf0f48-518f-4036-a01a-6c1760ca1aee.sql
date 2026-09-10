-- 1) coach_invites: acceptance must go through the token-validated accept_invite RPC.
DROP POLICY IF EXISTS "invited coach accepts own invite" ON public.coach_invites;

-- 2) google_calendar_connections: no direct client access to token material.
--    All reads/writes happen through server functions using the service role.
DROP POLICY IF EXISTS "owner manages own google calendar connection" ON public.google_calendar_connections;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections FROM anon;

-- 3) team_members: prevent self-promotion to a coach role.
DROP POLICY IF EXISTS "coach manages team members" ON public.team_members;
CREATE POLICY "coach manages team members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  is_team_coach(team_id)
  AND role IN ('player'::public.team_role, 'parent'::public.team_role)
  OR (
    is_team_head_coach(team_id)
    AND role IN ('head_coach'::public.team_role, 'assistant_coach'::public.team_role)
    AND user_id <> auth.uid()
  )
);