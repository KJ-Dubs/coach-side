-- 1. Google Calendar connections: secrets stay server-only
REVOKE ALL ON public.google_calendar_connections FROM authenticated, anon;
GRANT DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;

-- 2. org_members: read-only for clients, writes only via server / invite RPC
REVOKE ALL ON public.org_members FROM authenticated, anon;
GRANT SELECT ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;

-- 3. team_members: single, explicit update rule
DROP POLICY IF EXISTS "coach updates team members" ON public.team_members;
DROP POLICY IF EXISTS "coach changes member role" ON public.team_members;

CREATE POLICY "team member updates are scoped"
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (is_team_coach(team_id) OR user_id = auth.uid())
)
WITH CHECK (
  auth.uid() IS NOT NULL
  -- identity and team can never be re-pointed
  AND user_id = public.team_member_stored_user(id)
  AND team_id = public.team_member_stored_team(id)
  AND (
    -- self service: any field except your own role
    (user_id = auth.uid() AND role = public.team_member_stored_role(id))
    OR
    -- coaches manage other people's rows only
    (
      public.team_member_stored_user(id) <> auth.uid()
      AND is_team_coach(team_id)
      AND (
        -- any coach may manage player/parent rows, staying within player/parent
        (
          role IN ('player','parent')
          AND public.team_member_stored_role(id) IN ('player','parent')
        )
        -- only head coaches may grant or revoke coaching roles
        OR is_team_head_coach(team_id)
      )
    )
  )
);

REVOKE TRUNCATE, TRIGGER, MAINTAIN ON public.team_members FROM authenticated;