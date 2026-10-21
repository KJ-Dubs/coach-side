-- CoachSide AI is a future Complete feature: the switch now defaults OFF
-- (fail closed) and is explicitly off until an admin turns it on.
CREATE OR REPLACE FUNCTION public.ai_assistant_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT assistant_enabled FROM public.ai_settings WHERE id = true), false)
$$;

REVOKE ALL ON FUNCTION public.ai_assistant_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_assistant_enabled() TO authenticated, service_role;

INSERT INTO public.ai_settings (id, assistant_enabled, updated_at)
VALUES (true, false, now())
ON CONFLICT (id) DO UPDATE SET assistant_enabled = false, updated_at = now();