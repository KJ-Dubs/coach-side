ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_practice boolean NOT NULL DEFAULT false;

CREATE TABLE public.coach_onboarding (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','skipped')),
  step integer NOT NULL DEFAULT 0,
  interests text[] NOT NULL DEFAULT '{}',
  team_id uuid,
  players_added integer NOT NULL DEFAULT 0,
  colors_set boolean NOT NULL DEFAULT false,
  events_sent text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'wizard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.coach_onboarding TO authenticated;
GRANT ALL ON public.coach_onboarding TO service_role;
ALTER TABLE public.coach_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own onboarding read" ON public.coach_onboarding FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own onboarding insert" ON public.coach_onboarding FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own onboarding update" ON public.coach_onboarding FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER coach_onboarding_updated BEFORE UPDATE ON public.coach_onboarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Existing accounts with any meaningful activity or any team membership are treated as already onboarded.
INSERT INTO public.coach_onboarding (user_id, status, source)
SELECT u.id, 'completed', 'backfill' FROM auth.users u
WHERE EXISTS (SELECT 1 FROM public.team_members m WHERE m.user_id = u.id)
   OR EXISTS (SELECT 1 FROM public.plays p WHERE p.created_by = u.id)
   OR EXISTS (SELECT 1 FROM public.drills d WHERE d.created_by = u.id)
   OR EXISTS (SELECT 1 FROM public.practice_plans pp WHERE pp.created_by = u.id)
   OR EXISTS (SELECT 1 FROM public.profiles pr JOIN public.teams t ON t.org_id = pr.org_id WHERE pr.id = u.id AND pr.org_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;