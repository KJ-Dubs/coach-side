REVOKE EXECUTE ON FUNCTION public.team_modules(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_team_entitlement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_modules(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_team_entitlement(uuid) TO authenticated, service_role;