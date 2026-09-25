CREATE TABLE public.team_playbook_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_playbook_folders_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT team_playbook_folders_team_name_unique UNIQUE (team_id, name),
  CONSTRAINT team_playbook_folders_id_team_unique UNIQUE (id, team_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_playbook_folders TO authenticated;
GRANT ALL ON public.team_playbook_folders TO service_role;

ALTER TABLE public.team_playbook_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members read playbook folders"
ON public.team_playbook_folders
FOR SELECT TO authenticated
USING (public.team_visible(team_id));

CREATE POLICY "Team coaches create playbook folders"
ON public.team_playbook_folders
FOR INSERT TO authenticated
WITH CHECK (public.is_team_coach(team_id) AND created_by = auth.uid());

CREATE POLICY "Team coaches update playbook folders"
ON public.team_playbook_folders
FOR UPDATE TO authenticated
USING (public.is_team_coach(team_id))
WITH CHECK (public.is_team_coach(team_id));

CREATE POLICY "Team coaches delete playbook folders"
ON public.team_playbook_folders
FOR DELETE TO authenticated
USING (public.is_team_coach(team_id));

CREATE TRIGGER update_team_playbook_folders_updated_at
BEFORE UPDATE ON public.team_playbook_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.play_team_assignments
  ADD COLUMN folder_id uuid REFERENCES public.team_playbook_folders(id) ON DELETE SET NULL;

CREATE INDEX play_team_assignments_folder_idx
ON public.play_team_assignments(folder_id)
WHERE folder_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_play_assignment_folder_team()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.team_playbook_folders f
    WHERE f.id = NEW.folder_id AND f.team_id = NEW.team_id
  ) THEN
    RAISE EXCEPTION 'Playbook folder must belong to the assignment team';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_play_assignment_folder_team
BEFORE INSERT OR UPDATE OF folder_id, team_id ON public.play_team_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_play_assignment_folder_team();