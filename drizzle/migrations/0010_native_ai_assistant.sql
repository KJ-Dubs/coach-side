CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid NULL,
  title text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their AI conversations" ON public.ai_conversations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners create their AI conversations" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update their AI conversations" ON public.ai_conversations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete their AI conversations" ON public.ai_conversations FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX ai_conversations_user_idx ON public.ai_conversations (user_id, updated_at DESC);

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ui_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL DEFAULT '',
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, ui_id)
);
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their AI messages" ON public.ai_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners add AI messages to their conversations" ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "Owners delete their AI messages" ON public.ai_messages FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX ai_messages_conversation_idx ON public.ai_messages (conversation_id, created_at);

CREATE TABLE public.ai_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid NULL REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  team_id uuid NULL,
  kind text NOT NULL CHECK (kind IN ('schedule_create', 'schedule_update', 'roster_add', 'player_update', 'team_create')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'partial', 'failed', 'cancelled')),
  result jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);
GRANT SELECT, INSERT, UPDATE ON public.ai_pending_actions TO authenticated;
GRANT ALL ON public.ai_pending_actions TO service_role;
ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their AI actions" ON public.ai_pending_actions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners create their AI actions" ON public.ai_pending_actions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners resolve their AI actions" ON public.ai_pending_actions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ai_pending_actions_user_idx ON public.ai_pending_actions (user_id, created_at DESC);

CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('text', 'image', 'file')),
  input_tokens integer NULL,
  output_tokens integer NULL,
  total_tokens integer NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and app admins read AI usage" ON public.ai_usage FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_app_admin());
CREATE POLICY "Owners log their AI usage" ON public.ai_usage FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX ai_usage_user_idx ON public.ai_usage (user_id, created_at DESC);

CREATE TABLE public.ai_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  assistant_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);
GRANT SELECT, INSERT, UPDATE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read AI settings" ON public.ai_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "App admins create AI settings" ON public.ai_settings FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "App admins update AI settings" ON public.ai_settings FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());