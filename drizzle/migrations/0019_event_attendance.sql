-- Per-player attendance for practices and games (coach-entered).
CREATE TABLE public.event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.team_events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('early','on_time','late','out')),
  reason text CHECK (reason IN ('sick','hurt','no_call_no_show','other')),
  note text CHECK (note IS NULL OR char_length(note) <= 280),
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_attendance_event_player_key UNIQUE (event_id, player_id),
  CONSTRAINT event_attendance_reason_rule CHECK ((status IN ('late','out')) = (reason IS NOT NULL)),
  CONSTRAINT event_attendance_note_rule CHECK (note IS NULL OR reason = 'other')
);
CREATE INDEX event_attendance_team_idx ON public.event_attendance(team_id);
CREATE INDEX event_attendance_player_idx ON public.event_attendance(player_id);

-- Event-level marker: completed or intentionally skipped.
-- No marker + no rows = not started; rows without marker = partially entered.
CREATE TABLE public.event_attendance_sessions (
  event_id uuid PRIMARY KEY REFERENCES public.team_events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('completed','skipped')),
  completed_by uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_attendance_sessions_team_idx ON public.event_attendance_sessions(team_id);

-- Reads only; every write goes through the coach-checked functions below.
GRANT SELECT ON public.event_attendance TO authenticated;
GRANT ALL ON public.event_attendance TO service_role;
GRANT SELECT ON public.event_attendance_sessions TO authenticated;
GRANT ALL ON public.event_attendance_sessions TO service_role;

ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team coaches read attendance" ON public.event_attendance
  FOR SELECT TO authenticated USING (public.is_team_coach(team_id));
CREATE POLICY "Team coaches read attendance sessions" ON public.event_attendance_sessions
  FOR SELECT TO authenticated USING (public.is_team_coach(team_id));

-- Lets a server-side helper create a past game's calendar entry without
-- queuing a "game scheduled" notification for something already played.
CREATE OR REPLACE FUNCTION public.notify_team_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare is_game boolean := coalesce(new.event_type, new.kind) in ('game','scrimmage');
begin
  if coalesce(current_setting('coachside.suppress_event_notify', true), '') = 'on' then
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
$function$;

-- Save a full attendance sheet and mark the event complete, atomically.
CREATE OR REPLACE FUNCTION public.save_event_attendance(_event uuid, _rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ev record;
  r jsonb;
  n int := 0;
  _status text; _reason text; _note text; _player uuid;
begin
  select id, team_id, coalesce(event_type, kind) as t into ev from public.team_events where id = _event;
  if ev.id is null then raise exception 'Event not found'; end if;
  if not public.is_team_coach(ev.team_id) then raise exception 'Only team coaches can take attendance'; end if;
  if ev.t not in ('practice','game') then raise exception 'Attendance is for practices and games'; end if;
  if jsonb_typeof(_rows) <> 'array' or jsonb_array_length(_rows) = 0 then raise exception 'No players to save'; end if;

  for r in select * from jsonb_array_elements(_rows) loop
    _player := (r->>'player_id')::uuid;
    _status := r->>'status';
    _reason := nullif(r->>'reason', '');
    _note := nullif(btrim(coalesce(r->>'note', '')), '');
    if not exists (select 1 from public.players p where p.id = _player and p.team_id = ev.team_id) then
      raise exception 'Player is not on this team';
    end if;
    if _status not in ('late','out') then _reason := null; end if;
    if _status in ('late','out') and _reason is null then raise exception 'Late and Out need a reason'; end if;
    if _reason is distinct from 'other' then _note := null; end if;
    insert into public.event_attendance (event_id, team_id, player_id, status, reason, note, recorded_by)
    values (_event, ev.team_id, _player, _status, _reason, left(_note, 280), auth.uid())
    on conflict (event_id, player_id) do update
      set status = excluded.status, reason = excluded.reason, note = excluded.note,
          recorded_by = excluded.recorded_by, updated_at = now();
    n := n + 1;
  end loop;

  insert into public.event_attendance_sessions (event_id, team_id, status, completed_by)
  values (_event, ev.team_id, 'completed', auth.uid())
  on conflict (event_id) do update
    set status = 'completed', completed_by = excluded.completed_by, updated_at = now();

  return jsonb_build_object('saved', n);
end;
$function$;

-- Intentionally skip attendance for an event (keeps any rows already saved).
CREATE OR REPLACE FUNCTION public.skip_event_attendance(_event uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ev record;
begin
  select id, team_id into ev from public.team_events where id = _event;
  if ev.id is null then raise exception 'Event not found'; end if;
  if not public.is_team_coach(ev.team_id) then raise exception 'Only team coaches can manage attendance'; end if;
  insert into public.event_attendance_sessions (event_id, team_id, status, completed_by)
  values (_event, ev.team_id, 'skipped', auth.uid())
  on conflict (event_id) do update
    set status = 'skipped', completed_by = excluded.completed_by, updated_at = now()
    where public.event_attendance_sessions.status <> 'completed';
end;
$function$;

-- One calendar entry per game, so attendance for games started without a
-- scheduled event still lives on team_events and is never duplicated.
CREATE OR REPLACE FUNCTION public.ensure_game_attendance_event(_game uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g record; existing uuid; new_id uuid;
begin
  select id, team_id, opponent, game_date, created_at, ended_at, home_away into g from public.games where id = _game;
  if g.id is null then raise exception 'Game not found'; end if;
  if not public.is_team_coach(g.team_id) then raise exception 'Only team coaches can take attendance'; end if;
  perform pg_advisory_xact_lock(hashtext('attendance-game:' || _game::text));
  select id into existing from public.team_events where game_id = _game order by created_at limit 1;
  if existing is not null then return existing; end if;
  perform set_config('coachside.suppress_event_notify', 'on', true);
  insert into public.team_events (team_id, kind, event_type, title, starts_at, ends_at, opponent, home_away, game_id, created_by, source, visibility)
  values (
    g.team_id, 'game', 'game',
    case when coalesce(g.opponent, '') = '' then 'Game' else 'vs ' || g.opponent end,
    case when g.created_at::date = g.game_date then g.created_at else (g.game_date + time '18:00') at time zone 'UTC' end,
    g.ended_at, g.opponent, g.home_away, _game, auth.uid(), 'coachside', 'team'
  ) returning id into new_id;
  perform set_config('coachside.suppress_event_notify', 'off', true);
  return new_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.save_event_attendance(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.skip_event_attendance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_game_attendance_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_event_attendance(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_event_attendance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_game_attendance_event(uuid) TO authenticated;