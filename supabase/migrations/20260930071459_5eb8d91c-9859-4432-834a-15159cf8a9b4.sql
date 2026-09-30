CREATE OR REPLACE FUNCTION public.ensure_player_coaches_conversation(_team uuid, _player uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;