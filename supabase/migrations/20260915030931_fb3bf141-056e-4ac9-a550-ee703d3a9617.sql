REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_play_of_the_day(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_play_heart(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_hearted_plays() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_follow_creator(text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_followed_creators() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_my_username(text, text, text) FROM anon;