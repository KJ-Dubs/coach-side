REVOKE ALL ON FUNCTION public.sync_player_coaches_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_player_coaches_conversation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_player_coaches_membership() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_player_coaches_conversation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_coach_message_pin_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tid uuid; ctype text;
BEGIN
  IF OLD.sender_id = auth.uid() THEN RETURN NEW; END IF;
  SELECT c.team_id,c.type INTO tid,ctype FROM public.conversations c WHERE c.id=OLD.conversation_id;
  IF ctype='team' AND public.is_team_coach(tid)
    AND NEW.id=OLD.id AND NEW.conversation_id=OLD.conversation_id
    AND NEW.sender_id=OLD.sender_id AND NEW.body=OLD.body
    AND NEW.created_at=OLD.created_at AND NEW.edited_at IS NOT DISTINCT FROM OLD.edited_at
    AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Coaches may only change pin status on another sender message';
END
$$;
REVOKE ALL ON FUNCTION public.guard_coach_message_pin_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_coach_message_pin_update() TO service_role;
DROP TRIGGER IF EXISTS guard_coach_message_pin_update ON public.messages;
CREATE TRIGGER guard_coach_message_pin_update
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.guard_coach_message_pin_update();

CREATE POLICY "coach updates team message pin" ON public.messages
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id=conversation_id AND c.type='team' AND public.is_team_coach(c.team_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id=conversation_id AND c.type='team' AND public.is_team_coach(c.team_id)
));

CREATE POLICY "player creates coaching thread" ON public.conversations
FOR INSERT TO authenticated WITH CHECK (
  type='player_coaches' AND created_by=auth.uid() AND player_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id=conversations.team_id AND tm.user_id=auth.uid()
      AND tm.player_id=conversations.player_id AND tm.role='player' AND tm.active
  )
);

CREATE OR REPLACE FUNCTION public.populate_player_coaches_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type='player_coaches' THEN PERFORM public.sync_player_coaches_conversation(NEW.id); END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.populate_player_coaches_members() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.populate_player_coaches_members() TO service_role;
DROP TRIGGER IF EXISTS populate_player_coaches_members ON public.conversations;
CREATE TRIGGER populate_player_coaches_members
AFTER INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.populate_player_coaches_members();

CREATE OR REPLACE FUNCTION public.ensure_player_coaches_conversation(_team uuid, _player uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE cid uuid; caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT public.is_team_coach(_team) AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id=_team AND tm.user_id=caller AND tm.player_id=_player
      AND tm.role='player' AND tm.active
  ) THEN RAISE EXCEPTION 'Only this player or a team coach can open this conversation'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id=_player AND p.team_id=_team) THEN
    RAISE EXCEPTION 'Player is not on this team';
  END IF;
  SELECT id INTO cid FROM public.conversations
  WHERE team_id=_team AND player_id=_player AND type='player_coaches';
  IF cid IS NULL THEN
    INSERT INTO public.conversations(team_id,type,player_id,created_by,title)
    VALUES(_team,'player_coaches',_player,caller,'Message Coaches') RETURNING id INTO cid;
  END IF;
  RETURN cid;
END
$$;

CREATE OR REPLACE FUNCTION public.set_team_message_pinned(_message uuid, _pinned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE conv public.conversations%ROWTYPE;
BEGIN
  SELECT c.* INTO conv FROM public.messages m JOIN public.conversations c ON c.id=m.conversation_id
  WHERE m.id=_message;
  IF NOT FOUND OR conv.type<>'team' OR NOT public.is_team_coach(conv.team_id) THEN
    RAISE EXCEPTION 'Only a team coach can pin team-chat messages';
  END IF;
  UPDATE public.messages SET
    pinned_at=CASE WHEN _pinned THEN now() ELSE NULL END,
    pinned_by=CASE WHEN _pinned THEN auth.uid() ELSE NULL END
  WHERE id=_message;
END
$$;