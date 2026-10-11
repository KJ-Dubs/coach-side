ALTER TABLE public.plays ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.plays SET updated_at = GREATEST(created_at, COALESCE(indexed_at, created_at));
DROP TRIGGER IF EXISTS plays_touch_updated_at ON public.plays;
CREATE TRIGGER plays_touch_updated_at BEFORE UPDATE ON public.plays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.touch_play_from_frame() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.plays SET updated_at = now() WHERE id = COALESCE(NEW.play_id, OLD.play_id);
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.touch_play_from_frame() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS play_frames_touch_play ON public.play_frames;
CREATE TRIGGER play_frames_touch_play AFTER INSERT OR UPDATE OR DELETE ON public.play_frames FOR EACH ROW EXECUTE FUNCTION public.touch_play_from_frame();