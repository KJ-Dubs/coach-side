-- Season lifecycle + quiet training teams + attendance reminder preference.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS season_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS previous_season_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_training_team boolean NOT NULL DEFAULT false;

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_season_status_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_season_status_check CHECK (season_status IN ('active','archived'));
CREATE INDEX IF NOT EXISTS teams_previous_season_idx ON public.teams(previous_season_team_id);

COMMENT ON COLUMN public.teams.is_training_team IS 'Training/test team: fully editable, but automatic schedule reminders and attendance-due prompts stay quiet.';
COMMENT ON COLUMN public.teams.previous_season_team_id IS 'Archived season this team-season continues from. Set only by end_team_season.';

-- Onboarding sample (practice) teams are quiet by default.
UPDATE public.teams SET is_training_team = true WHERE is_practice AND NOT is_training_team;

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS attendance_reminders boolean NOT NULL DEFAULT true;

-- Lifecycle columns change only through the season RPCs below.
CREATE OR REPLACE FUNCTION public.guard_team_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _rpc boolean := coalesce(current_setting('coachside.season_change', true), '') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT _rpc THEN
      NEW.season_status := 'active';
      NEW.archived_at := NULL;
      NEW.archived_by := NULL;
      NEW.previous_season_team_id := NULL;
      NEW.is_training_team := coalesce(NEW.is_practice, false);
    END IF;
    RETURN NEW;
  END IF;
  IF NOT _rpc THEN
    IF NEW.season_status IS DISTINCT FROM OLD.season_status
       OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
       OR NEW.archived_by IS DISTINCT FROM OLD.archived_by
       OR NEW.previous_season_team_id IS DISTINCT FROM OLD.previous_season_team_id THEN
      RAISE EXCEPTION 'Use End Season or Reactivate Season to change a season.';
    END IF;
    IF NEW.is_practice AND NOT coalesce(OLD.is_practice, false) THEN
      NEW.is_training_team := true;
    ELSIF NEW.is_training_team IS DISTINCT FROM OLD.is_training_team THEN
      RAISE EXCEPTION 'Use the Training / Test Team switch to change this.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_team_lifecycle ON public.teams;
CREATE TRIGGER guard_team_lifecycle BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_lifecycle();

-- Archived seasons are read-only for normal season data.
CREATE OR REPLACE FUNCTION public.guard_archived_team_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(current_setting('coachside.season_change', true), '') = 'on' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.teams t WHERE t.id = NEW.team_id AND t.season_status = 'archived') THEN
    RAISE EXCEPTION 'This season is archived. Reactivate it from Locker Room → Season to make changes.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_archived_team_write ON public.team_events;
CREATE TRIGGER guard_archived_team_write BEFORE INSERT OR UPDATE ON public.team_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_team_write();
DROP TRIGGER IF EXISTS guard_archived_team_write ON public.games;
CREATE TRIGGER guard_archived_team_write BEFORE INSERT ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_team_write();
DROP TRIGGER IF EXISTS guard_archived_team_write ON public.players;
CREATE TRIGGER guard_archived_team_write BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_team_write();
DROP TRIGGER IF EXISTS guard_archived_team_write ON public.event_attendance;
CREATE TRIGGER guard_archived_team_write BEFORE INSERT OR UPDATE ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_team_write();
DROP TRIGGER IF EXISTS guard_archived_team_write ON public.event_attendance_sessions;
CREATE TRIGGER guard_archived_team_write BEFORE INSERT OR UPDATE ON public.event_attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_team_write();

-- Automatic schedule alerts stay quiet for archived and training teams.
CREATE OR REPLACE FUNCTION public.notify_team_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare is_game boolean := coalesce(new.event_type, new.kind) in ('game','scrimmage');
begin
  if coalesce(current_setting('coachside.suppress_event_notify', true), '') = 'on' then
    return new;
  end if;
  if exists (select 1 from public.teams t where t.id = new.team_id and (t.season_status = 'archived' or t.is_training_team)) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform public.queue_team_notification(new.team_id,
      case when is_game then 'game_scheduled' else 'practice_scheduled' end,
      new.title, to_char(new.starts_at, 'Dy Mon DD HH24:MI'), 'team_event', new.id,
      case when is_game then 'game_reminders' else 'practice_reminders' end);
  elsif tg_op = 'UPDATE' and new.starts_at is distinct from old.starts_at then
    perform public.queue_team_notification(new.team_id,
      case when is_game then 'game_changed' else 'practice_changed' end,
      new.title || ' time changed', to_char(new.starts_at, 'Dy Mon DD HH24:MI'), 'team_event', new.id,
      case when is_game then 'game_reminders' else 'practice_reminders' end);
  end if;
  return new;
end;
$$;

-- Resolving attendance clears every coach's "Attendance due" alert for that event.
CREATE OR REPLACE FUNCTION public.resolve_attendance_due_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.notifications
     SET read_at = now()
   WHERE dedupe_key = 'attendance-due:' || NEW.event_id::text
     AND read_at IS NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS resolve_attendance_due_notifications ON public.event_attendance_sessions;
CREATE TRIGGER resolve_attendance_due_notifications AFTER INSERT OR UPDATE ON public.event_attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.resolve_attendance_due_notifications();

CREATE INDEX IF NOT EXISTS notifications_dedupe_key_idx ON public.notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;

-- A new season keeps the membership/grants/trial of the season it continues from.
CREATE OR REPLACE FUNCTION public.team_modules(_team uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH RECURSIVE lineage(id, depth) AS (
    SELECT _team, 0
    UNION ALL
    SELECT t.previous_season_team_id, l.depth + 1
      FROM lineage l JOIN public.teams t ON t.id = l.id
     WHERE t.previous_season_team_id IS NOT NULL AND l.depth < 10
  )
  SELECT COALESCE(
    (SELECT array_agg(DISTINCT m) FROM (
      SELECT unnest(b.modules) AS m FROM public.team_billing b JOIN lineage l ON l.id = b.team_id
      WHERE b.status IN ('active','grace','past_due','complimentary')
      UNION
      SELECT unnest(g.modules) FROM public.complimentary_grants g JOIN lineage l ON l.id = g.team_id
      WHERE g.active AND (g.expires_at IS NULL OR g.expires_at > now())
      UNION
      SELECT unnest(ARRAY['playbook_plus','gameday_plus','team_hub_plus']) FROM public.team_trials tt JOIN lineage l ON l.id = tt.team_id
      WHERE tt.ends_at > now()
    ) s), '{}'::text[]);
$$;

-- Training / Test Team switch (any coach of the team).
CREATE OR REPLACE FUNCTION public.set_team_training(_team uuid, _on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_team_coach(_team) THEN RAISE EXCEPTION 'Only this team''s coaches can change this.'; END IF;
  PERFORM set_config('coachside.season_change', 'on', true);
  UPDATE public.teams SET is_training_team = coalesce(_on, false) WHERE id = _team;
  PERFORM set_config('coachside.season_change', '', true);
END $$;

-- Reactivate an archived season (head coach).
CREATE OR REPLACE FUNCTION public.reactivate_team_season(_team uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_team_head_coach(_team) THEN RAISE EXCEPTION 'Only the head coach can reactivate a season.'; END IF;
  PERFORM set_config('coachside.season_change', 'on', true);
  UPDATE public.teams SET season_status = 'active', archived_at = NULL, archived_by = NULL WHERE id = _team;
  PERFORM set_config('coachside.season_change', '', true);
END $$;

-- End a season: archive it (nothing is deleted) and optionally start the next one,
-- carrying forward only what the coach picked.
CREATE OR REPLACE FUNCTION public.end_team_season(
  _team uuid,
  _start_next boolean,
  _next_name text,
  _next_season text,
  _carry jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  old public.teams%ROWTYPE;
  _uid uuid := auth.uid();
  _new uuid;
  _branding boolean := coalesce((_carry->>'branding')::boolean, true);
  _coaches boolean := coalesce((_carry->>'coaches')::boolean, true);
  _playbook boolean := coalesce((_carry->>'playbook')::boolean, true);
  _folders boolean := coalesce((_carry->>'folders')::boolean, true);
  _plans boolean := coalesce((_carry->>'plans')::boolean, false);
  _player_ids uuid[] := ARRAY(SELECT jsonb_array_elements_text(coalesce(_carry->'player_ids', '[]'::jsonb))::uuid);
  f record; p record; pl record;
  _map jsonb := '{}'::jsonb;
  _pmap jsonb := '{}'::jsonb;
  _nf uuid; _np uuid; _nplan uuid;
  _players int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT * INTO old FROM public.teams WHERE id = _team;
  IF old.id IS NULL THEN RAISE EXCEPTION 'Team not found.'; END IF;
  IF NOT public.is_team_head_coach(_team) THEN RAISE EXCEPTION 'Only the head coach can end a season.'; END IF;
  IF old.season_status = 'archived' THEN RAISE EXCEPTION 'This season is already archived.'; END IF;
  IF _start_next AND coalesce(btrim(_next_season), '') = '' THEN RAISE EXCEPTION 'Name the next season.'; END IF;

  PERFORM set_config('coachside.season_change', 'on', true);
  PERFORM set_config('coachside.suppress_event_notify', 'on', true);

  UPDATE public.teams SET season_status = 'archived', archived_at = now(), archived_by = _uid WHERE id = _team;

  IF _start_next THEN
    INSERT INTO public.teams (
      name, season, org_id, level, timezone, home_gym, default_practice_location,
      default_arrival_offset_minutes, default_practice_reminder_minutes, default_game_reminder_minutes,
      default_periods, default_period_minutes, default_overtime_minutes, default_game_config,
      allow_player_posting, require_ack_default, head_coach_name, assistant_coaches,
      logo_url, primary_color, secondary_color, previous_season_team_id, season_status, is_training_team, is_practice
    ) VALUES (
      coalesce(nullif(btrim(_next_name), ''), old.name), btrim(_next_season), old.org_id, old.level, old.timezone,
      old.home_gym, old.default_practice_location, old.default_arrival_offset_minutes,
      old.default_practice_reminder_minutes, old.default_game_reminder_minutes,
      old.default_periods, old.default_period_minutes, old.default_overtime_minutes, old.default_game_config,
      old.allow_player_posting, old.require_ack_default, old.head_coach_name,
      CASE WHEN _coaches THEN old.assistant_coaches ELSE NULL END,
      CASE WHEN _branding THEN old.logo_url ELSE NULL END,
      CASE WHEN _branding THEN old.primary_color ELSE NULL END,
      CASE WHEN _branding THEN old.secondary_color ELSE NULL END,
      _team, 'active', false, false
    ) RETURNING id INTO _new;

    -- The coach ending the season keeps head-coach access when it came from team membership.
    INSERT INTO public.team_members (team_id, user_id, role, active)
    SELECT _new, m.user_id, m.role, true FROM public.team_members m
     WHERE m.team_id = _team AND m.user_id = _uid AND m.active AND m.role IN ('head_coach','assistant_coach')
     LIMIT 1;

    IF _coaches THEN
      INSERT INTO public.team_members (team_id, user_id, role, active)
      SELECT DISTINCT ON (m.user_id) _new, m.user_id, m.role, true FROM public.team_members m
       WHERE m.team_id = _team AND m.active AND m.role IN ('head_coach','assistant_coach') AND m.user_id <> _uid
       ORDER BY m.user_id, (m.role = 'head_coach') DESC;
    END IF;

    -- Selected players only, plus their linked player/parent accounts.
    FOR p IN SELECT * FROM public.players WHERE team_id = _team AND id = ANY(_player_ids) ORDER BY created_at LOOP
      INSERT INTO public.players (team_id, jersey, name, position, active)
      VALUES (_new, p.jersey, p.name, p.position, true) RETURNING id INTO _np;
      _pmap := _pmap || jsonb_build_object(p.id::text, _np);
      _players := _players + 1;
      INSERT INTO public.team_members (team_id, user_id, role, player_id, active)
      SELECT _new, m.user_id, m.role, _np, true FROM public.team_members m
       WHERE m.team_id = _team AND m.player_id = p.id AND m.active AND m.role IN ('player','parent')
         AND NOT EXISTS (SELECT 1 FROM public.team_members x WHERE x.team_id = _new AND x.user_id = m.user_id);
    END LOOP;

    IF _folders THEN
      FOR f IN SELECT * FROM public.team_playbook_folders WHERE team_id = _team ORDER BY sort_order, created_at LOOP
        INSERT INTO public.team_playbook_folders (team_id, name, description, created_by, sort_order, visibility)
        VALUES (_new, f.name, f.description, _uid, f.sort_order, f.visibility) RETURNING id INTO _nf;
        _map := _map || jsonb_build_object(f.id::text, _nf);
      END LOOP;
    END IF;

    IF _playbook THEN
      -- Same canonical plays, new team assignments. Plays are never copied or re-owned.
      INSERT INTO public.play_team_assignments (play_id, team_id, assigned_by, is_visible, category_override, notes, library_version, folder_id)
      SELECT a.play_id, _new, _uid, a.is_visible, a.category_override, a.notes, a.library_version,
             CASE WHEN a.folder_id IS NOT NULL AND _map ? a.folder_id::text THEN (_map->>a.folder_id::text)::uuid ELSE NULL END
        FROM public.play_team_assignments a WHERE a.team_id = _team;
      INSERT INTO public.play_team_assignments (play_id, team_id, assigned_by, is_visible)
      SELECT pl2.id, _new, _uid, true FROM public.plays pl2
       WHERE pl2.team_id = _team
         AND NOT EXISTS (SELECT 1 FROM public.play_team_assignments x WHERE x.team_id = _new AND x.play_id = pl2.id);
      IF _folders THEN
        INSERT INTO public.play_folder_memberships (folder_id, play_id, team_id, created_by)
        SELECT (_map->>fm.folder_id::text)::uuid, fm.play_id, _new, _uid
          FROM public.play_folder_memberships fm
         WHERE fm.team_id = _team AND _map ? fm.folder_id::text
           AND EXISTS (SELECT 1 FROM public.play_team_assignments x WHERE x.team_id = _new AND x.play_id = fm.play_id);
      END IF;
    END IF;

    IF _plans THEN
      INSERT INTO public.drill_team_assignments (drill_id, team_id, assigned_by)
      SELECT d.drill_id, _new, _uid FROM public.drill_team_assignments d WHERE d.team_id = _team;
      FOR pl IN SELECT * FROM public.practice_plans WHERE team_id = _team ORDER BY plan_date, created_at LOOP
        INSERT INTO public.practice_plans (team_id, created_by, title, plan_date, start_time, total_minutes, shared_to_locker, notes)
        VALUES (_new, _uid, pl.title, pl.plan_date, pl.start_time, pl.total_minutes, false, pl.notes) RETURNING id INTO _nplan;
        INSERT INTO public.practice_plan_blocks (plan_id, idx, block_type, ref_id, title, minutes, notes, completed)
        SELECT _nplan, b.idx, b.block_type, b.ref_id, b.title, b.minutes, b.notes, false
          FROM public.practice_plan_blocks b WHERE b.plan_id = pl.id;
      END LOOP;
    END IF;
  END IF;

  PERFORM set_config('coachside.season_change', '', true);
  PERFORM set_config('coachside.suppress_event_notify', '', true);
  RETURN jsonb_build_object('archived_team_id', _team, 'new_team_id', _new, 'players', _players);
END $$;

REVOKE ALL ON FUNCTION public.end_team_season(uuid, boolean, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_team_season(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_team_training(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_team_season(uuid, boolean, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_team_season(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_team_training(uuid, boolean) TO authenticated;