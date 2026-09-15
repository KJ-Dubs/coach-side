-- 1. google_calendar_connections: keep encrypted token columns out of the Data API entirely
REVOKE SELECT, INSERT, UPDATE, REFERENCES ON public.google_calendar_connections FROM authenticated;
GRANT DELETE ON public.google_calendar_connections TO authenticated;
GRANT SELECT (id, user_id, team_id, google_calendar_id, google_calendar_name, google_account_email,
              token_expiry, sync_enabled, last_synced_at, last_sync_error, scope, sync_status,
              needs_reauth, created_at, updated_at)
  ON public.google_calendar_connections TO authenticated;
GRANT INSERT (id, user_id, team_id, google_calendar_id, google_calendar_name, google_account_email,
              sync_enabled, sync_status, needs_reauth, created_at, updated_at)
  ON public.google_calendar_connections TO authenticated;
GRANT UPDATE (google_calendar_id, google_calendar_name, sync_enabled, sync_status, needs_reauth, updated_at)
  ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;

-- 2. notifications: creation is server-side only; anon has no business here at all
REVOKE ALL ON public.notifications FROM anon;
REVOKE INSERT, TRUNCATE, REFERENCES, TRIGGER ON public.notifications FROM authenticated;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 3. org_members: read-only for clients so head-coach status cannot be self-granted
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.org_members FROM authenticated;
REVOKE ALL ON public.org_members FROM anon;
GRANT SELECT ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;