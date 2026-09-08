-- 1. notification preferences -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_enabled boolean NOT NULL DEFAULT true,
  practice_reminders boolean NOT NULL DEFAULT true,
  game_reminders boolean NOT NULL DEFAULT true,
  new_play_notifications boolean NOT NULL DEFAULT true,
  challenge_notifications boolean NOT NULL DEFAULT true,
  announcement_notifications boolean NOT NULL DEFAULT true,
  assignment_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notification preferences" ON public.notification_preferences;
CREATE POLICY "own notification preferences" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE
  ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. notification queue ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  related_type text,
  related_id uuid,
  channel text NOT NULL DEFAULT 'in_app',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_pending_idx ON public.notifications (status, scheduled_for);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notifications read" ON public.notifications;
CREATE POLICY "own notifications read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE
  ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- backfill preferences for existing users
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 3. signup: players join an existing program ----------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare new_org uuid;
        is_player boolean := coalesce(new.raw_user_meta_data->>'signup_type', '') = 'player';
begin
  if is_player then
    insert into public.profiles (id, email, full_name, org_id)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', null)
    on conflict (id) do nothing;
  else
    insert into public.organizations (name)
    values (coalesce(nullif(new.raw_user_meta_data->>'org_name',''), 'My Program'))
    returning id into new_org;
    insert into public.profiles (id, email, full_name, org_id)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', new_org);
    insert into public.org_members (org_id, user_id, role)
    values (new_org, new.id, 'head_coach')
    on conflict (org_id, user_id) do nothing;
  end if;
  insert into public.notification_preferences (user_id)
  values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$function$;

-- 4. invite lookup also returns the public parent link --------------------------
DROP FUNCTION IF EXISTS public.get_team_invite(text);
CREATE FUNCTION public.get_team_invite(_token text)
RETURNS TABLE(team_id uuid, team_name text, season text, invite_type text, status text, locker_token text, locker_enabled boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select t.id, t.name, t.season, i.invite_type,
         case when not i.active then 'revoked'
              when i.expires_at is not null and i.expires_at < now() then 'expired'
              else 'active' end,
         t.locker_token, t.locker_enabled
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  where i.token = _token
  limit 1
$function$;
REVOKE ALL ON FUNCTION public.get_team_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_team_invite(text) TO authenticated, anon;

-- 5. player invite acceptance keeps them out of coach org roles -----------------
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text, _player_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare inv public.team_invites%rowtype;
        uid uuid := auth.uid();
        new_role public.team_role;
        team_org uuid;
begin
  if uid is null then raise exception 'Sign in to join this team'; end if;
  select * into inv from public.team_invites where token = _token;
  if not found then raise exception 'This invite link is not valid'; end if;
  if not inv.active then raise exception 'This invite link has been turned off'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'This invite link has expired'; end if;

  new_role := case when inv.invite_type = 'parent' then 'parent'::public.team_role else 'player'::public.team_role end;

  if new_role = 'player' and _player_id is not null then
    if not exists (select 1 from public.players p where p.id = _player_id and p.team_id = inv.team_id) then
      raise exception 'That player is not on this team';
    end if;
    if exists (select 1 from public.team_members m where m.player_id = _player_id and m.active and m.user_id <> uid) then
      raise exception 'That player has already been claimed';
    end if;
  end if;

  insert into public.team_members (team_id, user_id, role, player_id, active)
  values (inv.team_id, uid, new_role, case when new_role = 'player' then _player_id else null end, true)
  on conflict (team_id, user_id) do update
    set role = excluded.role,
        player_id = coalesce(excluded.player_id, public.team_members.player_id),
        active = true,
        updated_at = now();

  -- link the profile to the coach's existing program, never create a new one
  select org_id into team_org from public.teams where id = inv.team_id;
  if team_org is not null then
    update public.profiles set org_id = team_org where id = uid and org_id is null;
  end if;

  return jsonb_build_object('team_id', inv.team_id, 'role', new_role::text);
end;
$function$;

-- 6. single source of truth for what the signed-in user may do ------------------
CREATE OR REPLACE FUNCTION public.my_access()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'org_memberships', coalesce((
      select jsonb_agg(jsonb_build_object('org_id', om.org_id, 'role', om.role))
      from public.org_members om where om.user_id = auth.uid()), '[]'::jsonb),
    'team_memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', m.team_id, 'role', m.role, 'player_id', m.player_id))
      from public.team_members m where m.user_id = auth.uid() and m.active), '[]'::jsonb),
    'coach_team_ids', coalesce((
      select jsonb_agg(distinct x.team_id) from (
        select m.team_id from public.team_members m
         where m.user_id = auth.uid() and m.active and m.role in ('head_coach','assistant_coach')
        union
        select t.id from public.teams t
          join public.org_members om on om.org_id = t.org_id
         where om.user_id = auth.uid()
      ) x), '[]'::jsonb),
    'player_team_ids', coalesce((
      select jsonb_agg(m.team_id) from public.team_members m
       where m.user_id = auth.uid() and m.active and m.role = 'player'), '[]'::jsonb)
  )
$function$;
REVOKE ALL ON FUNCTION public.my_access() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_access() TO authenticated;

-- 7. queue notifications for team members ---------------------------------------
CREATE OR REPLACE FUNCTION public.queue_team_notification(
  _team uuid, _type text, _title text, _body text,
  _related_type text, _related_id uuid, _pref_column text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, team_id, type, title, body, related_type, related_id, channel, status)
  select m.user_id, _team, _type, _title, _body, _related_type, _related_id,
         case when coalesce(np.email_enabled, true) then 'email' else 'in_app' end,
         'pending'
  from public.team_members m
  left join public.notification_preferences np on np.user_id = m.user_id
  where m.team_id = _team and m.active and m.role = 'player'
    and case _pref_column
      when 'practice_reminders' then coalesce(np.practice_reminders, true)
      when 'game_reminders' then coalesce(np.game_reminders, true)
      when 'new_play_notifications' then coalesce(np.new_play_notifications, true)
      when 'challenge_notifications' then coalesce(np.challenge_notifications, true)
      when 'announcement_notifications' then coalesce(np.announcement_notifications, true)
      when 'assignment_notifications' then coalesce(np.assignment_notifications, true)
      else true end;
end;
$function$;
REVOKE ALL ON FUNCTION public.queue_team_notification(uuid, text, text, text, text, uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if new.audience in ('everyone','players') then
    perform public.queue_team_notification(new.team_id, 'announcement', new.title,
      left(new.body, 400), 'announcement', new.id, 'announcement_notifications');
  end if;
  return new;
end;
$function$;
DROP TRIGGER IF EXISTS notify_new_announcement ON public.announcements;
CREATE TRIGGER notify_new_announcement AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_announcement();

CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  perform public.queue_team_notification(new.team_id,
    case when new.assignment_type = 'video_review' then 'challenge' else 'assignment' end,
    new.title, new.instructions, 'assignment', new.id,
    case when new.assignment_type = 'video_review' then 'challenge_notifications' else 'assignment_notifications' end);
  return new;
end;
$function$;
DROP TRIGGER IF EXISTS notify_new_assignment ON public.assignments;
CREATE TRIGGER notify_new_assignment AFTER INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_assignment();

CREATE OR REPLACE FUNCTION public.notify_team_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare is_game boolean := coalesce(new.event_type, new.kind) in ('game','scrimmage');
begin
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
DROP TRIGGER IF EXISTS notify_team_event ON public.team_events;
CREATE TRIGGER notify_team_event AFTER INSERT OR UPDATE ON public.team_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_team_event();