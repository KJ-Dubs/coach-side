ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_type_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_type_check CHECK (type IN ('team','staff','direct','player_coaches'));

CREATE UNIQUE INDEX IF NOT EXISTS conversations_player_coaches_singleton
  ON public.conversations(team_id, player_id)
  WHERE type = 'player_coaches';

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid;

CREATE OR REPLACE FUNCTION public.can_read_conversation(_conv uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv AND (
      (c.type = 'team' AND public.is_team_staff_or_player(c.team_id))
      OR (c.type = 'staff' AND public.is_team_coach(c.team_id))
      OR (c.type IN ('direct','player_coaches') AND EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
      ) AND public.is_team_staff_or_player(c.team_id))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_post_conversation(_conv uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c JOIN public.teams t ON t.id = c.team_id
    WHERE c.id = _conv AND (
      (c.type = 'team' AND (
        public.is_team_coach(c.team_id)
        OR (coalesce(t.allow_player_posting, true) AND public.my_team_role(c.team_id) = 'player')
      ))
      OR (c.type = 'staff' AND public.is_team_coach(c.team_id))
      OR (c.type IN ('direct','player_coaches') AND EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
      ) AND public.is_team_staff_or_player(c.team_id))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.sync_player_coaches_conversation(_conversation uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.conversations%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.conversations WHERE id = _conversation AND type = 'player_coaches';
  IF NOT FOUND THEN RETURN; END IF;

  DELETE FROM public.conversation_members cm
  WHERE cm.conversation_id = c.id
    AND NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = c.team_id AND tm.user_id = cm.user_id AND tm.active
        AND ((tm.player_id = c.player_id AND tm.role = 'player')
          OR tm.role IN ('head_coach','assistant_coach'))
    );

  INSERT INTO public.conversation_members(conversation_id,user_id)
  SELECT c.id, tm.user_id
  FROM public.team_members tm
  WHERE tm.team_id = c.team_id AND tm.active
    AND ((tm.player_id = c.player_id AND tm.role = 'player')
      OR tm.role IN ('head_coach','assistant_coach'))
  ON CONFLICT (conversation_id,user_id) DO NOTHING;
END
$$;

CREATE OR REPLACE FUNCTION public.ensure_player_coaches_conversation(_team uuid, _player uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cid uuid; caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT public.is_team_coach(_team) AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _team AND tm.user_id = caller AND tm.player_id = _player
      AND tm.role = 'player' AND tm.active
  ) THEN
    RAISE EXCEPTION 'Only this player or a team coach can open this conversation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = _player AND p.team_id = _team) THEN
    RAISE EXCEPTION 'Player is not on this team';
  END IF;

  SELECT id INTO cid FROM public.conversations
  WHERE team_id = _team AND player_id = _player AND type = 'player_coaches';
  IF cid IS NULL THEN
    INSERT INTO public.conversations(team_id,type,player_id,created_by,title)
    VALUES (_team,'player_coaches',_player,caller,'Message Coaches')
    RETURNING id INTO cid;
  END IF;
  PERFORM public.sync_player_coaches_conversation(cid);
  RETURN cid;
END
$$;

REVOKE ALL ON FUNCTION public.sync_player_coaches_conversation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_player_coaches_conversation(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.ensure_player_coaches_conversation(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_player_coaches_conversation(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_player_coaches_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tid uuid := coalesce(NEW.team_id, OLD.team_id); c record;
BEGIN
  FOR c IN SELECT id FROM public.conversations WHERE team_id = tid AND type = 'player_coaches'
  LOOP
    PERFORM public.sync_player_coaches_conversation(c.id);
  END LOOP;
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS sync_player_coaches_membership ON public.team_members;
CREATE TRIGGER sync_player_coaches_membership
AFTER INSERT OR UPDATE OF role,active,player_id OR DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.sync_player_coaches_membership();

CREATE OR REPLACE FUNCTION public.set_team_message_pinned(_message uuid, _pinned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE conv public.conversations%ROWTYPE;
BEGIN
  SELECT c.* INTO conv FROM public.messages m JOIN public.conversations c ON c.id=m.conversation_id
  WHERE m.id=_message;
  IF NOT FOUND OR conv.type <> 'team' OR NOT public.is_team_coach(conv.team_id) THEN
    RAISE EXCEPTION 'Only a team coach can pin team-chat messages';
  END IF;
  UPDATE public.messages
  SET pinned_at = CASE WHEN _pinned THEN now() ELSE NULL END,
      pinned_by = CASE WHEN _pinned THEN auth.uid() ELSE NULL END
  WHERE id=_message;
END
$$;
REVOKE ALL ON FUNCTION public.set_team_message_pinned(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_team_message_pinned(uuid,boolean) TO authenticated;

CREATE TABLE public.play_folder_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.team_playbook_folders(id) ON DELETE CASCADE,
  play_id uuid NOT NULL REFERENCES public.plays(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(folder_id,play_id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.play_folder_memberships TO authenticated;
GRANT ALL ON public.play_folder_memberships TO service_role;
ALTER TABLE public.play_folder_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members read play folder memberships" ON public.play_folder_memberships
  FOR SELECT TO authenticated USING (public.is_team_staff_or_player(team_id));
CREATE POLICY "Team coaches create play folder memberships" ON public.play_folder_memberships
  FOR INSERT TO authenticated WITH CHECK (
    public.is_team_coach(team_id) AND created_by=auth.uid()
    AND EXISTS (SELECT 1 FROM public.team_playbook_folders f WHERE f.id=folder_id AND f.team_id=team_id)
    AND EXISTS (SELECT 1 FROM public.play_team_assignments a WHERE a.play_id=play_folder_memberships.play_id AND a.team_id=play_folder_memberships.team_id AND a.is_visible)
  );
CREATE POLICY "Team coaches update play folder memberships" ON public.play_folder_memberships
  FOR UPDATE TO authenticated USING (public.is_team_coach(team_id)) WITH CHECK (
    public.is_team_coach(team_id)
    AND EXISTS (SELECT 1 FROM public.team_playbook_folders f WHERE f.id=folder_id AND f.team_id=team_id)
  );
CREATE POLICY "Team coaches delete play folder memberships" ON public.play_folder_memberships
  FOR DELETE TO authenticated USING (public.is_team_coach(team_id));
CREATE TRIGGER update_play_folder_memberships_updated_at
BEFORE UPDATE ON public.play_folder_memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.play_folder_memberships(folder_id,play_id,team_id,created_by)
SELECT a.folder_id,a.play_id,a.team_id,a.assigned_by
FROM public.play_team_assignments a
WHERE a.folder_id IS NOT NULL
ON CONFLICT(folder_id,play_id) DO NOTHING;

CREATE TABLE public.assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  attachment_type text NOT NULL CHECK (attachment_type IN ('play','playbook_folder','drill','practice_plan','event','game','plan','resource','url')),
  related_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.assignment_attachments TO authenticated;
GRANT ALL ON public.assignment_attachments TO service_role;
ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team reads plan attachments" ON public.assignment_attachments
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.is_team_staff_or_player(a.team_id)
  ));
CREATE POLICY "Team coaches create plan attachments" ON public.assignment_attachments
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.is_team_coach(a.team_id)
  ));
CREATE POLICY "Team coaches update plan attachments" ON public.assignment_attachments
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.is_team_coach(a.team_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.is_team_coach(a.team_id)
  ));
CREATE POLICY "Team coaches delete plan attachments" ON public.assignment_attachments
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.is_team_coach(a.team_id)
  ));
CREATE TRIGGER update_assignment_attachments_updated_at
BEFORE UPDATE ON public.assignment_attachments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.message_attachments DROP CONSTRAINT IF EXISTS message_attachments_attachment_type_check;
ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_attachment_type_check
CHECK (attachment_type IN ('play','playbook_folder','drill','practice_plan','event','game','plan','resource','url','stat','full_game_video','video_clip','drill_video','coach_video','game_timestamp_clip'));

ALTER TABLE public.announcement_attachments DROP CONSTRAINT IF EXISTS announcement_attachments_attachment_type_check;
ALTER TABLE public.announcement_attachments ADD CONSTRAINT announcement_attachments_attachment_type_check
CHECK (attachment_type IN ('play','playbook_folder','drill','practice_plan','event','game','plan','resource','url','stat','full_game_video','video_clip','drill_video','coach_video','game_timestamp_clip'));