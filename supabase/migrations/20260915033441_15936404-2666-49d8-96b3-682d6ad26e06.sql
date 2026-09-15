-- Membership / entitlement foundation. Nothing here enforces access on its own.

CREATE TABLE public.team_billing (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'free',
  modules text[] NOT NULL DEFAULT '{}',
  pending_modules text[],
  pending_effective_at timestamptz,
  current_period_end timestamptz,
  billing_owner uuid,
  square_customer_id text,
  square_subscription_id text,
  square_plan_variation_id text,
  last_webhook_at timestamptz,
  last_webhook_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_billing_status_check CHECK (status IN
    ('free','pending','active','grace','past_due','canceled','complimentary'))
);

GRANT ALL ON public.team_billing TO service_role;
ALTER TABLE public.team_billing ENABLE ROW LEVEL SECURITY;
-- Coaches read their team's state through a server function only; no direct grants.
CREATE POLICY "service role manages team billing"
  ON public.team_billing FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_team_billing_updated_at BEFORE UPDATE ON public.team_billing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.complimentary_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  modules text[] NOT NULL DEFAULT '{}',
  reason text,
  source text NOT NULL DEFAULT 'manual',
  access_code_id uuid,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.complimentary_grants TO service_role;
ALTER TABLE public.complimentary_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages complimentary grants"
  ON public.complimentary_grants FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_complimentary_grants_updated_at BEFORE UPDATE ON public.complimentary_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  code_hint text NOT NULL,
  label text,
  modules text[] NOT NULL DEFAULT '{}',
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  per_team_limit integer NOT NULL DEFAULT 1,
  grant_days integer,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.access_codes TO service_role;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages access codes"
  ON public.access_codes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_access_codes_updated_at BEFORE UPDATE ON public.access_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.access_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code_id uuid NOT NULL REFERENCES public.access_codes(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  modules text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX access_code_redemptions_code_team_idx
  ON public.access_code_redemptions (access_code_id, team_id);

GRANT ALL ON public.access_code_redemptions TO service_role;
ALTER TABLE public.access_code_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages redemptions"
  ON public.access_code_redemptions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.complimentary_grants
  ADD CONSTRAINT complimentary_grants_access_code_fk
  FOREIGN KEY (access_code_id) REFERENCES public.access_codes(id) ON DELETE SET NULL;

-- Resolved modules for a team: paid subscription + complimentary grants.
-- Program-level grants can later add another UNION branch here.
CREATE OR REPLACE FUNCTION public.team_modules(_team uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT array_agg(DISTINCT m) FROM (
      SELECT unnest(b.modules) AS m
      FROM public.team_billing b
      WHERE b.team_id = _team
        AND b.status IN ('active','grace','past_due','complimentary')
      UNION
      SELECT unnest(g.modules) AS m
      FROM public.complimentary_grants g
      WHERE g.team_id = _team
        AND g.active
        AND (g.expires_at IS NULL OR g.expires_at > now())
    ) s),
    '{}'::text[]
  );
$$;

REVOKE EXECUTE ON FUNCTION public.team_modules(uuid) FROM anon;

-- Team members may read which modules their team holds (never payment refs).
CREATE OR REPLACE FUNCTION public.my_team_entitlement(_team uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.team_visible(_team) THEN jsonb_build_object(
    'team_id', _team,
    'modules', to_jsonb(public.team_modules(_team)),
    'status', COALESCE((SELECT status FROM public.team_billing WHERE team_id = _team), 'free'),
    'current_period_end', (SELECT current_period_end FROM public.team_billing WHERE team_id = _team),
    'complimentary', EXISTS (
      SELECT 1 FROM public.complimentary_grants g
      WHERE g.team_id = _team AND g.active
        AND (g.expires_at IS NULL OR g.expires_at > now())
    )
  ) ELSE NULL END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_team_entitlement(uuid) FROM anon;