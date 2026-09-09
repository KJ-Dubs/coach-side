DROP POLICY IF EXISTS "team logos member read" ON storage.objects;
CREATE POLICY "team logos member read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'team-logos'
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = ((storage.foldername(name))[1])::uuid
      AND (public.is_team_coach(t.id) OR public.is_team_member(t.id))
  )
);

CREATE POLICY "invited coach accepts own invite" ON public.coach_invites
FOR UPDATE TO authenticated
USING (
  accepted_at IS NULL
  AND expires_at > now()
  AND lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
)
WITH CHECK (
  accepted_by = auth.uid()
  AND lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

CREATE POLICY "own notifications delete" ON public.notifications
FOR DELETE TO authenticated
USING (user_id = auth.uid());