DROP POLICY IF EXISTS "team logos member read" ON storage.objects;
CREATE POLICY "team logos member read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (
    is_team_coach(((storage.foldername(name))[1])::uuid)
    OR is_team_member(((storage.foldername(name))[1])::uuid)
  )
);