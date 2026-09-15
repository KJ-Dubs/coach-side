-- 1. Remove anonymous (signed-out) table privileges on sensitive tables.
REVOKE ALL ON TABLE public.google_calendar_connections FROM anon;
REVOKE ALL ON TABLE public.calendar_connections FROM anon;
REVOKE ALL ON TABLE public.calendar_mappings FROM anon;
REVOKE ALL ON TABLE public.event_sync_links FROM anon;
REVOKE ALL ON TABLE public.team_invites FROM anon;
REVOKE ALL ON TABLE public.coach_invites FROM anon;
REVOKE ALL ON TABLE public.team_members FROM anon;
REVOKE ALL ON TABLE public.org_members FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;

-- 2. OAuth state rows are written and read only by trusted server code.
REVOKE ALL ON TABLE public.google_oauth_states FROM anon, authenticated;
GRANT ALL ON TABLE public.google_oauth_states TO service_role;
DROP POLICY IF EXISTS "owner reads own oauth state" ON public.google_oauth_states;
CREATE POLICY "no client access to oauth state"
  ON public.google_oauth_states
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 3. Explicit ownership check on every google_calendar_connections path,
--    including DELETE, and no anonymous route to token ciphertext.
DROP POLICY IF EXISTS "owner deletes own google calendar connection" ON public.google_calendar_connections;
CREATE POLICY "owner deletes own google calendar connection"
  ON public.google_calendar_connections
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "owner reads own google calendar connections" ON public.google_calendar_connections;
CREATE POLICY "owner reads own google calendar connections"
  ON public.google_calendar_connections
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND auth.uid() IS NOT NULL);

-- 4. Invite token lookup: only disclose the locker token for an active parent invite.
CREATE OR REPLACE FUNCTION public.get_team_invite(_token text)
 RETURNS TABLE(team_id uuid, team_name text, season text, invite_type text, status text, locker_token text, locker_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.id, t.name, t.season, i.invite_type,
         case when not i.active then 'revoked'
              when i.expires_at is not null and i.expires_at < now() then 'expired'
              else 'active' end,
         case when i.active
                   and (i.expires_at is null or i.expires_at > now())
                   and i.invite_type = 'parent'
                   and t.locker_enabled
              then t.locker_token else null end,
         t.locker_enabled
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  where i.token = _token
  limit 1
$function$;

-- 5. SECURITY DEFINER helpers are no longer callable by signed-out visitors,
--    except the three lookups that public invite links need.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;

  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('get_invite', 'get_team_invite', 'invite_roster')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.sig);
  END LOOP;
END $$;