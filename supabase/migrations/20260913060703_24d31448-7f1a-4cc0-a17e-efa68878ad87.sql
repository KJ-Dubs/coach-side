DROP POLICY IF EXISTS "owner reads own google calendar connections" ON public.google_calendar_connections;
CREATE POLICY "owner reads own google calendar connections" ON public.google_calendar_connections FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner inserts own google calendar connection" ON public.google_calendar_connections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner updates own google calendar connection" ON public.google_calendar_connections FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner deletes own google calendar connection" ON public.google_calendar_connections FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;