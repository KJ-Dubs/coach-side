ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS access_token_ciphertext text,
  ADD COLUMN IF NOT EXISTS refresh_token_ciphertext text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS needs_reauth boolean NOT NULL DEFAULT false;

REVOKE SELECT (access_token_ciphertext, refresh_token_ciphertext) ON public.google_calendar_connections FROM authenticated, anon;

CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  return_to text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;