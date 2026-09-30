ALTER TABLE public.team_playbook_folders ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'team';
ALTER TABLE public.team_playbook_folders DROP CONSTRAINT IF EXISTS team_playbook_folders_visibility_check;
ALTER TABLE public.team_playbook_folders ADD CONSTRAINT team_playbook_folders_visibility_check CHECK (visibility IN ('team','coaches_only'));

DROP POLICY IF EXISTS "Team members read playbook folders" ON public.team_playbook_folders;
CREATE POLICY "Team members read playbook folders" ON public.team_playbook_folders
FOR SELECT TO authenticated
USING (public.is_team_coach(team_id) OR (visibility = 'team' AND public.team_visible(team_id)));

DROP POLICY IF EXISTS "Team members read play folder memberships" ON public.play_folder_memberships;
CREATE POLICY "Team members read play folder memberships" ON public.play_folder_memberships
FOR SELECT TO authenticated
USING (public.is_team_coach(team_id) OR (public.is_team_staff_or_player(team_id) AND EXISTS (
  SELECT 1 FROM public.team_playbook_folders f WHERE f.id = play_folder_memberships.folder_id AND f.visibility = 'team')));

DROP POLICY IF EXISTS "Team coaches create play folder memberships" ON public.play_folder_memberships;
CREATE POLICY "Team coaches create play folder memberships" ON public.play_folder_memberships
FOR INSERT TO authenticated
WITH CHECK (public.is_team_coach(team_id) AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.team_playbook_folders f WHERE f.id = play_folder_memberships.folder_id AND f.team_id = play_folder_memberships.team_id)
  AND EXISTS (SELECT 1 FROM public.play_team_assignments a WHERE a.play_id = play_folder_memberships.play_id AND a.team_id = play_folder_memberships.team_id AND a.is_visible));

DROP POLICY IF EXISTS "Team coaches update play folder memberships" ON public.play_folder_memberships;
CREATE POLICY "Team coaches update play folder memberships" ON public.play_folder_memberships
FOR UPDATE TO authenticated
USING (public.is_team_coach(team_id))
WITH CHECK (public.is_team_coach(team_id)
  AND EXISTS (SELECT 1 FROM public.team_playbook_folders f WHERE f.id = play_folder_memberships.folder_id AND f.team_id = play_folder_memberships.team_id)
  AND EXISTS (SELECT 1 FROM public.play_team_assignments a WHERE a.play_id = play_folder_memberships.play_id AND a.team_id = play_folder_memberships.team_id AND a.is_visible));