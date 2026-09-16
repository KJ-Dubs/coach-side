DROP POLICY IF EXISTS "owner updates own google calendar connection" ON public.google_calendar_connections;
CREATE POLICY "owner updates own google calendar connection"
ON public.google_calendar_connections
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND team_id IS NOT NULL
  AND public.is_team_coach(team_id)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND team_id IS NOT NULL
  AND public.is_team_coach(team_id)
);