CREATE OR REPLACE FUNCTION public.ai_assistant_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT assistant_enabled FROM public.ai_settings WHERE id = true), true)
$$;

REVOKE ALL ON FUNCTION public.ai_assistant_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_assistant_enabled() TO authenticated, service_role;

DROP POLICY IF EXISTS "Signed-in users read AI settings" ON public.ai_settings;
CREATE POLICY "App admins read AI settings" ON public.ai_settings
  FOR SELECT TO authenticated USING (public.is_app_admin());