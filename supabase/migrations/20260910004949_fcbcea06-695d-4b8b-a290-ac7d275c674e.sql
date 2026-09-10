
-- coach invites: restrict SELECT
DROP POLICY IF EXISTS "org reads invites" ON public.coach_invites;
CREATE POLICY "head coach reads invites" ON public.coach_invites
FOR SELECT TO authenticated
USING (
  org_id = my_org_id()
  AND (is_head_coach() OR invited_by = auth.uid() OR accepted_by = auth.uid())
);

-- games
DROP POLICY IF EXISTS "games all" ON public.games;
CREATE POLICY "team reads games visible" ON public.games
FOR SELECT TO authenticated USING (team_visible(team_id));
CREATE POLICY "coaches write games" ON public.games
FOR INSERT TO authenticated WITH CHECK (is_team_coach(team_id));
CREATE POLICY "coaches update games" ON public.games
FOR UPDATE TO authenticated USING (is_team_coach(team_id)) WITH CHECK (is_team_coach(team_id));
CREATE POLICY "coaches delete games" ON public.games
FOR DELETE TO authenticated USING (is_team_coach(team_id));

-- helper-free coach check for game-scoped tables
CREATE OR REPLACE FUNCTION public.is_game_coach(_game uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.games g WHERE g.id = _game AND public.is_team_coach(g.team_id))
$$;
REVOKE ALL ON FUNCTION public.is_game_coach(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_game_coach(uuid) TO authenticated;

-- game_events
DROP POLICY IF EXISTS "events all" ON public.game_events;
CREATE POLICY "team reads game events visible" ON public.game_events
FOR SELECT TO authenticated USING (game_visible(game_id));
CREATE POLICY "coaches write game events" ON public.game_events
FOR INSERT TO authenticated WITH CHECK (is_game_coach(game_id));
CREATE POLICY "coaches update game events" ON public.game_events
FOR UPDATE TO authenticated USING (is_game_coach(game_id)) WITH CHECK (is_game_coach(game_id));
CREATE POLICY "coaches delete game events" ON public.game_events
FOR DELETE TO authenticated USING (is_game_coach(game_id));

-- substitutions
DROP POLICY IF EXISTS "subs all" ON public.substitutions;
CREATE POLICY "team reads subs visible" ON public.substitutions
FOR SELECT TO authenticated USING (game_visible(game_id));
CREATE POLICY "coaches write subs" ON public.substitutions
FOR INSERT TO authenticated WITH CHECK (is_game_coach(game_id));
CREATE POLICY "coaches update subs" ON public.substitutions
FOR UPDATE TO authenticated USING (is_game_coach(game_id)) WITH CHECK (is_game_coach(game_id));
CREATE POLICY "coaches delete subs" ON public.substitutions
FOR DELETE TO authenticated USING (is_game_coach(game_id));

-- players
DROP POLICY IF EXISTS "players all" ON public.players;
CREATE POLICY "team reads players visible" ON public.players
FOR SELECT TO authenticated USING (team_visible(team_id));
CREATE POLICY "coaches write players" ON public.players
FOR INSERT TO authenticated WITH CHECK (is_team_coach(team_id));
CREATE POLICY "coaches update players" ON public.players
FOR UPDATE TO authenticated USING (is_team_coach(team_id)) WITH CHECK (is_team_coach(team_id));
CREATE POLICY "coaches delete players" ON public.players
FOR DELETE TO authenticated USING (is_team_coach(team_id));

-- team_events
DROP POLICY IF EXISTS "team events all" ON public.team_events;
CREATE POLICY "team reads events visible" ON public.team_events
FOR SELECT TO authenticated USING (team_visible(team_id));
CREATE POLICY "coaches write team events" ON public.team_events
FOR INSERT TO authenticated WITH CHECK (is_team_coach(team_id));
CREATE POLICY "coaches update team events" ON public.team_events
FOR UPDATE TO authenticated USING (is_team_coach(team_id)) WITH CHECK (is_team_coach(team_id));
CREATE POLICY "coaches delete team events" ON public.team_events
FOR DELETE TO authenticated USING (is_team_coach(team_id));

-- event_reminders
DROP POLICY IF EXISTS "event reminders all" ON public.event_reminders;
CREATE POLICY "team reads reminders" ON public.event_reminders
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_events e WHERE e.id = event_reminders.event_id AND team_visible(e.team_id)));
CREATE POLICY "coaches write reminders" ON public.event_reminders
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.team_events e WHERE e.id = event_reminders.event_id AND is_team_coach(e.team_id)));
CREATE POLICY "coaches update reminders" ON public.event_reminders
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_events e WHERE e.id = event_reminders.event_id AND is_team_coach(e.team_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.team_events e WHERE e.id = event_reminders.event_id AND is_team_coach(e.team_id)));
CREATE POLICY "coaches delete reminders" ON public.event_reminders
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_events e WHERE e.id = event_reminders.event_id AND is_team_coach(e.team_id)));
