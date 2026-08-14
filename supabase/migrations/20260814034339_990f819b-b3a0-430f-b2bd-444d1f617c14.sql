-- 1. Planos: referências externas do gateway
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS gateway_product_id text,
  ADD COLUMN IF NOT EXISTS gateway_price_id_monthly text,
  ADD COLUMN IF NOT EXISTS gateway_price_id_yearly text;

-- 2. Organizações internas / isentas
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false;
UPDATE public.organizations SET billing_exempt = true WHERE billing_exempt = false;

-- 3. Assinaturas: período e cancelamento agendado
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gateway_price_id text,
  ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_gateway_sub_uniq
  ON public.subscriptions (gateway_subscription_id)
  WHERE gateway_subscription_id IS NOT NULL;

-- 4. Clientes do gateway
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  gateway text NOT NULL DEFAULT 'paddle',
  gateway_customer_id text NOT NULL,
  email text,
  name text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway, gateway_customer_id),
  UNIQUE (organization_id, gateway)
);
GRANT SELECT ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_customers_select_members" ON public.billing_customers
  FOR SELECT TO authenticated USING (private.is_org_member(organization_id));

CREATE TRIGGER trg_billing_customers_updated BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Pagamentos / transações
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  gateway text NOT NULL DEFAULT 'paddle',
  gateway_transaction_id text NOT NULL,
  gateway_invoice_id text,
  gateway_customer_id text,
  status text NOT NULL,
  amount_cents bigint,
  currency text NOT NULL DEFAULT 'BRL',
  billed_at timestamptz,
  environment text NOT NULL DEFAULT 'sandbox',
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway, gateway_transaction_id)
);
GRANT SELECT ON public.billing_payments TO authenticated;
GRANT ALL ON public.billing_payments TO service_role;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_payments_select_members" ON public.billing_payments
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND private.is_org_member(organization_id));

CREATE INDEX IF NOT EXISTS billing_payments_org_idx ON public.billing_payments (organization_id, billed_at DESC);
CREATE TRIGGER trg_billing_payments_updated BEFORE UPDATE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Eventos de webhook (idempotência)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL DEFAULT 'paddle',
  event_id text NOT NULL,
  event_type text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  gateway_subscription_id text,
  gateway_transaction_id text,
  gateway_customer_id text,
  status text NOT NULL DEFAULT 'received',
  environment text NOT NULL DEFAULT 'sandbox',
  payload jsonb,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway, event_id)
);
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_events_admin_read" ON public.billing_events
  FOR SELECT TO authenticated USING (private.is_platform_admin());
GRANT SELECT ON public.billing_events TO authenticated;

CREATE INDEX IF NOT EXISTS billing_events_received_idx ON public.billing_events (received_at DESC);
CREATE TRIGGER trg_billing_events_updated BEFORE UPDATE ON public.billing_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();