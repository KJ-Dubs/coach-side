-- Per-coach connector permissions, chosen on the CoachSide consent screen.
-- OAuth codes/tokens/refresh tokens/client registration live in the managed auth server;
-- this table only narrows what an authorized connector may do and allows instant revoke.
CREATE TABLE public.mcp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  client_name text,
  client_uri text,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  rate_window_start timestamptz,
  rate_window_count integer NOT NULL DEFAULT 0,
  CONSTRAINT mcp_connections_user_client UNIQUE (user_id, client_id),
  CONSTRAINT mcp_connections_permissions_valid CHECK (
    permissions <@ ARRAY[
      'coachside:teams:read','coachside:teams:write',
      'coachside:roster:read','coachside:roster:write',
      'coachside:schedule:read','coachside:schedule:write'
    ]::text[]
  ),
  CONSTRAINT mcp_connections_client_len CHECK (char_length(client_id) BETWEEN 1 AND 200)
);
GRANT SELECT ON public.mcp_connections TO authenticated;
GRANT ALL ON public.mcp_connections TO service_role;
ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach reads own connector connections" ON public.mcp_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Structured log of write actions made through a connector (never conversations).
CREATE TABLE public.mcp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text,
  tool_name text NOT NULL,
  team_id uuid,
  target_id uuid,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_audit_summary_len CHECK (char_length(summary) <= 500),
  CONSTRAINT mcp_audit_tool_len CHECK (char_length(tool_name) <= 60)
);
CREATE INDEX mcp_audit_log_user_created ON public.mcp_audit_log (user_id, created_at DESC);
GRANT SELECT ON public.mcp_audit_log TO authenticated;
GRANT ALL ON public.mcp_audit_log TO service_role;
ALTER TABLE public.mcp_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach reads own connector audit" ON public.mcp_audit_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Consent: only a normal CoachSide session (never a connector token) may grant permissions.
CREATE OR REPLACE FUNCTION public.mcp_record_consent(
  p_client_id text, p_client_name text, p_client_uri text, p_permissions text[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF coalesce(auth.jwt() ->> 'client_id', '') <> '' THEN
    RAISE EXCEPTION 'Connected apps cannot change their own permissions';
  END IF;
  IF p_client_id IS NULL OR char_length(p_client_id) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid client';
  END IF;
  IF coalesce(array_length(p_permissions, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Choose at least one permission';
  END IF;
  INSERT INTO public.mcp_connections (user_id, client_id, client_name, client_uri, permissions)
  VALUES (_uid, p_client_id, left(p_client_name, 120), left(p_client_uri, 300),
          ARRAY(SELECT DISTINCT unnest(p_permissions) ORDER BY 1))
  ON CONFLICT (user_id, client_id) DO UPDATE
    SET client_name = excluded.client_name,
        client_uri = excluded.client_uri,
        permissions = excluded.permissions,
        revoked_at = NULL,
        updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mcp_revoke_connection(p_client_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE public.mcp_connections
     SET revoked_at = coalesce(revoked_at, now()), updated_at = now()
   WHERE user_id = auth.uid() AND client_id = p_client_id;
END $$;

-- Called at the start of every connector tool call with the caller's token:
-- checks connection, permission and a per-connection rate limit, then marks last use.
CREATE OR REPLACE FUNCTION public.mcp_begin_call(p_permission text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _cid text := auth.jwt() ->> 'client_id';
  _row public.mcp_connections%ROWTYPE;
  _limit constant integer := 60;
BEGIN
  IF _uid IS NULL OR coalesce(_cid, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_CONNECTED');
  END IF;
  SELECT * INTO _row FROM public.mcp_connections
   WHERE user_id = _uid AND client_id = _cid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_CONNECTED');
  END IF;
  IF _row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONNECTION_REVOKED');
  END IF;
  IF NOT (p_permission = ANY (_row.permissions)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_NOT_GRANTED');
  END IF;
  IF _row.rate_window_start IS NULL OR _row.rate_window_start < now() - interval '1 minute' THEN
    UPDATE public.mcp_connections
       SET rate_window_start = now(), rate_window_count = 1, last_used_at = now()
     WHERE id = _row.id;
  ELSE
    IF _row.rate_window_count >= _limit THEN
      RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
    END IF;
    UPDATE public.mcp_connections
       SET rate_window_count = rate_window_count + 1, last_used_at = now()
     WHERE id = _row.id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'permissions', to_jsonb(_row.permissions));
END $$;

CREATE OR REPLACE FUNCTION public.mcp_log_action(
  p_tool text, p_team uuid, p_target uuid, p_summary text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _cid text := auth.jwt() ->> 'client_id';
BEGIN
  IF _uid IS NULL OR coalesce(_cid, '') = '' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mcp_connections
                  WHERE user_id = _uid AND client_id = _cid AND revoked_at IS NULL) THEN
    RETURN;
  END IF;
  INSERT INTO public.mcp_audit_log (user_id, client_id, tool_name, team_id, target_id, summary)
  VALUES (_uid, _cid, left(p_tool, 60), p_team, p_target, left(coalesce(p_summary, ''), 500));
END $$;

REVOKE ALL ON FUNCTION public.mcp_record_consent(text, text, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mcp_revoke_connection(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mcp_begin_call(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mcp_log_action(text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_record_consent(text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_revoke_connection(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_begin_call(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_log_action(text, uuid, uuid, text) TO authenticated;