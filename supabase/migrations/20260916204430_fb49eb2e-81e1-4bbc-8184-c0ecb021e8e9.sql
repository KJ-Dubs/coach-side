DELETE FROM public.app_admins a
USING public.profiles p
WHERE a.user_id = p.id AND lower(p.email) = 'kory@whoopaxe.com';