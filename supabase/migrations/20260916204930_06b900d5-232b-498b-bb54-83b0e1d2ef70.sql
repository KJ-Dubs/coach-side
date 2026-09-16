DROP POLICY IF EXISTS "coach removes team members" ON public.team_members;

CREATE POLICY "team member removal is scoped"
ON public.team_members
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    -- you can always remove your own membership
    user_id = auth.uid()
    -- any coach may remove player/parent entries
    OR (is_team_coach(team_id) AND role IN ('player','parent'))
    -- only head coaches may remove other coaches
    OR (is_team_head_coach(team_id) AND user_id <> auth.uid())
  )
);