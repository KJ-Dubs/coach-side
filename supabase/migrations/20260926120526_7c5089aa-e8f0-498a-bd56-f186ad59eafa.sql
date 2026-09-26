DROP TRIGGER IF EXISTS notify_new_assignment ON public.assignments;

DROP POLICY IF EXISTS "members create own assignment status" ON public.assignment_targets;
CREATE POLICY "members create own assignment status"
ON public.assignment_targets
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.team_members tm ON tm.team_id = a.team_id
    WHERE a.id = assignment_targets.assignment_id
      AND tm.user_id = auth.uid()
      AND tm.active = true
  )
);

ALTER TABLE public.assignment_attachments
DROP CONSTRAINT IF EXISTS assignment_attachments_attachment_type_check;
ALTER TABLE public.assignment_attachments
ADD CONSTRAINT assignment_attachments_attachment_type_check
CHECK (attachment_type IN (
  'play','playbook_folder','drill','practice_plan','event','game','plan','resource','url',
  'stat','full_game_video','video_clip','drill_video','coach_video','game_timestamp_clip'
));