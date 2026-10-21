ALTER TABLE public.team_billing
  ADD COLUMN IF NOT EXISTS square_checkout_link_id text,
  ADD COLUMN IF NOT EXISTS square_checkout_order_id text,
  ADD COLUMN IF NOT EXISTS square_checkout_url text,
  ADD COLUMN IF NOT EXISTS square_checkout_variation_id text,
  ADD COLUMN IF NOT EXISTS square_checkout_started_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS team_billing_square_subscription_unique
  ON public.team_billing (square_subscription_id)
  WHERE square_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS team_billing_square_customer_idx
  ON public.team_billing (square_customer_id)
  WHERE square_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS team_billing_square_checkout_order_idx
  ON public.team_billing (square_checkout_order_id)
  WHERE square_checkout_order_id IS NOT NULL;