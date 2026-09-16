REVOKE ALL ON public.team_billing FROM anon;
REVOKE ALL ON public.team_billing FROM authenticated;
GRANT ALL ON public.team_billing TO service_role;