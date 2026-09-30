REVOKE EXECUTE ON FUNCTION public.ensure_player_coaches_conversation(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_player_coaches_conversation(uuid, uuid) TO authenticated;