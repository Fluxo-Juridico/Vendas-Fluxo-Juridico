BEGIN;

CREATE TABLE IF NOT EXISTS sales_leads (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  firm_name text NOT NULL DEFAULT '',
  team_size text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'website',
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  next_followup timestamptz,
  demo_at timestamptz,
  converted_at timestamptz,
  lost_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_leads_status_check
    CHECK (status IN ('new','contacted','qualified','won','lost'))
);

CREATE INDEX IF NOT EXISTS sales_leads_email_idx
  ON sales_leads (lower(email));
CREATE INDEX IF NOT EXISTS sales_leads_status_created_idx
  ON sales_leads (status, created_at DESC);

CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY,
  lead_id uuid REFERENCES sales_leads(id) ON DELETE SET NULL,
  plan text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  cpf_masked text NOT NULL DEFAULT '',
  cpf_last4 text NOT NULL DEFAULT '',
  firm_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT 'mercado_pago',
  provider_plan_id text NOT NULL DEFAULT '',
  provider_subscription_id text NOT NULL DEFAULT '',
  provider_payment_id text NOT NULL DEFAULT '',
  checkout_url text NOT NULL DEFAULT '',
  payment_status text NOT NULL DEFAULT 'created',
  payment_status_detail text NOT NULL DEFAULT '',
  subscription_status text NOT NULL DEFAULT '',
  provisioning_status text NOT NULL DEFAULT 'not_ready',
  automation_action text NOT NULL DEFAULT '',
  failure_reason text NOT NULL DEFAULT '',
  paid_at timestamptz,
  refunded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_orders_email_idx
  ON sales_orders (lower(buyer_email));
CREATE INDEX IF NOT EXISTS sales_orders_payment_status_idx
  ON sales_orders (payment_status, updated_at);
CREATE INDEX IF NOT EXISTS sales_orders_provisioning_status_idx
  ON sales_orders (provisioning_status, updated_at);
CREATE INDEX IF NOT EXISTS sales_orders_provider_subscription_idx
  ON sales_orders (provider_subscription_id)
  WHERE provider_subscription_id <> '';
CREATE INDEX IF NOT EXISTS sales_orders_provider_plan_idx
  ON sales_orders (provider_plan_id)
  WHERE provider_plan_id <> '';
CREATE INDEX IF NOT EXISTS sales_orders_created_idx
  ON sales_orders (created_at DESC);

CREATE TABLE IF NOT EXISTS sales_payment_events (
  id bigserial PRIMARY KEY,
  provider_event_id text NOT NULL DEFAULT '',
  order_id uuid REFERENCES sales_orders(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT '',
  resource_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  status_detail text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_payment_events_provider_unique
    UNIQUE (provider_event_id, event_type, resource_id)
);

CREATE INDEX IF NOT EXISTS sales_payment_events_order_idx
  ON sales_payment_events (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_payment_events_created_idx
  ON sales_payment_events (created_at DESC);

COMMIT;
