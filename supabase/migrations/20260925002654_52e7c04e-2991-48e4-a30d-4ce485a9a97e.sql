CREATE OR REPLACE FUNCTION public.guard_team_playbook_folder_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    RAISE EXCEPTION 'Playbook folder team cannot be changed';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Playbook folder creator cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_team_playbook_folder_identity
BEFORE UPDATE OF team_id, created_by ON public.team_playbook_folders
FOR EACH ROW EXECUTE FUNCTION public.guard_team_playbook_folder_identity();