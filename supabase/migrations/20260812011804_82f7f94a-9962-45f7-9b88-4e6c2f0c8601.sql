-- =========================================================
-- FASE SAAS 3 — Plataforma: admins globais, planos, assinaturas
-- =========================================================

-- 1. Administradores globais da plataforma
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = _user);
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;

CREATE POLICY "platform_admins_select" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_platform_admins_updated
  BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Planos
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'active',
  trial_days integer NOT NULL DEFAULT 14,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  highlight boolean NOT NULL DEFAULT false,
  is_trial_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  archived_at timestamptz
);

GRANT SELECT ON public.plans TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select" ON public.plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans_insert" ON public.plans
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "plans_update" ON public.plans
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "plans_delete" ON public.plans
  FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_plans_updated
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Assinaturas
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'trial',
  period text NOT NULL DEFAULT 'monthly',
  contracted_price numeric,
  currency text NOT NULL DEFAULT 'BRL',
  started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz,
  ends_at timestamptz,
  next_renewal_at timestamptz,
  canceled_at timestamptz,
  cancel_reason text,
  -- Preparação para gateway (permanecem nulos nesta fase)
  gateway text,
  gateway_customer_id text,
  gateway_subscription_id text,
  gateway_payment_id text,
  gateway_invoice_id text,
  gateway_checkout_url text,
  gateway_payment_status text,
  external_reference text,
  gateway_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR private.is_org_member(organization_id));
CREATE POLICY "subscriptions_insert" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_plan ON public.subscriptions(plan_id);

-- 4. Histórico da assinatura
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event text NOT NULL,
  from_status text,
  to_status text,
  from_plan_id uuid REFERENCES public.plans(id),
  to_plan_id uuid REFERENCES public.plans(id),
  source text NOT NULL DEFAULT 'admin',
  actor_id uuid REFERENCES auth.users(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_events_select" ON public.subscription_events
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR private.is_org_member(organization_id));
CREATE POLICY "subscription_events_insert" ON public.subscription_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) AND actor_id = auth.uid());

CREATE INDEX idx_subscription_events_org ON public.subscription_events(organization_id, created_at DESC);

-- 5. Auditoria administrativa da plataforma
CREATE TABLE public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.platform_audit_log TO authenticated;
GRANT ALL ON public.platform_audit_log TO service_role;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_audit_select" ON public.platform_audit_log
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform_audit_insert" ON public.platform_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) AND actor_id = auth.uid());

CREATE INDEX idx_platform_audit_created ON public.platform_audit_log(created_at DESC);

-- 6. Configurações da plataforma
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  default_trial_days integer NOT NULL DEFAULT 14,
  gateway text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_select" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_settings_insert" ON public.platform_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform_settings_update" ON public.platform_settings
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_platform_settings_updated
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (singleton, default_trial_days) VALUES (true, 14);

-- 7. Catálogo inicial de planos (produto, não dados de cliente)
INSERT INTO public.plans (code, name, description, price_monthly, price_yearly, trial_days, display_order, highlight, is_trial_default, features, limits) VALUES
('essencial', 'Essencial', 'Para quem está começando a organizar a operação.', 197, 1970, 14, 1, false, true,
 '{"crm":true,"palestras":true,"financeiro":true,"estoque":false,"conta_corrente":false,"relatorios":true,"dashboard_avancado":false,"temporadas":false,"campanhas":false,"projetos":false,"fornecedores":false,"ia_guerra":false,"centro_operacoes":false,"automacao":false,"multi_usuarios":false,"export_pdf":true,"export_excel":false}'::jsonb,
 '{"users":2,"companies":100,"lectures_per_month":10,"agents":2,"speakers":1,"storage_mb":500,"reports":true,"ai_requests":0}'::jsonb),
('profissional', 'Profissional', 'Operação completa com estoque, conta corrente e inteligência.', 397, 3970, 14, 2, true, false,
 '{"crm":true,"palestras":true,"financeiro":true,"estoque":true,"conta_corrente":true,"relatorios":true,"dashboard_avancado":true,"temporadas":true,"campanhas":true,"projetos":true,"fornecedores":true,"ia_guerra":false,"centro_operacoes":true,"automacao":true,"multi_usuarios":true,"export_pdf":true,"export_excel":true}'::jsonb,
 '{"users":10,"companies":1000,"lectures_per_month":60,"agents":15,"speakers":5,"storage_mb":5000,"reports":true,"ai_requests":0}'::jsonb),
('enterprise', 'Enterprise', 'Todos os módulos, IA Guerra e limites ampliados.', 897, 8970, 14, 3, false, false,
 '{"crm":true,"palestras":true,"financeiro":true,"estoque":true,"conta_corrente":true,"relatorios":true,"dashboard_avancado":true,"temporadas":true,"campanhas":true,"projetos":true,"fornecedores":true,"ia_guerra":true,"centro_operacoes":true,"automacao":true,"multi_usuarios":true,"export_pdf":true,"export_excel":true}'::jsonb,
 '{"users":null,"companies":null,"lectures_per_month":null,"agents":null,"speakers":null,"storage_mb":50000,"reports":true,"ai_requests":null}'::jsonb);

-- 8. Organizações existentes: assinatura ativa no plano completo (não bloquear ninguém)
INSERT INTO public.subscriptions (organization_id, plan_id, status, period, contracted_price, started_at, next_renewal_at)
SELECT o.id, p.id, 'active', 'yearly', p.price_yearly, COALESCE(o.created_at, now()), now() + interval '1 year'
FROM public.organizations o
CROSS JOIN (SELECT id, price_yearly FROM public.plans WHERE code = 'enterprise') p
ON CONFLICT (organization_id) DO NOTHING;

-- 9. Novas organizações iniciam em trial automaticamente
CREATE OR REPLACE FUNCTION public.bootstrap_organization_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_days integer;
  v_sub uuid;
BEGIN
  SELECT * INTO v_plan FROM public.plans
  WHERE archived_at IS NULL AND status = 'active'
  ORDER BY is_trial_default DESC, display_order ASC LIMIT 1;

  SELECT default_trial_days INTO v_days FROM public.platform_settings LIMIT 1;
  v_days := COALESCE(v_plan.trial_days, v_days, 14);

  INSERT INTO public.subscriptions (organization_id, plan_id, status, period, contracted_price, started_at, trial_ends_at, created_by, updated_by)
  VALUES (NEW.id, v_plan.id, 'trial', 'monthly', v_plan.price_monthly, now(), now() + (v_days || ' days')::interval, NEW.created_by, NEW.created_by)
  ON CONFLICT (organization_id) DO NOTHING
  RETURNING id INTO v_sub;

  IF v_sub IS NOT NULL THEN
    INSERT INTO public.subscription_events (organization_id, subscription_id, event, to_status, to_plan_id, source, actor_id)
    VALUES (NEW.id, v_sub, 'trial_started', 'trial', v_plan.id, 'system', NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bootstrap_org_subscription
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_organization_subscription();