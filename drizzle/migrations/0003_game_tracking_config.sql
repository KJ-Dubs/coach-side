ALTER TABLE public.games ADD COLUMN IF NOT EXISTS stat_tracking_config jsonb;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS rules_config jsonb;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS default_game_config jsonb;
COMMENT ON COLUMN public.games.stat_tracking_config IS 'Per-game stat tracking toggles; NULL means full tracking.';
COMMENT ON COLUMN public.games.rules_config IS 'Per-game foul limit, bonus and timeout rules; NULL means defaults.';